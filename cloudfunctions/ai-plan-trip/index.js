const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { callChat, MODEL_ALIASES } = require('./lib/llm')
const { buildMessages, retryPrompt, isDestEmpty } = require('./lib/prompts')
const { TOOLS_SCHEMA, executeTool } = require('./lib/tools')
const { validatePlan } = require('./lib/validate')
const { createTask, updateTask, getTripLight, finalizeTrip } = require('./lib/task-store')

// 开启 parallel_tool_calls + prompt 引导批量并发后, 正常 3-5 轮即可结束.
// 12 轮做硬上限, 撞到就软降级(下面)而非直接 fail.
const MAX_TURNS = 12
// 软超时: 留给云函数 timeout (600s) 60s buffer, 避免被 SCF 强杀
const SOFT_TIMEOUT_MS = 540_000

// ─── 配额配置（服务端权威） ───
const QUOTA_LIMITS = {
  free: { flash: 2, pro: 1 },
  pro:  { flash: 99, pro: 99 },
}

function getTier(modelAlias) {
  return modelAlias === 'DeepSeek-V4-PRO' ? 'pro' : 'flash'
}

function todayCST() {
  const now = new Date(Date.now() + 8 * 3600_000)
  return now.toISOString().slice(0, 10)
}

/**
 * 从 users 集合读取用户等级，不存在默认 'free'
 */
async function getUserPlan(db, openid) {
  try {
    const { data } = await db.collection('users').doc(openid).get()
    return data.plan || 'free'
  } catch {
    return 'free'
  }
}

/**
 * 原子扣减配额：返回 { ok: true } 或 { ok: false, reason }
 * 使用 where(tier < limit) + inc(1) 保证不超扣
 */
async function consumeQuota(db, openid, tier, plan = 'free') {
  const limit = (QUOTA_LIMITS[plan] && QUOTA_LIMITS[plan][tier]) || 0
  if (limit <= 0) return { ok: false, reason: '该模型不可用' }

  const _ = db.command
  const docId = `${openid}_${todayCST()}`
  const coll = db.collection('ai_daily_usage')

  // 确保文档存在
  try {
    await coll.doc(docId).get()
  } catch {
    await coll.add({
      data: { _id: docId, _openid: openid, date: todayCST(), flash: 0, pro: 0 },
    })
  }

  // 原子扣减
  const res = await coll
    .where({ _id: docId, [tier]: _.lt(limit) })
    .update({ data: { [tier]: _.inc(1) } })

  if (res.stats.updated === 0) {
    return { ok: false, reason: `今日${tier === 'flash' ? '闪电版' : '旗舰版'}次数已用完，明天再来` }
  }
  return { ok: true }
}

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
  if (_mode === 'quota') return await quotaMode()
  if (_mode === 'plan' || _mode === 'start') return await planMode(event)
  throw new Error(`Unknown _mode: ${_mode}`)
}

// ============ QUOTA: 轻量查询剩余配额 ============
async function quotaMode() {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const db = cloud.database()
  const plan = await getUserPlan(db, OPENID)
  const limits = QUOTA_LIMITS[plan] || QUOTA_LIMITS.free

  const docId = `${OPENID}_${todayCST()}`
  let usage = { flash: 0, pro: 0 }
  try {
    const { data } = await db.collection('ai_daily_usage').doc(docId).get()
    usage = { flash: data.flash || 0, pro: data.pro || 0 }
  } catch { /* 文档不存在 → 用量 0 */ }

  return {
    ok: true,
    plan,
    flash: { remaining: Math.max(0, limits.flash - usage.flash), limit: limits.flash },
    pro:   { remaining: Math.max(0, limits.pro - usage.pro),     limit: limits.pro },
  }
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

// === Task 16: destinations 重试专用 — 轻量 focused prompt, 不带 tools ===
async function fetchDestinationsOnly({ days, name, preferences, pax, modelAlias, messages }) {
  const summary = days.map((d) => ({ date: d.date, spotCount: d.spots.length })).slice(0, 12)
  const destRetryPrompt = `这是已生成的攻略概要：
${JSON.stringify(summary)}
名称：${name || '（待定）'}
偏好：${JSON.stringify(preferences)}
人数：${pax}

请基于此推断 1-3 个最匹配的具体目的地（中文名 + 国家/城市），仅返回 JSON：
{ "destinations": [ { "name": "杭州", "country": "中国", "city": "杭州" } ] }
不要返回其他字段，不要重新生成攻略。`

  // 复用已有 messages 上下文 + 追加一条 focused 请求, 不带 tools, 强制 json
  const retryMessages = [
    ...messages,
    { role: 'user', content: destRetryPrompt },
  ]
  const { msg } = await callChat({
    modelAlias,
    messages: retryMessages,
    responseFormat: { type: 'json_object' },
  })
  const raw = msg.content || ''
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed.destinations) && parsed.destinations.length > 0) {
      return parsed.destinations
    }
  } catch { /* fall through */ }
  return []
}
// 流程: 接收外部 taskId → 立刻插记录 → 跑 tool loop → 写最终结果 / 错误
// 即便客户端 RPC 早就超时, SCF 容器仍按本函数 timeout (600s) 跑完, 不会被回收
async function planMode(event) {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const { taskId: clientTaskId, tripContext, preferences, previousResult, userFeedback, tripId } = event
  if (!clientTaskId) throw new Error('缺少 taskId (需客户端预生成)')
  // 防止任意字符串塞进来 (DB dot-path 攻击 / 超长 _id)
  if (typeof clientTaskId !== 'string' || !/^[a-z0-9]{16,32}$/.test(clientTaskId)) {
    throw new Error(`非法 taskId 格式: ${clientTaskId}`)
  }
  if (!tripContext || !preferences) throw new Error('缺少 tripContext 或 preferences')
  if (!preferences.modelAlias) throw new Error('缺少 modelAlias')
  if (!MODEL_ALIASES[preferences.modelAlias]) {
    throw new Error(`未知模型: ${preferences.modelAlias}`)
  }

  // 单用户并发限制: 同时最多 2 个 pending/streaming 任务, 防止脚本刷请求消耗 token
  const db = cloud.database()
  const _q = db.command
  try {
    const { total } = await db.collection('ai_tasks')
      .where({ _openid: OPENID, status: _q.in(['pending', 'streaming']) })
      .count()
    if (total >= 2) {
      throw new Error(`已有 ${total} 个 AI 任务在运行, 请稍后再试`)
    }
  } catch (e) {
    // count 失败不阻塞主流程, 只记日志
    if (e.message && e.message.startsWith('已有')) throw e
    console.warn('[plan] concurrency-check failed (non-fatal):', e.message)
  }

  // ─── 配额校验（原子扣减，服务端权威） ───
  const tier = getTier(preferences.modelAlias)
  const plan = await getUserPlan(db, OPENID)
  try {
    const quotaRes = await consumeQuota(db, OPENID, tier, plan)
    if (!quotaRes.ok) {
      throw new Error(`QUOTA:${quotaRes.reason}`)
    }
  } catch (e) {
    if (e.message && e.message.startsWith('QUOTA:')) {
      throw new Error(e.message.slice(6))
    }
    console.warn('[plan] quota-check failed (non-fatal, 放行):', e.message)
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
  return await runLoop({ taskId, tripId, tripContext, preferences, previousResult, userFeedback })
}

// ============ runLoop: 多轮 tool calling + 验证 + 写库 ============
async function runLoop({ taskId, tripId, tripContext, preferences, previousResult, userFeedback }) {

  // 协作式取消: 用户在 trip 上把 aiTaskId 清掉 → 本次任务下一轮 LLM 调用前主动退出, 省 token
  // 对 DB 网络抖动重试一次, 避免单次失败被误判为 cancelled.
  const checkCancelled = async () => {
    if (!tripId) return  // 没绑定 trip 的任务无法 cancel (实际新流程下都有 tripId)
    let t
    try {
      t = await getTripLight(tripId)
    } catch (e) {
      if (e && e.transient) {
        console.warn('[checkCancelled] transient, retry once:', e.message)
        await new Promise(r => setTimeout(r, 500))
        try {
          t = await getTripLight(tripId)
        } catch (e2) {
          // 第二次还失败, 放过这一轮 (假设没被取消), 下一轮再试
          console.warn('[checkCancelled] retry failed, skipping this turn:', e2.message)
          return
        }
      } else {
        throw e
      }
    }
    if (!t || t.aiTaskId !== taskId) {
      const err = new Error('CANCELLED')
      err.cancelled = true
      throw err
    }
  }

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
      await checkCancelled()
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
        // 单轮 tool_calls 数量上限: 防止模型一次性发出 14 个 search_poi 把高德 QPS 打爆.
        // 超出的部分用 short-circuit 的 tool 响应敷衍掉, 让下一轮 LLM 自己分批.
        const MAX_TOOL_CALLS_PER_TURN = 8
        // 同时 (name, args) 去重: 重复调用直接复用首次结果
        const seenKey = new Map()  // key → first tool_call_id
        const executable = []
        const shortCircuited = []
        for (let i = 0; i < toolCalls.length; i++) {
          const tc = toolCalls[i]
          const key = `${tc.function && tc.function.name}::${tc.function && tc.function.arguments}`
          if (i >= MAX_TOOL_CALLS_PER_TURN) {
            shortCircuited.push({ tc, reason: 'over-limit' })
          } else if (seenKey.has(key)) {
            shortCircuited.push({ tc, reason: 'duplicate', dupOf: seenKey.get(key) })
          } else {
            seenKey.set(key, tc.id)
            executable.push(tc)
          }
        }
        if (shortCircuited.length > 0) {
          await traceStep(`turn:${turn + 1}:tool:short-circuit`, {
            executed: executable.length,
            skipped: shortCircuited.length,
            reasons: shortCircuited.map(s => s.reason),
          })
        }

        // 按 DeepSeek 文档: 工具调用轮次, 必须把整条 assistant message 原样回传
        // (含 reasoning_content), 否则下一轮 400. 等价于 messages.append(choices[0].message)
        messages.push({
          role: 'assistant',
          content: msg.content || '',
          reasoning_content: msg.reasoning_content || '',
          tool_calls: toolCalls,
        })
        // 真正执行的 (并行执行, 加速 tool 阶段)
        const execResults = await Promise.all(executable.map(async (tc) => {
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
          return { tc, result }
        }))
        // OpenAI 协议要求: 每个 tool_call 都必须有对应 tool 响应, 否则下一轮 400
        // 按原 toolCalls 顺序回写, 让 short-circuited 也有对应响应
        const resultByCallId = new Map(execResults.map(r => [r.tc.id, r.result]))
        for (const tc of toolCalls) {
          let content
          if (resultByCallId.has(tc.id)) {
            content = JSON.stringify(resultByCallId.get(tc.id))
          } else {
            const sc = shortCircuited.find(s => s.tc.id === tc.id)
            if (sc && sc.reason === 'duplicate') {
              const dupResult = resultByCallId.get(sc.dupOf)
              content = JSON.stringify(dupResult != null ? dupResult : { error: '与本轮另一调用重复' })
            } else {
              content = JSON.stringify({ error: `单轮 tool_calls 超过 ${MAX_TOOL_CALLS_PER_TURN} 个上限, 此调用被跳过, 请下一轮再发` })
            }
          }
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content,
          })
        }
        continue
      }

      // 没有 tool_call → 最终 JSON
      finalContent = msg.content || ''
      break
    }

    // 软降级: 撞 MAX_TURNS 但还在调工具时, 强制再来 1 轮"不带 tools + 必须 JSON",
    // 让模型立刻基于已收集的信息收口, 未确认坐标的 spot 省略 lat/lng 即可.
    if (!finalContent) {
      checkSoftTimeout()
      await checkCancelled()
      messages.push({
        role: 'user',
        content: `已达工具调用轮次上限. 立即基于已收集到的信息输出最终 JSON: 能确认坐标的 spot 正常带 lat/lng/adcode; 未能用 search_poi 验证的 spot 可省略 lat/lng/adcode 字段, 但 name/city/type 必须有. 只输出 JSON, 不要任何其他文字.`,
      })
      await traceStep('softDegrade:request', { turns })
      const { msg: degMsg, usage: degUsage } = await callChat({
        modelAlias: preferences.modelAlias,
        messages,
        responseFormat: { type: 'json_object' },
      })
      promptTokens += degUsage.prompt_tokens || 0
      completionTokens += degUsage.completion_tokens || 0
      turns++
      finalContent = degMsg.content || ''
      await traceStep('softDegrade:response', { contentPreview: trunc(finalContent, 600) })
      if (!finalContent) throw new Error(`AI ${MAX_TURNS} 轮未输出最终结果, 软降级也失败`)
    }

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
      await checkCancelled()
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

    // === 构建 draft：days + 可选 name + 可选 recommendedDestinations ===
    const aiDraft = { days: parsed.days }
    if (parsed.name) aiDraft.name = parsed.name
    if (Array.isArray(parsed.recommendedDestinations) && parsed.recommendedDestinations.length > 0) {
      aiDraft.recommendedDestinations = parsed.recommendedDestinations
    }

    // === Task 16: destinations 重试机制 ===
    // 若用户未填目的地且主返回未含 recommendedDestinations, 用轻量 focused prompt 重试最多3次
    if (isDestEmpty(tripContext.destinations)) {
      if (!Array.isArray(aiDraft.recommendedDestinations) || aiDraft.recommendedDestinations.length === 0) {
        for (let i = 0; i < 3; i++) {
          console.log(`[ai-plan-trip] destinations retry #${i + 1}`)
          try {
            const got = await fetchDestinationsOnly({
              days: parsed.days,
              name: parsed.name,
              preferences,
              pax: tripContext.pax,
              modelAlias: preferences.modelAlias,
              messages,  // 复用已有上下文
            })
            if (got.length > 0) {
              aiDraft.recommendedDestinations = got
              console.log(`[ai-plan-trip] destinations retry #${i + 1} success:`, JSON.stringify(got).slice(0, 200))
              break
            }
          } catch (retryErr) {
            console.warn(`[ai-plan-trip] destinations retry #${i + 1} failed:`, retryErr.message)
          }
        }
      }
      // 3 次重试仍无目的地 → 写 error 状态, 不写 draft
      if (!aiDraft.recommendedDestinations || aiDraft.recommendedDestinations.length === 0) {
        console.error('[ai-plan-trip] all destination retries failed')
        try {
          await finalizeTrip(tripId, taskId, {
            aiStatus: 'error',
            aiDraft: null,
            aiError: 'AI 未能推荐目的地，请稍后重试或手动添加',
          })
        } catch (writeErr) {
          console.error('[ai-plan-trip] finalizeTrip(dest-error) FAILED:', writeErr.message)
        }
        await updateTask(taskId, {
          status: 'error',
          error: 'no_destinations_after_retry',
          meta: { elapsedMs: Date.now() - startTs, promptTokens, completionTokens, turns },
        })
        return { ok: false, error: 'no_destinations' }
      }
    }

    // 1. 写 task done (debug 用)
    const _ = cloud.database().command
    await updateTask(taskId, {
      status: 'done',
      result: _.set(parsed),
      meta: { elapsedMs: Date.now() - startTs, promptTokens, completionTokens, turns },
    })

    // 2. 写 trip 草稿 (前端真正订阅的字段). finalizeTrip 内部会比对 aiTaskId 防覆盖
    const writeRes = await finalizeTrip(tripId, taskId, {
      aiStatus: 'ready',
      aiDraft: _.set(aiDraft),
      aiError: null,
    })
    if (!writeRes.written) {
      console.warn('[plan] trip not written:', writeRes.reason)
    }
    return { ok: true, tripWritten: writeRes.written }
  } catch (e) {
    const errMsg = e.message || String(e)
    const cancelled = e && e.cancelled === true

    if (cancelled) {
      console.warn('[ai-plan-trip run] cancelled by user after', turns, 'turns')
      try {
        await updateTask(taskId, {
          status: 'cancelled',
          meta: { elapsedMs: Date.now() - startTs, promptTokens, completionTokens, turns },
        })
      } catch (_) {}
      // 兜底: 如果 trip.aiTaskId 仍是我的 taskId (false-cancel 场景), 把状态字段清空,
      // 否则前端会永远停在 'generating'. 用 where(_id, aiTaskId=mine) 条件更新, DB 层面
      // 保证原子性: 若用户在这一刻已经启动了新任务 (aiTaskId 已被覆盖), 这次写入会 0-match
      // 不会误伤新任务.
      try {
        const recoverRes = await cloud.database()
          .collection('trips')
          .where({ _id: tripId, aiTaskId: taskId })
          .update({
            data: {
              aiTaskId: null,
              aiStatus: null,
              aiDraft: null,
              aiError: null,
              updatedAt: Date.now(),
            },
          })
        if (recoverRes && recoverRes.stats && recoverRes.stats.updated > 0) {
          console.warn('[ai-plan-trip run] cleared trip ai-state (false-cancel recovery)')
        }
      } catch (recoverErr) {
        console.error('[ai-plan-trip run] recovery write failed:', recoverErr && recoverErr.message)
      }
      return { ok: false, cancelled: true }
    }

    console.error('[ai-plan-trip run] failed:', errMsg, e.stack)
    try {
      await updateTask(taskId, {
        status: 'error',
        error: errMsg,
        meta: { elapsedMs: Date.now() - startTs, promptTokens, completionTokens, turns },
      })
    } catch (updErr) {
      console.error('[ai-plan-trip run] updateTask(error) FAILED:', updErr && updErr.message, 'taskId=', taskId)
    }

    // 写 trip error 状态 (finalizeTrip 内部会 abort 已被超越的写入)
    try {
      await finalizeTrip(tripId, taskId, {
        aiStatus: 'error',
        aiDraft: null,
        aiError: errMsg,
      })
    } catch (writeErr) {
      console.error('[ai-plan-trip run] finalizeTrip(error) FAILED:', writeErr && writeErr.message)
    }
    return { ok: false, error: errMsg }
  }
}
