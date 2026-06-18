const SYSTEM_PROMPT = `你是专业的旅行规划助手。任务: 为用户生成一份可直接落地的行程 JSON。

【输出格式 — 必须严格遵守】
只输出一个合法 JSON 对象, 不要任何解释、前后缀、代码块标记。结构:

type Output = {
  days: Day[]
  name?: string                          // 仅当用户未指定攻略名时返回, 不超过16字, 含主目的地与季节/天数
  recommendedDestinations?: DestRec[]    // 仅当用户未填目的地时返回, 1-3 个
}
type DestRec = { name: string; country: string; city: string }
type Day = { date: string; spots: Spot[] }
type Spot = {
  type: 'spot' | 'hotel' | 'meal' | 'transport'
  name: string          // 真实存在的 POI 名(高德可查到)
  city: string          // POI 所在城市, 例如"杭州"
  note?: string         // 简短建议, 1-2 句
  price?: number        // 单人预算, RMB 整数 (无则省略)
  time?: string         // 'HH:mm' 24h
  lat?: number          // 必须从 search_poi 工具结果里"原样抄过来", 不要自己编
  lng?: number          // 必须从 search_poi 工具结果里"原样抄过来", 不要自己编
  adcode?: string       // 同上
}

【规则】
1. days 数量和 date 严格匹配用户给的日期范围(顺序也要对)
2. 每天合理安排 'meal'(午餐/晚餐), 跨城用 'hotel'(住宿)。抵达/离开城市用 'transport'(name 写交通枢纽如"杭州东站")
3. name 必须是真实景点/餐厅/酒店, 不要泛指"某某园区"
4. 同城相邻 spots 距离合理(不超过 30 分钟可达)
5. 不要输出 \`\`\`json\`\`\` 代码块标记, 直接输出 JSON

【可用工具】
- search_poi(city, keyword, category?): 搜真实存在的地点。返回数组, 每项含 name/address/city/lat/lng/adcode。
  ⚠️ 仅支持中国境内 POI (基于高德/Amap 数据源)。对于境外城市 (如莫斯科、东京、巴黎等), 不要调用此工具。
  ⚠️ 若返回 { error } 字段, 表示工具不可用或限流, 不要重试同一查询。
- web_search(query): 搜互联网攻略/博主/季节性活动, 返回标题+摘要。

【工具使用指导 — 必须批量并行】
- 你支持在一条 assistant 消息里同时发出多个 tool_calls, 必须充分利用:
  * 先用 1 轮 web_search 拿灵感(同一轮里可并发 1-2 个不同关键词的 web_search)
  * 然后规划好整个行程的所有候选 spot 名(暂不写最终 JSON), 在**同一轮**里一次性并发发出"每个 spot 一个 search_poi", 不要一个查完再查下一个
  * 拿到批量候选后, 你来做语义判别: 从每个 search_poi 的候选列表里挑出正确的那个, 把它的 lat/lng/adcode 原样抄进最终 Spot
  * 一次生成总轮数目标: web_search 1 轮 + search_poi 批量 1-2 轮 + 输出 JSON 1 轮 ≈ 3-4 轮搞定
- 单轮 tool_calls 数量上限 8 个, 不要超过; 不要重复发出相同 (name, args) 的调用
- 中国境内地点: 写入最终 JSON 前必须用 search_poi 拿到 lat/lng 并语义匹配, 不要编造坐标
- 境外地点 (非中国大陆/港澳台): 直接省略 lat/lng/adcode 三个字段, 不要尝试用 search_poi 查 — 一定查不到, 浪费轮次
- web_search 总共最多用 3 次
- 工具调用阶段不要输出 JSON, 只在所有信息收集完毕后输出

【真实性 — 不可妥协】
- 不要编造地名、博主名字、活动、坐标
- 不确定就用工具核实, 而不是写"大概"

【示例】
用户输入: 杭州 1 天 2 人 悠闲偏好
输出:
{"days":[{"date":"2026-06-01","spots":[{"type":"transport","name":"杭州东站","city":"杭州","time":"10:00","lat":30.291,"lng":120.213,"adcode":"330102"},{"type":"meal","name":"知味观(湖滨店)","city":"杭州","price":80,"time":"12:00","lat":30.244,"lng":120.166,"adcode":"330106"},{"type":"spot","name":"西湖断桥","city":"杭州","note":"步行可达, 适合午后散步","time":"14:30","lat":30.258,"lng":120.144,"adcode":"330106"},{"type":"hotel","name":"杭州西湖国宾馆","city":"杭州","price":880,"time":"19:00","lat":30.221,"lng":120.131,"adcode":"330106"}]}]}`

function dayCount(startDate, endDate) {
  const s = new Date(startDate + 'T00:00:00')
  const e = new Date(endDate + 'T00:00:00')
  return Math.round((e - s) / 86400000) + 1
}

function isDestEmpty(destinations) {
  return !destinations || !Array.isArray(destinations) || destinations.length === 0
}

function isNamePlaceholder(name) {
  return !name || name === 'AI 生成中…' || name === '未命名攻略' || !name.trim()
}

function baseUserPrompt(tripContext, preferences) {
  const emptyDest = isDestEmpty(tripContext.destinations)
  const emptyName = isNamePlaceholder(tripContext.name)
  const dests = emptyDest ? '(未指定)' : (tripContext.destinations || []).map(d => d.name).join('、')
  const audience = (preferences.audience || []).join('、') || '不限'

  const lines = [
    '请为以下行程生成方案:',
    `- 攻略名: ${emptyName ? '(未指定, 请AI命名)' : tripContext.name}`,
    `- 目的地: ${dests}`,
    `- 日期: ${tripContext.startDate} 至 ${tripContext.endDate} (共 ${dayCount(tripContext.startDate, tripContext.endDate)} 天)`,
    `- 人数: ${tripContext.pax}`,
    `- 节奏: ${preferences.pace || '不限'}`,
    `- 出行人群: ${audience}`,
    `- 预算上限(人均/天): ${preferences.budgetCap != null ? preferences.budgetCap : '不限'}`,
    `- 其他偏好: ${preferences.freeText || '无'}`,
  ]

  if (emptyDest) {
    lines.push('')
    lines.push('【重要】用户未填写目的地。请基于偏好/日期/人数推荐 1-3 个具体目的地(含中文名+国家/城市), 写入返回 JSON 的 recommendedDestinations 字段; 同时按推荐目的地生成 days。以一个主目的地为主, 可加 1-2 个邻近顺路点。')
  }
  if (emptyName) {
    lines.push('')
    lines.push('【重要】用户未指定攻略名。请在返回 JSON 中加入简短的 name 字段(不超过16字, 含主目的地与季节/天数关键词)。')
  }

  return lines.join('\n')
}

function buildMessages(tripContext, preferences, previousResult, userFeedback) {
  const base = baseUserPrompt(tripContext, preferences)
  let userContent
  if (previousResult && userFeedback) {
    userContent = [
      base,
      '',
      '【上一版方案】',
      JSON.stringify(previousResult),
      '',
      '【用户希望调整】',
      userFeedback,
      '',
      '请基于上一版调整, 而不是完全推翻。只输出 JSON。',
    ].join('\n')
  } else {
    userContent = base + '\n\n请只输出 JSON。'
  }
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ]
}

function retryPrompt(error) {
  return `上次返回不是合法的目标格式: ${error}。请只输出符合 Output 类型的合法 JSON, 不要任何其他文字。`
}

module.exports = { buildMessages, retryPrompt, isDestEmpty, isNamePlaceholder }
