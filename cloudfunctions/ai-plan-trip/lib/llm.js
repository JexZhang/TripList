const axios = require('axios')

// ═══════════════════════════════════════════════════════════════════════
// 可配置 LLM 层 — 通过云函数环境变量切换 provider / 模型 / thinking 模式
// ═══════════════════════════════════════════════════════════════════════
//
// LLM_PROVIDER     : 'cloudbase' (默认) | 'deepseek'
// LLM_THINKING     : 'disabled'  (默认) | 'enabled'
//
// 每个 provider 独立的 endpoint / auth / model 名, 互不干扰.
// thinking 开启时: 请求体带 thinking 参数, 返回值含 reasoning_content,
//                  调用方必须在下一轮 messages 里原样回传 reasoning_content.
// thinking 关闭时: 不带 thinking 参数, 返回值无 reasoning_content.

const PROVIDER = (process.env.LLM_PROVIDER || 'cloudbase').toLowerCase()
const THINKING = (process.env.LLM_THINKING || 'disabled').toLowerCase() === 'enabled'

// ─── Provider 配置 ───────────────────────────────────────────────────
const PROVIDERS = {
  cloudbase: {
    endpoint: () =>
      `${process.env.TCB_AI_BASE_URL || 'https://cloud1-d3gb6mt7red446466.api.tcloudbasegateway.com/v1/ai/cloudbase'}/chat/completions`,
    auth: () => `Bearer ${process.env.TCB_AI_API_KEY}`,
    models: {
      'DeepSeek-V4-PRO':   () => process.env.TCB_AI_PRO_MODEL   || 'deepseek-v4-pro-202606',
      'DeepSeek-V4-Flash': () => process.env.TCB_AI_FLASH_MODEL || 'deepseek-v4-flash-202605',
    },
  },
  deepseek: {
    endpoint: () => 'https://api.deepseek.com/v1/chat/completions',
    auth: () => `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    models: {
      'DeepSeek-V4-PRO':   () => process.env.DEEPSEEK_PRO_MODEL   || 'deepseek-chat',
      'DeepSeek-V4-Flash': () => process.env.DEEPSEEK_FLASH_MODEL || 'deepseek-chat',
    },
  },
}

// ─── Alias → 具体配置 ──────────────────────────────────────────────────
function resolveAlias(modelAlias) {
  const prov = PROVIDERS[PROVIDER]
  if (!prov) throw new Error(`未知 LLM_PROVIDER: ${PROVIDER} (可选: ${Object.keys(PROVIDERS).join(', ')})`)
  const modelFn = prov.models[modelAlias]
  if (!modelFn) throw new Error(`Unknown modelAlias: ${modelAlias}`)
  const model = modelFn()
  if (!model) throw new Error(`Model name not configured for alias ${modelAlias} on provider ${PROVIDER}`)
  return { endpoint: prov.endpoint(), model, auth: prov.auth(), provider: PROVIDER, thinking: THINKING }
}

// 暴露给外部 (pingMode 诊断用)
const MODEL_ALIASES = {
  'DeepSeek-V4-PRO':   { provider: PROVIDER, model: () => PROVIDERS[PROVIDER]?.models['DeepSeek-V4-PRO']?.() },
  'DeepSeek-V4-Flash': { provider: PROVIDER, model: () => PROVIDERS[PROVIDER]?.models['DeepSeek-V4-Flash']?.() },
}

async function callChat({ modelAlias, messages, tools, responseFormat }) {
  const { endpoint, model, auth, provider, thinking } = resolveAlias(modelAlias)

  const body = {
    model,
    messages,
    temperature: 0.5,
    max_tokens: 8192,
  }

  // thinking 模式可配置: V4 的 thinking 与 tool calling 不兼容,
  // 开启后必须在 messages 里原样回传 reasoning_content, 否则死循环.
  if (thinking) {
    body.thinking = { type: 'enabled' }
  } else {
    body.thinking = { type: 'disabled' }
  }

  if (tools && tools.length > 0) {
    body.tools = tools
    // 高德地图 QPS 有限制, 关闭并行调用避免限流.
    // 模型会每轮发少量 search_poi, 虽然多几轮但更稳定.
    body.parallel_tool_calls = false
  }
  if (responseFormat) body.response_format = responseFormat

  console.log(`[llm:req] model=${model} provider=${provider} thinking=${thinking} msgs=${messages.length} tools=${tools ? tools.length : 0} rf=${!!responseFormat}`)

  // reasoning 模型 + 长 context 单次可能跑 60s+, 给到 130s; SCF 软超时 540s 仍有充足余量
  const PER_CALL_TIMEOUT_MS = 130_000

  const doRequest = async () => axios.post(endpoint, body, {
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    timeout: PER_CALL_TIMEOUT_MS,
  })

  let res
  let lastErr
  // 最多尝试 2 次: 第二次仅在网络/超时类瞬时错误时重试, HTTP 4xx/5xx 不重试 (provider 业务错误)
  for (let attempt = 1; attempt <= 2; attempt++) {
    const t0 = Date.now()
    try {
      res = await doRequest()
      console.log(`[llm:res] ok attempt=${attempt} status=${res.status} ms=${Date.now() - t0} bodyLen=${JSON.stringify(res.data).length}`)
      lastErr = null
      break
    } catch (e) {
      const status = e.response && e.response.status
      console.log(`[llm:res] ERR attempt=${attempt} ms=${Date.now() - t0} code=${e.code} status=${status}`)
      lastErr = e
      // 只对超时/连接类错误重试一次; 业务错误 (4xx/5xx with response) 直接抛
      const isTransient = !status && (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED')
      if (attempt < 2 && isTransient) {
        const backoffMs = 1500
        console.warn(`[llm] transient error, retrying in ${backoffMs}ms (code=${e.code})`)
        await new Promise(r => setTimeout(r, backoffMs))
        continue
      }
      break
    }
  }

  if (lastErr) {
    const e = lastErr
    const status = e.response && e.response.status
    const data = e.response && e.response.data
    console.error('[llm] HTTP error', status, data)
    let detail = ''
    if (data) {
      if (typeof data === 'string') detail = data.slice(0, 300)
      else if (data.error && data.error.message) detail = String(data.error.message).slice(0, 300)
      else detail = JSON.stringify(data).slice(0, 300)
    } else if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') {
      detail = `请求超时(${Math.round(PER_CALL_TIMEOUT_MS / 1000)}s, 已重试1次)`
    } else if (e.message) {
      detail = e.message
    }
    throw new Error(`LLM ${status || 'network'}: ${detail}`)
  }

  const msg = res.data && res.data.choices && res.data.choices[0] && res.data.choices[0].message
  if (!msg) {
    console.error('[llm] bad response', JSON.stringify(res.data).slice(0, 500))
    throw new Error('LLM 返回结构异常: ' + JSON.stringify(res.data).slice(0, 200))
  }
  const usage = res.data.usage || {}
  return { msg, usage }
}

module.exports = { callChat, MODEL_ALIASES, PROVIDER, THINKING }
