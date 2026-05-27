const axios = require('axios')

// alias → provider + model + env 字段映射
// provider 标记: deepseek 系列在多轮 tool calling 中和 thinking 模式不兼容,
// 必须显式关闭 thinking, 否则会出现 "must pass reasoning_content" 死循环或静默挂死
const MODEL_ALIASES = {
  'MiMo-V2.5': {
    provider: 'mimo',
    endpoint: () => process.env.MIMO_ENDPOINT || 'https://api.xiaomimimo.com/v1/chat/completions',
    model: () => process.env.MIMO_MODEL,
    auth: () => `Bearer ${process.env.MIMO_API_KEY}`,
  },
  'DeepSeek-V4-PRO': {
    provider: 'deepseek',
    endpoint: () => 'https://api.deepseek.com/v1/chat/completions',
    model: () => process.env.DEEPSEEK_PRO_MODEL,
    auth: () => `Bearer ${process.env.DEEPSEEK_API_KEY}`,
  },
  'DeepSeek-V4-Flash': {
    provider: 'deepseek',
    endpoint: () => 'https://api.deepseek.com/v1/chat/completions',
    model: () => process.env.DEEPSEEK_FLASH_MODEL,
    auth: () => `Bearer ${process.env.DEEPSEEK_API_KEY}`,
  },
}

function resolveAlias(modelAlias) {
  const cfg = MODEL_ALIASES[modelAlias]
  if (!cfg) throw new Error(`Unknown modelAlias: ${modelAlias}`)
  const model = cfg.model()
  if (!model) throw new Error(`Model name not configured for alias ${modelAlias}`)
  return { endpoint: cfg.endpoint(), model, auth: cfg.auth(), provider: cfg.provider }
}

async function callChat({ modelAlias, messages, tools, responseFormat }) {
  const { endpoint, model, auth, provider } = resolveAlias(modelAlias)

  const body = {
    model,
    messages,  // 按 DeepSeek 文档: thinking + tool calling 时, reasoning_content 必须原样在 messages 里, 不能剥
    temperature: 0.5,
    max_tokens: 8192,
  }
  if (tools && tools.length > 0) {
    body.tools = tools
    // 显式开启并行 tool calling: 让模型在同一轮里批量发出多个 search_poi,
    // 避免一个景点查一轮、5 天行程撞 MAX_TURNS 上限.
    body.parallel_tool_calls = true
  }
  if (responseFormat) body.response_format = responseFormat

  console.log(`[llm:req] model=${model} provider=${provider} msgs=${messages.length} tools=${tools ? tools.length : 0} rf=${!!responseFormat}`)

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

module.exports = { callChat, MODEL_ALIASES }
