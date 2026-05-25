const cloud = require('wx-server-sdk')
const axios = require('axios')

const TOOLS_SCHEMA = [
  {
    type: 'function',
    function: {
      name: 'search_poi',
      description: '搜索真实存在的具体地点(景点/餐厅/酒店), 返回的 lat/lng/adcode 必须原样抄进最终输出。',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名,如"杭州"' },
          keyword: { type: 'string', description: '搜索关键词,如"西湖周边餐厅"' },
          category: { type: 'string', enum: ['spot', 'hotel', 'meal'] },
        },
        required: ['city', 'keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: '搜索互联网上的旅行攻略、博主推荐、特色体验、季节性活动等。返回标题+摘要, 从中提炼灵感。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词, 如"杭州 11月 赏秋 路线"' },
        },
        required: ['query'],
      },
    },
  },
]

async function searchPoi({ city, keyword }) {
  try {
    const r = await cloud.callFunction({
      name: 'amap-poi-search',
      data: { city, keyword },
    })
    const results = (r.result && r.result.results) || []
    // 关键: 把 lat/lng/adcode 也返回, 让 LLM 直接抄
    return results.slice(0, 5).map(p => ({
      name: p.name,
      address: p.address,
      city: p.city,
      lat: p.lat,
      lng: p.lng,
      adcode: p.adcode,
    }))
  } catch (e) {
    console.error('[tool search_poi] error', e.message)
    return []
  }
}

async function webSearch({ query }) {
  const key = process.env.BOCHA_API_KEY
  if (!key) return { error: '搜索暂时不可用(未配置)' }
  try {
    const res = await axios.post(
      'https://api.bochaai.com/v1/web-search',
      { query, count: 8, summary: true, freshness: 'oneYear' },
      {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        timeout: 15000,
      }
    )
    const items = ((res.data && res.data.data && res.data.data.webPages && res.data.data.webPages.value) || []).slice(0, 5)
    return items.map(it => ({
      title: it.name,
      url: it.url,
      summary: it.summary || it.snippet || '',
    }))
  } catch (e) {
    console.error('[tool web_search] error', e.message)
    return { error: '搜索暂时不可用' }
  }
}

async function executeTool(name, args) {
  if (name === 'search_poi') return await searchPoi(args)
  if (name === 'web_search') return await webSearch(args)
  return { error: `unknown tool ${name}` }
}

module.exports = { TOOLS_SCHEMA, executeTool }
