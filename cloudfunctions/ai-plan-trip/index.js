const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { callChat } = require('./lib/llm')
const { buildMessages, retryPrompt } = require('./lib/prompts')
const { TOOLS_SCHEMA, executeTool } = require('./lib/tools')
const { validatePlan } = require('./lib/validate')
const { createTask, updateTask } = require('./lib/task-store')

const MAX_TURNS = 8

exports.main = async (event) => {
  const { _mode = 'start' } = event || {}

  if (_mode === 'start') return await startMode(event)
  if (_mode === 'run') return await runMode(event)
  throw new Error(`Unknown _mode: ${_mode}`)
}

// ============ START: 由客户端调用, 插任务 + fire-and-forget 触发 worker ============
async function startMode(event) {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const { tripContext, preferences, previousResult, userFeedback, tripId } = event
  if (!tripContext || !preferences) throw new Error('缺少 tripContext 或 preferences')
  if (!preferences.modelAlias) throw new Error('缺少 modelAlias')

  const taskId = await createTask({
    openid: OPENID,
    tripId,
    modelAlias: preferences.modelAlias,
    tripContext,
    preferences,
  })

  // fire-and-forget: 不 await, 触发新容器执行 run 模式
  cloud.callFunction({
    name: 'ai-plan-trip',
    data: { _mode: 'run', taskId, tripContext, preferences, previousResult, userFeedback },
  }).catch(e => console.error('[start] worker trigger failed', e))

  return { taskId }
}

// ============ RUN: 后台执行, 进度写入 ai_tasks ============
async function runMode(event) {
  const { taskId, tripContext, preferences, previousResult, userFeedback } = event
  if (!taskId) throw new Error('缺少 taskId')

  const startTs = Date.now()
  let promptTokens = 0
  let completionTokens = 0
  let turns = 0

  try {
    await updateTask(taskId, { status: 'streaming' })

    const messages = buildMessages(tripContext, preferences, previousResult, userFeedback)
    // tool loop 阶段不传 response_format, 避免与 tools 冲突
    let finalContent = null
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      turns++
      const { msg, usage } = await callChat({
        modelAlias: preferences.modelAlias,
        messages,
        tools: TOOLS_SCHEMA,
      })
      promptTokens += usage.prompt_tokens || 0
      completionTokens += usage.completion_tokens || 0

      const toolCalls = msg.tool_calls || []
      if (toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: msg.content || '',
          tool_calls: toolCalls,
        })
        for (const tc of toolCalls) {
          let args = {}
          try { args = JSON.parse(tc.function.arguments || '{}') } catch (e) { args = {} }
          const result = await executeTool(tc.function.name, args)
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

    if (!finalContent) throw new Error('AI 生成超时, 请稍后重试')

    let parsed = null
    try { parsed = JSON.parse(finalContent) } catch (e) { parsed = null }
    let validation = parsed ? validatePlan(parsed, tripContext) : { ok: false, error: 'JSON.parse 失败' }

    if (!validation.ok) {
      // 重试 1 次, 去掉 tools + 强制 json_object
      messages.push({ role: 'user', content: retryPrompt(validation.error) })
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
      if (!validation.ok) {
        throw new Error(`AI 返回格式错误: ${validation.error}`)
      }
    }

    // 把生成结果作为 progress 增量(每天独立 update, client 能流式看到)
    for (let i = 0; i < parsed.days.length; i++) {
      const partial = { days: parsed.days.slice(0, i + 1) }
      await updateTask(taskId, { progress: partial })
    }

    await updateTask(taskId, {
      status: 'done',
      result: parsed,
      meta: { elapsedMs: Date.now() - startTs, promptTokens, completionTokens, turns },
    })
    return { ok: true }
  } catch (e) {
    console.error('[ai-plan-trip run]', e)
    await updateTask(taskId, {
      status: 'error',
      error: e.message || String(e),
      meta: { elapsedMs: Date.now() - startTs, promptTokens, completionTokens, turns },
    }).catch(() => {})
    return { ok: false, error: e.message }
  }
}
