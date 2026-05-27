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

// 简易境外判定: 高德是中国数据源, 列出明显的境外城市直接短路, 避免 LLM 浪费轮次重试.
// 命中即返回结构化 error, LLM 收到后会跳过 lat/lng/adcode 字段.
const OVERSEAS_HINTS = [
  '莫斯科', '圣彼得堡', '东京', '大阪', '京都', '名古屋', '札幌', '冲绳',
  '首尔', '釜山', '济州', '曼谷', '清迈', '普吉', '芭提雅', '新加坡',
  '吉隆坡', '巴厘', '雅加达', '马尼拉', '河内', '胡志明', '岘港',
  '伦敦', '巴黎', '罗马', '米兰', '威尼斯', '佛罗伦萨', '马德里', '巴塞罗那',
  '柏林', '慕尼黑', '法兰克福', '阿姆斯特丹', '布鲁塞尔', '维也纳', '布拉格',
  '苏黎世', '日内瓦', '雅典', '伊斯坦布尔', '迪拜', '阿布扎比', '多哈',
  '纽约', '洛杉矶', '旧金山', '芝加哥', '波士顿', '西雅图', '华盛顿',
  '温哥华', '多伦多', '蒙特利尔', '墨西哥', '里约', '圣保罗', '布宜诺斯艾利斯',
  '悉尼', '墨尔本', '布里斯班', '奥克兰',
]

function isLikelyOverseas(city) {
  if (!city) return false
  return OVERSEAS_HINTS.some(c => city.includes(c))
}

// 启发式: amap 把"莫斯科红场"匹配到了"汕尾市红场"这类乌龙. 若所有命中都来自一个
// 完全不沾边的城市, 说明高德兜底瞎匹配, 直接当作未命中.
function looksMismatched(city, results) {
  if (!city || !results.length) return false
  // 全部命中都不包含查询城市的任一字 → 兜底匹配
  return !results.some(p => p.city && city.split('').some(ch => p.city.includes(ch)))
}

async function searchPoi({ city, keyword }) {
  if (isLikelyOverseas(city)) {
    return { error: `search_poi 不支持境外城市 "${city}", 请在最终 JSON 中省略 lat/lng/adcode 字段` }
  }
  try {
    const r = await cloud.callFunction({
      name: 'amap-poi-search',
      data: { city, keyword },
    })
    const results = (r.result && r.result.results) || []
    if (!results.length) return []
    if (looksMismatched(city, results)) {
      return { error: `search_poi 未在 "${city}" 找到 "${keyword}" 的精确匹配, 请省略 lat/lng/adcode 字段` }
    }
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
    const msg = e && e.message || String(e)
    console.error('[tool search_poi] error', msg)
    // 区分限流和其他错误, 给 LLM 不同的处理信号
    if (msg.includes('CUQPS') || msg.includes('EXCEEDED_THE_LIMIT')) {
      return { error: 'search_poi 暂时限流, 请省略该地点的 lat/lng/adcode 字段, 不要重试' }
    }
    return { error: `search_poi 调用失败: ${msg.slice(0, 100)}, 请省略 lat/lng/adcode 字段` }
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
