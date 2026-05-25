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
  if (tools && tools.length > 0) body.tools = tools
  if (responseFormat) body.response_format = responseFormat

  console.log(`[llm:req] model=${model} provider=${provider} msgs=${messages.length} tools=${tools ? tools.length : 0} rf=${!!responseFormat}`)

  let res
  const t0 = Date.now()
  try {
    res = await axios.post(endpoint, body, {
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      timeout: 75000,
    })
    console.log(`[llm:res] ok status=${res.status} ms=${Date.now() - t0} bodyLen=${JSON.stringify(res.data).length}`)
  } catch (e) {
    console.log(`[llm:res] ERR ms=${Date.now() - t0} code=${e.code} status=${e.response && e.response.status}`)
    const status = e.response && e.response.status
    const data = e.response && e.response.data
    console.error('[llm] HTTP error', status, data)
    // 把 provider 真实错误体透传出来, 方便前端 toast 看到原因
    let detail = ''
    if (data) {
      if (typeof data === 'string') detail = data.slice(0, 300)
      else if (data.error && data.error.message) detail = String(data.error.message).slice(0, 300)
      else detail = JSON.stringify(data).slice(0, 300)
    } else if (e.code === 'ECONNABORTED') {
      detail = '请求超时(75s)'
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
