const axios = require('axios')

// alias → provider + model + env 字段映射
const MODEL_ALIASES = {
  'MiMo-V2.5': {
    endpoint: () => process.env.MIMO_ENDPOINT || 'https://api.xiaomimimo.com/v1/chat/completions',
    model: () => process.env.MIMO_MODEL,
    auth: () => `Bearer ${process.env.MIMO_API_KEY}`,
  },
  'DeepSeek-V4-PRO': {
    endpoint: () => 'https://api.deepseek.com/v1/chat/completions',
    model: () => process.env.DEEPSEEK_PRO_MODEL,
    auth: () => `Bearer ${process.env.DEEPSEEK_API_KEY}`,
  },
  'DeepSeek-V4-Flash': {
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
  return { endpoint: cfg.endpoint(), model, auth: cfg.auth() }
}

async function callChat({ modelAlias, messages, tools, responseFormat }) {
  const { endpoint, model, auth } = resolveAlias(modelAlias)

  const body = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 4096,
  }
  if (tools && tools.length > 0) body.tools = tools
  if (responseFormat) body.response_format = responseFormat

  let res
  try {
    res = await axios.post(endpoint, body, {
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      timeout: 45000,
    })
  } catch (e) {
    const status = e.response && e.response.status
    const data = e.response && e.response.data
    console.error('[llm] HTTP error', status, data)
    throw new Error(`LLM HTTP ${status || 'network'}`)
  }

  const msg = res.data && res.data.choices && res.data.choices[0] && res.data.choices[0].message
  if (!msg) throw new Error('LLM 返回结构异常')
  const usage = res.data.usage || {}
  return { msg, usage }
}

module.exports = { callChat, MODEL_ALIASES }
