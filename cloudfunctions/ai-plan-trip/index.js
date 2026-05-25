const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { callChat, MODEL_ALIASES } = require('./lib/llm')
const { buildMessages, retryPrompt } = require('./lib/prompts')
const { TOOLS_SCHEMA, executeTool } = require('./lib/tools')
const { validatePlan } = require('./lib/validate')
const { createTask, updateTask } = require('./lib/task-store')

const MAX_TURNS = 20
// 软超时: 留给云函数 timeout (600s) 60s buffer, 避免被 SCF 强杀
const SOFT_TIMEOUT_MS = 540_000

// 进程级兜底: 抓未处理的异常和 promise 拒绝, 至少进日志 (SCF 可能会重启容器, 但避免静默)
process.on('unhandledRejection', (reason, p) => {
  console.error('[ai-plan-trip] UNHANDLED REJECTION', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[ai-plan-trip] UNCAUGHT EXCEPTION', err && err.stack || err)
})

// 入口模式:
//   ping  - 同步调试模型联通性
//   plan  - (默认) 客户端调用: 直接插任务并跑完整 loop. 客户端 RPC 超时不影响服务端继续跑.
//           客户端通过 taskId 实时订阅 DB 看进度. 不再有 start/run 分裂.
exports.main = async (event) => {
  const { _mode = 'plan' } = event || {}

  if (_mode === 'ping') return await pingMode(event)
  if (_mode === 'plan' || _mode === 'start') return await planMode(event)
  throw new Error(`Unknown _mode: ${_mode}`)
}

// ============ PING: 云端调试模型联通性, 直接同步返回结果, 不写库不走 worker ============
async function pingMode(event) {
  const modelAlias = event.modelAlias || 'DeepSeek-V4-Flash'
  const userPrompt = event.prompt || '用一句话介绍杭州'

  // 1. 配置体检
  const aliasCfg = MODEL_ALIASES[modelAlias]
  if (!aliasCfg) {
    return { ok: false, stage: 'config', error: `未知 alias: ${modelAlias}`, knownAliases: Object.keys(MODEL_ALIASES) }
  }
  const envReport = {
    MIMO_ENDPOINT: !!process.env.MIMO_ENDPOINT,
    MIMO_MODEL: !!process.env.MIMO_MODEL,
    MIMO_API_KEY: !!process.env.MIMO_API_KEY,
    DEEPSEEK_PRO_MODEL: !!process.env.DEEPSEEK_PRO_MODEL,
    DEEPSEEK_FLASH_MODEL: !!process.env.DEEPSEEK_FLASH_MODEL,
    DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY,
  }

  // 2. 真实调用 (1 轮, 不带 tools, 短 prompt)
  const t0 = Date.now()
  try {
    const { msg, usage } = await callChat({
      modelAlias,
      messages: [
        { role: 'system', content: '你是一个有帮助的助手, 用中文简短回答.' },
        { role: 'user', content: userPrompt },
      ],
    })
    return {
      ok: true,
      modelAlias,
      elapsedMs: Date.now() - t0,
      env: envReport,
      reply: msg.content,
      usage,
    }
  } catch (e) {
    return {
      ok: false,
      stage: 'http',
      modelAlias,
      elapsedMs: Date.now() - t0,
      env: envReport,
      error: e.message,
    }
  }
}

// ============ PLAN: 单函数完整执行. 客户端 fire-and-forget 调用即可. ============
// 流程: 接收外部 taskId → 立刻插记录 → 跑 tool loop → 写最终结果 / 错误
// 即便客户端 RPC 早就超时, SCF 容器仍按本函数 timeout (600s) 跑完, 不会被回收
async function planMode(event) {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const { taskId: clientTaskId, tripContext, preferences, previousResult, userFeedback, tripId } = event
  if (!clientTaskId) throw new Error('缺少 taskId (需客户端预生成)')
  if (!tripContext || !preferences) throw new Error('缺少 tripContext 或 preferences')
  if (!preferences.modelAlias) throw new Error('缺少 modelAlias')
  if (!MODEL_ALIASES[preferences.modelAlias]) {
    throw new Error(`未知模型: ${preferences.modelAlias}`)
  }

  // 1. 用客户端预生成的 _id 插入任务记录, 让前端 watcher 立即能找到
  let taskId
  try {
    taskId = await createTask({
      taskId: clientTaskId,
      openid: OPENID,
      tripId,
      modelAlias: preferences.modelAlias,
      tripContext,
      preferences,
    })
  } catch (e) {
    console.error('[plan] createTask failed', e && e.message, 'taskId=', clientTaskId)
    throw e
  }

  // 2. 同一个 invocation 直接跑完整 loop, 不再 callFunction 派发 worker
  return await runLoop({ taskId, tripContext, preferences, previousResult, userFeedback })
}

// ============ runLoop: 多轮 tool calling + 验证 + 写库 ============
async function runLoop({ taskId, tripContext, preferences, previousResult, userFeedback }) {

  const startTs = Date.now()
  let promptTokens = 0
  let completionTokens = 0
  let turns = 0

  const checkSoftTimeout = () => {
    if (Date.now() - startTs > SOFT_TIMEOUT_MS) {
      throw new Error(`后台执行软超时 (${Math.round((Date.now() - startTs) / 1000)}s)`)
    }
  }

  // 截断长字符串, 方便日志输出
  const trunc = (s, n = 800) => {
    if (s == null) return ''
    const str = typeof s === 'string' ? s : JSON.stringify(s)
    return str.length > n ? str.slice(0, n) + `...[+${str.length - n}]` : str
  }

  // 同时写日志 + 写 task.meta.trace, 便于在数据库直接看到卡点
  const trace = []
  const traceStep = async (label, payload) => {
    const step = { t: Date.now() - startTs, label, ...payload }
    trace.push(step)
    console.log(`[trace +${step.t}ms] ${label}`, JSON.stringify(payload || {}).slice(0, 1500))
    try {
      await updateTask(taskId, {
        meta: { lastStep: label, lastStepAt: Date.now(), elapsedMs: Date.now() - startTs, turns, promptTokens, completionTokens, trace: trace.slice(-12) },
      })
    } catch (e) {
      console.error('[trace] updateTask failed:', e.message)
    }
  }

  try {
    // 启动前再校验一次, 防止 worker 容器拿到错误配置
    if (!MODEL_ALIASES[preferences.modelAlias]) {
      throw new Error(`未知模型: ${preferences.modelAlias}`)
    }

    await updateTask(taskId, { status: 'streaming' })
    await traceStep('run:start', { modelAlias: preferences.modelAlias, tripName: tripContext.name })

    const messages = buildMessages(tripContext, preferences, previousResult, userFeedback)
    console.log('[messages:init]', JSON.stringify(messages).length, 'chars,', messages.length, 'msgs')

    // tool loop 阶段不传 response_format, 避免与 tools 冲突
    let finalContent = null
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      checkSoftTimeout()
      turns++
      await traceStep(`turn:${turn + 1}:request`, { messagesCount: messages.length })

      const { msg, usage } = await callChat({
        modelAlias: preferences.modelAlias,
        messages,
        tools: TOOLS_SCHEMA,
      })
      promptTokens += usage.prompt_tokens || 0
      completionTokens += usage.completion_tokens || 0

      const toolCalls = msg.tool_calls || []
      const toolCallSummary = toolCalls.map(tc => ({
        name: tc.function && tc.function.name,
        args: trunc(tc.function && tc.function.arguments, 200),
      }))

      await traceStep(`turn:${turn + 1}:response`, {
        usage,
        contentLen: (msg.content || '').length,
        contentPreview: trunc(msg.content, 400),
        reasoningLen: (msg.reasoning_content || '').length,
        reasoningPreview: trunc(msg.reasoning_content, 200),
        toolCalls: toolCallSummary,
      })

      if (toolCalls.length > 0) {
        // 按 DeepSeek 文档: 工具调用轮次, 必须把整条 assistant message 原样回传
        // (含 reasoning_content), 否则下一轮 400. 等价于 messages.append(choices[0].message)
        messages.push({
          role: 'assistant',
          content: msg.content || '',
          reasoning_content: msg.reasoning_content || '',
          tool_calls: toolCalls,
        })
        for (const tc of toolCalls) {
          let args = {}
          try { args = JSON.parse(tc.function.arguments || '{}') } catch (e) { args = {} }
          const tStart = Date.now()
          const result = await executeTool(tc.function.name, args)
          const tMs = Date.now() - tStart
          await traceStep(`turn:${turn + 1}:tool:${tc.function.name}`, {
            args,
            elapsedMs: tMs,
            resultPreview: trunc(result, 500),
          })
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          })
        }
        continue
      }

      // 没有 tool_call → 最终 JSON
      finalContent = msg.content || ''
      break
    }

    if (!finalContent) throw new Error(`AI ${MAX_TURNS} 轮未输出最终结果, 多半是模型一直在调工具`)

    let parsed = null
    let parseErr = null
    try { parsed = JSON.parse(finalContent) } catch (e) { parseErr = e.message; parsed = null }
    let validation = parsed ? validatePlan(parsed, tripContext) : { ok: false, error: `JSON.parse 失败: ${parseErr}` }
    await traceStep('final:validate', {
      ok: validation.ok,
      error: validation.error,
      finalPreview: trunc(finalContent, 600),
    })

    if (!validation.ok) {
      checkSoftTimeout()
      // 重试 1 次, 去掉 tools + 强制 json_object
      messages.push({ role: 'user', content: retryPrompt(validation.error) })
      await traceStep('retry:request', { reason: validation.error })
      const { msg: retryMsg, usage: retryUsage } = await callChat({
        modelAlias: preferences.modelAlias,
        messages,
        responseFormat: { type: 'json_object' },
      })
      promptTokens += retryUsage.prompt_tokens || 0
      completionTokens += retryUsage.completion_tokens || 0
      turns++
      try { parsed = JSON.parse(retryMsg.content || '') } catch (e) { parsed = null }
      validation = parsed ? validatePlan(parsed, tripContext) : { ok: false, error: '重试后仍非合法 JSON' }
      await traceStep('retry:validate', {
        ok: validation.ok,
        error: validation.error,
        retryPreview: trunc(retryMsg.content, 600),
      })
      if (!validation.ok) {
        throw new Error(`AI 返回格式错误: ${validation.error}`)
      }
    }

    // 把生成结果作为 progress 增量(每天独立 update, client 能流式看到)
    for (let i = 0; i < parsed.days.length; i++) {
      const partial = { days: parsed.days.slice(0, i + 1) }
      await updateTask(taskId, { progress: partial })
    }

    const _ = cloud.database().command
    await updateTask(taskId, {
      status: 'done',
      // 用 _.set() 整体覆盖, 否则 SDK 会翻译成 result.days/result.summary 的 dot-path 写入,
      // 而初始 result=null 不能创建子字段 -> -502001 "Cannot create field 'days' in element {result: null}"
      result: _.set(parsed),
      meta: { elapsedMs: Date.now() - startTs, promptTokens, completionTokens, turns },
    })
    return { ok: true }
  } catch (e) {
    const errMsg = e.message || String(e)
    console.error('[ai-plan-trip run] failed:', errMsg, e.stack)
    try {
      await updateTask(taskId, {
        status: 'error',
        error: errMsg,
        meta: { elapsedMs: Date.now() - startTs, promptTokens, completionTokens, turns },
      })
    } catch (updErr) {
      // 关键: 不再静默吞掉. 写库失败也要在日志暴露出来
      console.error('[ai-plan-trip run] updateTask(error) FAILED:', updErr && updErr.message, 'taskId=', taskId)
    }
    return { ok: false, error: errMsg }
  }
}
