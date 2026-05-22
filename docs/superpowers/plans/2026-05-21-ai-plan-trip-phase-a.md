# AI 行程生成 Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户在新建 trip 或 trip 详情页点"AI 帮我规划/重新规划",输入偏好后由 LLM 通过 agent loop(可调用高德 POI 搜索 + 博查 web 搜索)生成行程方案,预览确认后写入 trip。

**Architecture:** 新增 cloud function `ai-plan-trip`,内部包含 provider 抽象 (MiMo / DeepSeek 切换)、prompts、tools、agent loop、schema 校验、POI grounding。Client 三个新组件(偏好表单 / 预览 sheet / loading 蒙层)挂在两个入口。

**Tech Stack:** Taro + React + 微信云开发;LLM 接 MiMo (OpenAI 兼容,`https://api.xiaomimimo.com/v1`),备用 DeepSeek;tools 用 OpenAI 兼容 function calling;web 搜索用博查 API (`https://api.bochaai.com/v1/web-search`);云函数 HTTP 用项目已有的 `axios`(amap-poi-search 已在用)。

参考 spec: `docs/superpowers/specs/2026-05-21-ai-plan-trip-phase-a-design.md`

---

## 与其他 plan 的关系

正在排队的两个 plan 也修改同样的页面文件:
- `docs/superpowers/plans/2026-05-21-map-view.md` 改 `src/pages/trip/index.tsx`(加 map tab)
- `docs/superpowers/plans/2026-05-21-collaboration-fixes.md` 改 `src/pages/trip/index.tsx`(CollaboratorsBar)和 `src/pages/new-trip/index.tsx`(useMe)

本 plan 改:
- `src/pages/trip/index.tsx` 增加"AI 重新规划"按钮 + 三个状态变量 + 三个 sheet 渲染(owner 视角)
- `src/pages/new-trip/index.tsx` 增加"AI 帮我规划"按钮 + AI 状态变量 + 同样三个 sheet

**改动区域与前两个 plan 不重叠**(map 改 VIEWS+视图分支;collab 改 CollaboratorsBar props+sheet 挂载+useMe;本 plan 在 header/action 区加按钮 + 新 sheet)。所有 edit 用代码语义定位,不依赖行号。三个 plan 串行无冲突。

---

## 文件结构

| 路径 | 操作 | 责任 |
| --- | --- | --- |
| `src/types/trip.ts` | 改 | 新增 `GeneratedSpot / GeneratedDay / GeneratedPlan` 类型 + `AIPreferences` |
| `src/utils/trip-helpers.ts` | 改 | 新增 `planToDays(plan)` 把 LLM 输出转成 `Day[]` |
| `cloudfunctions/ai-plan-trip/package.json` | 新 | manifest,deps: wx-server-sdk + axios |
| `cloudfunctions/ai-plan-trip/index.js` | 新 | 入口 + agent loop |
| `cloudfunctions/ai-plan-trip/lib/llm.js` | 新 | provider 抽象,callChat() |
| `cloudfunctions/ai-plan-trip/lib/prompts.js` | 新 | system + user prompt 拼装 |
| `cloudfunctions/ai-plan-trip/lib/tools.js` | 新 | TOOLS_SCHEMA + executeTool() |
| `cloudfunctions/ai-plan-trip/lib/validate.js` | 新 | validatePlan() |
| `cloudfunctions/ai-plan-trip/lib/grounding.js` | 新 | groundPois() |
| `src/components/AILoading/index.tsx` | 新 | 全屏 loading 蒙层 + 阶段文案 |
| `src/components/AILoading/index.scss` | 新 | |
| `src/components/AIPlanForm/index.tsx` | 新 | 偏好表单 sheet |
| `src/components/AIPlanForm/index.scss` | 新 | |
| `src/components/AIPlanPreview/index.tsx` | 新 | 预览 sheet + 重生成/应用 |
| `src/components/AIPlanPreview/index.scss` | 新 | |
| `src/pages/new-trip/index.tsx` | 改 | 加"AI 帮我规划"按钮 + 接 3 个 sheet |
| `src/pages/new-trip/index.scss` | 改 | 按钮样式 |
| `src/pages/trip/index.tsx` | 改 | 加"AI 重新规划"按钮(owner) + 接 3 个 sheet |
| `src/pages/trip/index.scss` | 改 | 按钮样式 |

manual(非代码):
- 申请博查 API key (https://open.bochaai.com/)
- 微信云控制台 → 云函数 ai-plan-trip → 环境变量:
  - `LLM_PROVIDER=mimo`
  - `MIMO_API_KEY=<key>`
  - `LLM_MODEL=<MiMo 具体模型名,如 mimo-v2-pro>`
  - `BOCHA_API_KEY=<key>`
- 云函数超时调到 60s(默认 20s 不够)
- 上传 ai-plan-trip 云函数

---

### Task 1: 类型定义

**Files:**
- Modify: `src/types/trip.ts`

- [ ] **Step 1: 在文件末尾追加新类型**

```ts
// === AI 行程生成相关类型 ===

export type AIPace = '悠闲' | '平衡' | '紧凑'
export type AIAudience = '情侣' | '亲子' | '老人' | '朋友'

export interface AIPreferences {
  pace: AIPace
  audience: AIAudience[]
  budgetCap?: number          // 人均/天 RMB
  freeText?: string
}

export interface GeneratedSpot {
  type: SpotType
  name: string
  city: string
  note?: string
  price?: number
  time?: string               // 'HH:mm'
  // grounding 后补
  lat?: number
  lng?: number
  adcode?: string
  _unresolved?: boolean       // 高德查不到时 true,仅 client 端预览用
}

export interface GeneratedDay {
  date: string                // 'YYYY-MM-DD'
  spots: GeneratedSpot[]
}

export interface GeneratedPlan {
  days: GeneratedDay[]
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add src/types/trip.ts
git commit -m "feat(types): AI plan generation types"
```

---

### Task 2: planToDays helper

**Files:**
- Modify: `src/utils/trip-helpers.ts`

- [ ] **Step 1: 在文件末尾追加函数**

```ts
import type { GeneratedPlan } from '../types/trip'

/**
 * 把 LLM 生成的 GeneratedPlan 转成 Trip.days 形态(补 id, 丢掉 _unresolved 标记)。
 */
export function planToDays(plan: GeneratedPlan): Day[] {
  return plan.days.map(gd => ({
    id: uid(),
    date: gd.date,
    spots: gd.spots.map(gs => ({
      id: uid(),
      type: gs.type,
      name: gs.name,
      city: gs.city,
      note: gs.note,
      price: gs.price,
      time: gs.time,
      lat: gs.lat,
      lng: gs.lng,
      adcode: gs.adcode,
    })),
    weather: null,
  }))
}
```

(`uid` 和 `Day` 已在文件顶部 import,无需重复;新增的 `GeneratedPlan` 加到现有 import 行里。如果现有 import 行长这样:`import type { Day, NewTripInput, Destination } from '../types/trip'`,改为:`import type { Day, NewTripInput, Destination, GeneratedPlan } from '../types/trip'`)

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add src/utils/trip-helpers.ts
git commit -m "feat(helpers): planToDays converts GeneratedPlan to Day[]"
```

---

### Task 3: 云函数 package.json

**Files:**
- Create: `cloudfunctions/ai-plan-trip/package.json`

- [ ] **Step 1: 写文件**

```json
{
  "name": "ai-plan-trip",
  "version": "1.0.0",
  "description": "AI itinerary generation with agent loop",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3",
    "axios": "^1.6.0"
  }
}
```

(版本号尽量与 `cloudfunctions/amap-poi-search/package.json` 保持一致;若那边 axios 不是 ^1.6.0,跟齐对方)

- [ ] **Step 2: 提交**

```bash
git add cloudfunctions/ai-plan-trip/package.json
git commit -m "feat(cloudfn): scaffold ai-plan-trip package"
```

---

### Task 4: lib/llm.js — provider 抽象

**Files:**
- Create: `cloudfunctions/ai-plan-trip/lib/llm.js`

- [ ] **Step 1: 写文件**

```js
const axios = require('axios')

const PROVIDERS = {
  mimo: {
    endpoint: 'https://api.xiaomimimo.com/v1/chat/completions',
    getModel: () => process.env.LLM_MODEL || 'mimo-v2-pro',
    auth: () => `Bearer ${process.env.MIMO_API_KEY}`,
  },
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    getModel: () => process.env.LLM_MODEL || 'deepseek-chat',
    auth: () => `Bearer ${process.env.DEEPSEEK_API_KEY}`,
  },
}

async function callChat({ messages, tools, responseFormat }) {
  const providerName = process.env.LLM_PROVIDER || 'mimo'
  const cfg = PROVIDERS[providerName]
  if (!cfg) throw new Error(`Unknown LLM_PROVIDER: ${providerName}`)

  const body = {
    model: cfg.getModel(),
    messages,
    temperature: 0.7,
    max_tokens: 4096,
  }
  if (tools && tools.length > 0) body.tools = tools
  if (responseFormat) body.response_format = responseFormat

  let res
  try {
    res = await axios.post(cfg.endpoint, body, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: cfg.auth(),
      },
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
  return msg  // { role, content?, tool_calls? }
}

module.exports = { callChat }
```

- [ ] **Step 2: 提交**

```bash
git add cloudfunctions/ai-plan-trip/lib/llm.js
git commit -m "feat(ai-plan): LLM provider abstraction"
```

---

### Task 5: lib/prompts.js

**Files:**
- Create: `cloudfunctions/ai-plan-trip/lib/prompts.js`

- [ ] **Step 1: 写文件**

```js
const SYSTEM_PROMPT = `你是"行册"小程序的旅行规划助手。任务: 为用户生成一份可直接落地的行程 JSON。

【输出格式 — 必须严格遵守】
只输出一个合法 JSON 对象, 不要任何解释、前后缀、代码块标记。结构:

type Output = { days: Day[] }
type Day = { date: string; spots: Spot[] }
type Spot = {
  type: 'spot' | 'hotel' | 'meal' | 'transport' | 'arrive'
  name: string          // 真实存在的 POI 名(高德可查到)
  city: string          // POI 所在城市, 例如"杭州"
  note?: string         // 简短建议, 1-2 句
  price?: number        // 单人预算, RMB 整数 (无则省略)
  time?: string         // 'HH:mm' 24h
}

【规则】
1. days 数量和 date 严格匹配用户给的日期范围
2. 每天合理安排 'meal'(午餐/晚餐), 跨城用 'hotel'(住宿)
3. name 必须是真实景点/餐厅/酒店, 不要泛指"某某园区"
4. 同城相邻 spots 距离合理(不超过 30 分钟可达)
5. 不要输出 \`\`\`json\`\`\` 代码块标记, 直接输出 JSON

【可用工具】
- search_poi(city, keyword, category?): 确认真实存在的地点
- web_search(query): 搜索互联网上的旅行攻略、博主推荐、季节性活动

【使用工具的指导原则】
- 不熟悉的目的地 / 想要差异化推荐 → 先 web_search 拿灵感
- 任何地点写入 JSON 前 → 必要时 search_poi 确认存在
- 一次生成 web_search 用 1-3 次, search_poi 按需调用
- 工具调用阶段不要输出 JSON, 只在所有信息收集完毕后输出

【真实性 — 不可妥协】
- 不要编造地名、博主名字、活动
- 不确定就用工具核实, 而不是写"大概"

【示例】
用户输入: 杭州 3 天 2 人 悠闲偏好
输出:
{"days":[{"date":"2026-06-01","spots":[{"type":"arrive","name":"杭州东站","city":"杭州","time":"10:00"},{"type":"meal","name":"知味观(湖滨店)","city":"杭州","price":80,"time":"12:00"},{"type":"spot","name":"西湖断桥","city":"杭州","note":"步行可达, 适合午后散步","time":"14:30"},{"type":"hotel","name":"杭州西湖国宾馆","city":"杭州","price":880,"time":"19:00"}]}]}`

function dayCount(startDate, endDate) {
  const s = new Date(startDate + 'T00:00:00')
  const e = new Date(endDate + 'T00:00:00')
  return Math.round((e - s) / 86400000) + 1
}

function baseUserPrompt(tripContext, preferences) {
  const dests = (tripContext.destinations || []).map(d => d.name).join('、') || '(未指定)'
  const audience = (preferences.audience || []).join('、') || '不限'
  return [
    '请为以下行程生成方案:',
    `- 攻略名: ${tripContext.name || '未命名'}`,
    `- 目的地: ${dests}`,
    `- 日期: ${tripContext.startDate} 至 ${tripContext.endDate} (共 ${dayCount(tripContext.startDate, tripContext.endDate)} 天)`,
    `- 人数: ${tripContext.pax}`,
    `- 节奏: ${preferences.pace}`,
    `- 出行人群: ${audience}`,
    `- 预算上限(人均/天): ${preferences.budgetCap != null ? preferences.budgetCap : '不限'}`,
    `- 其他偏好: ${preferences.freeText || '无'}`,
  ].join('\n')
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

module.exports = { buildMessages, retryPrompt }
```

- [ ] **Step 2: 提交**

```bash
git add cloudfunctions/ai-plan-trip/lib/prompts.js
git commit -m "feat(ai-plan): system and user prompts"
```

---

### Task 6: lib/validate.js

**Files:**
- Create: `cloudfunctions/ai-plan-trip/lib/validate.js`

- [ ] **Step 1: 写文件**

```js
const VALID_TYPES = ['spot', 'hotel', 'meal', 'transport', 'arrive']

function dayCount(startDate, endDate) {
  const s = new Date(startDate + 'T00:00:00')
  const e = new Date(endDate + 'T00:00:00')
  return Math.round((e - s) / 86400000) + 1
}

function validatePlan(obj, tripContext) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: '不是对象' }
  if (!Array.isArray(obj.days)) return { ok: false, error: '缺少 days 数组' }

  const expected = dayCount(tripContext.startDate, tripContext.endDate)
  if (obj.days.length !== expected) {
    return { ok: false, error: `days 数量 ${obj.days.length}, 应为 ${expected}` }
  }

  for (let i = 0; i < obj.days.length; i++) {
    const d = obj.days[i]
    if (!d.date || typeof d.date !== 'string') {
      return { ok: false, error: `days[${i}].date 缺失或非字符串` }
    }
    if (!Array.isArray(d.spots) || d.spots.length === 0) {
      return { ok: false, error: `days[${i}].spots 为空` }
    }
    for (let j = 0; j < d.spots.length; j++) {
      const s = d.spots[j]
      if (!s || typeof s !== 'object') {
        return { ok: false, error: `days[${i}].spots[${j}] 非对象` }
      }
      if (!s.type || !VALID_TYPES.includes(s.type)) {
        return { ok: false, error: `days[${i}].spots[${j}].type 不合法` }
      }
      if (!s.name || typeof s.name !== 'string') {
        return { ok: false, error: `days[${i}].spots[${j}].name 缺失` }
      }
      if (!s.city || typeof s.city !== 'string') {
        return { ok: false, error: `days[${i}].spots[${j}].city 缺失` }
      }
    }
  }
  return { ok: true }
}

module.exports = { validatePlan }
```

- [ ] **Step 2: 提交**

```bash
git add cloudfunctions/ai-plan-trip/lib/validate.js
git commit -m "feat(ai-plan): plan schema validator"
```

---

### Task 7: lib/tools.js

**Files:**
- Create: `cloudfunctions/ai-plan-trip/lib/tools.js`

- [ ] **Step 1: 写文件**

```js
const cloud = require('wx-server-sdk')
const axios = require('axios')

const TOOLS_SCHEMA = [
  {
    type: 'function',
    function: {
      name: 'search_poi',
      description: '搜索真实存在的具体地点(景点/餐厅/酒店)。当你想确认某个名字真实存在、或在特定城市找具体地点时调用。',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名,如"杭州"' },
          keyword: { type: 'string', description: '搜索关键词,如"西湖周边餐厅"' },
          category: {
            type: 'string',
            enum: ['spot', 'hotel', 'meal'],
            description: '类别筛选,可选',
          },
        },
        required: ['city', 'keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: '搜索互联网上的旅行攻略、博主推荐、特色体验、季节性活动等。当你对该目的地的最新热门内容不熟悉时调用。返回标题+摘要,你需要从中提炼可用信息。',
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
    // 故意只返回精简字段, 不含 lat/lng (grounding 阶段统一处理)
    return results.slice(0, 5).map(p => ({
      name: p.name,
      address: p.address,
      city: p.city,
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
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
```

- [ ] **Step 2: 提交**

```bash
git add cloudfunctions/ai-plan-trip/lib/tools.js
git commit -m "feat(ai-plan): tools (search_poi, web_search)"
```

---

### Task 8: lib/grounding.js

**Files:**
- Create: `cloudfunctions/ai-plan-trip/lib/grounding.js`

- [ ] **Step 1: 写文件**

```js
const cloud = require('wx-server-sdk')

async function groundOne(spot) {
  try {
    const r = await cloud.callFunction({
      name: 'amap-poi-search',
      data: { city: spot.city, keyword: spot.name },
    })
    const first = (r.result && r.result.results && r.result.results[0])
    if (first && first.lat && first.lng) {
      spot.lat = first.lat
      spot.lng = first.lng
      spot.adcode = first.adcode
    } else {
      spot._unresolved = true
    }
  } catch (e) {
    console.error('[grounding] error', e.message)
    spot._unresolved = true
  }
}

async function groundPois(plan) {
  const tasks = []
  for (const d of plan.days) {
    for (const s of d.spots) {
      if (s.type === 'transport') continue
      tasks.push(s)
    }
  }
  // 并发上限 5
  for (let i = 0; i < tasks.length; i += 5) {
    await Promise.all(tasks.slice(i, i + 5).map(groundOne))
  }
  return plan
}

module.exports = { groundPois }
```

- [ ] **Step 2: 提交**

```bash
git add cloudfunctions/ai-plan-trip/lib/grounding.js
git commit -m "feat(ai-plan): POI grounding"
```

---

### Task 9: index.js — agent loop

**Files:**
- Create: `cloudfunctions/ai-plan-trip/index.js`

- [ ] **Step 1: 写文件**

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { callChat } = require('./lib/llm')
const { buildMessages, retryPrompt } = require('./lib/prompts')
const { TOOLS_SCHEMA, executeTool } = require('./lib/tools')
const { validatePlan } = require('./lib/validate')
const { groundPois } = require('./lib/grounding')

const MAX_TURNS = 8

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const { tripContext, preferences, previousResult, userFeedback } = event || {}
  if (!tripContext || !preferences) throw new Error('缺少 tripContext 或 preferences')

  const messages = buildMessages(tripContext, preferences, previousResult, userFeedback)
  const responseFormat = { type: 'json_object' }

  let finalContent = null
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const msg = await callChat({ messages, tools: TOOLS_SCHEMA, responseFormat })

    const toolCalls = msg.tool_calls || []
    if (toolCalls.length > 0) {
      // assistant 消息要带上 tool_calls 再 append
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

    // 没有 tool_call → 应是最终 JSON
    finalContent = msg.content || ''
    break
  }

  if (!finalContent) throw new Error('AI 生成超时, 请稍后重试')

  let parsed = null
  try { parsed = JSON.parse(finalContent) } catch (e) { parsed = null }
  let validation = parsed ? validatePlan(parsed, tripContext) : { ok: false, error: 'JSON.parse 失败' }

  if (!validation.ok) {
    // 重试 1 次
    messages.push({ role: 'user', content: retryPrompt(validation.error) })
    const retry = await callChat({ messages, tools: TOOLS_SCHEMA, responseFormat })
    try { parsed = JSON.parse(retry.content || '') } catch (e) { parsed = null }
    validation = parsed ? validatePlan(parsed, tripContext) : { ok: false, error: '重试后仍非合法 JSON' }
    if (!validation.ok) {
      console.error('[ai-plan-trip] validation failed twice', validation.error)
      throw new Error('AI 返回格式错误, 请稍后重试')
    }
  }

  await groundPois(parsed)
  return { result: parsed }
}
```

- [ ] **Step 2: 上传云函数 + 配置环境变量(manual)**

在微信开发者工具中:
1. 右键 `cloudfunctions/ai-plan-trip` → "上传并部署: 云端安装依赖"
2. 等几十秒待依赖安装完成
3. 云控制台 → 云函数 → ai-plan-trip → 环境变量,添加:
   - `LLM_PROVIDER=mimo`
   - `LLM_MODEL=mimo-v2-pro`(或用户给的具体模型名)
   - `MIMO_API_KEY=<key>`
   - `BOCHA_API_KEY=<key>`
4. 云控制台 → ai-plan-trip → 高级配置 → 超时调到 60s
5. 重新部署一次让环境变量生效

如果当下不能在 IDE 操作,记录到 todo,验证阶段(Task 15)统一做。

- [ ] **Step 3: 提交**

```bash
git add cloudfunctions/ai-plan-trip/index.js
git commit -m "feat(ai-plan): main entry with agent loop"
```

---

### Task 10: AILoading 组件

**Files:**
- Create: `src/components/AILoading/index.tsx`
- Create: `src/components/AILoading/index.scss`

- [ ] **Step 1: index.tsx**

```tsx
import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import './index.scss'

interface Props {
  open: boolean
}

const PHASES = [
  { from: 0, label: '正在构思…' },
  { from: 5, label: '正在查询地点…' },
  { from: 15, label: '整理结果…' },
]

export default function AILoading({ open }: Props) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!open) { setElapsed(0); return }
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [open])

  if (!open) return null

  const phase = [...PHASES].reverse().find(p => elapsed >= p.from) || PHASES[0]

  return (
    <View className='ail-mask'>
      <View className='ail-card'>
        <View className='ail-spinner' />
        <Text className='ail-text'>{phase.label}</Text>
        <Text className='ail-elapsed'>{elapsed}s · 可能需要 10-40 秒</Text>
      </View>
    </View>
  )
}
```

- [ ] **Step 2: index.scss**

```scss
.ail-mask {
  position: fixed;
  left: 0; right: 0; top: 0; bottom: 0;
  background: rgba(0,0,0,0.45);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ail-card {
  background: var(--bg, #f7f1e3);
  border-radius: 20rpx;
  padding: 48rpx 64rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 360rpx;
}
.ail-spinner {
  width: 64rpx;
  height: 64rpx;
  border: 4rpx solid rgba(0,0,0,0.15);
  border-top-color: var(--ink, #2c2c2c);
  border-radius: 50%;
  animation: ail-spin 1s linear infinite;
  margin-bottom: 24rpx;
}
@keyframes ail-spin {
  to { transform: rotate(360deg); }
}
.ail-text {
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 8rpx;
}
.ail-elapsed {
  font-size: 22rpx;
  opacity: 0.6;
}
```

- [ ] **Step 3: 提交**

```bash
git add src/components/AILoading/
git commit -m "feat(component): AILoading mask with phase hints"
```

---

### Task 11: AIPlanForm 组件

**Files:**
- Create: `src/components/AIPlanForm/index.tsx`
- Create: `src/components/AIPlanForm/index.scss`

- [ ] **Step 1: index.tsx**

```tsx
import { useState } from 'react'
import { View, Text, Input, Textarea } from '@tarojs/components'
import type { AIPace, AIAudience, AIPreferences } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  onSubmit: (prefs: AIPreferences) => void
  onClose: () => void
}

const PACES: AIPace[] = ['悠闲', '平衡', '紧凑']
const AUDIENCES: AIAudience[] = ['情侣', '亲子', '老人', '朋友']

export default function AIPlanForm({ open, onSubmit, onClose }: Props) {
  const [pace, setPace] = useState<AIPace>('平衡')
  const [audience, setAudience] = useState<AIAudience[]>([])
  const [budgetCap, setBudgetCap] = useState<string>('')
  const [freeText, setFreeText] = useState<string>('')

  if (!open) return null

  const toggleAudience = (a: AIAudience) => {
    setAudience(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }

  const submit = () => {
    const budgetNum = Number(budgetCap)
    onSubmit({
      pace,
      audience,
      budgetCap: budgetCap && budgetNum > 0 ? budgetNum : undefined,
      freeText: freeText.trim() || undefined,
    })
  }

  return (
    <View className='aif-mask' onClick={onClose}>
      <View className='aif-sheet' catchMove onClick={(e) => e.stopPropagation()}>
        <View className='aif-title'>告诉 AI 你的偏好</View>

        <View className='aif-field'>
          <Text className='aif-label'>节奏</Text>
          <View className='aif-chips'>
            {PACES.map(p => (
              <View
                key={p}
                className={`aif-chip ${pace === p ? 'on' : ''}`}
                onClick={() => setPace(p)}
              >{p}</View>
            ))}
          </View>
        </View>

        <View className='aif-field'>
          <Text className='aif-label'>出行人群(可多选)</Text>
          <View className='aif-chips'>
            {AUDIENCES.map(a => (
              <View
                key={a}
                className={`aif-chip ${audience.includes(a) ? 'on' : ''}`}
                onClick={() => toggleAudience(a)}
              >{a}</View>
            ))}
          </View>
        </View>

        <View className='aif-field'>
          <Text className='aif-label'>预算上限(人均/天 ¥, 可选)</Text>
          <Input
            className='aif-input'
            type='number'
            value={budgetCap}
            onInput={(e) => setBudgetCap(e.detail.value)}
            placeholder='例如 500'
          />
        </View>

        <View className='aif-field'>
          <Text className='aif-label'>其他偏好(可选)</Text>
          <Textarea
            className='aif-textarea'
            value={freeText}
            onInput={(e) => setFreeText(e.detail.value)}
            placeholder='例如: 喜欢拍照、不爱热门景点、想找当地特色餐厅'
            maxlength={200}
          />
        </View>

        <View className='aif-actions'>
          <View className='aif-btn-cancel' onClick={onClose}>取消</View>
          <View className='aif-btn-submit' onClick={submit}>开始生成</View>
        </View>
      </View>
    </View>
  )
}
```

- [ ] **Step 2: index.scss**

```scss
.aif-mask {
  position: fixed;
  left: 0; right: 0; top: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  z-index: 1500;
  display: flex;
  align-items: flex-end;
}
.aif-sheet {
  width: 100%;
  background: var(--bg, #f7f1e3);
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 32rpx 48rpx;
  box-sizing: border-box;
  max-height: 90vh;
  overflow-y: auto;
}
.aif-title {
  font-size: 34rpx;
  font-weight: 700;
  margin-bottom: 24rpx;
}
.aif-field {
  margin-bottom: 24rpx;
}
.aif-label {
  font-size: 26rpx;
  opacity: 0.7;
  display: block;
  margin-bottom: 12rpx;
}
.aif-chips {
  display: flex;
  flex-wrap: wrap;
}
.aif-chip {
  margin-right: 16rpx;
  margin-bottom: 12rpx;
  padding: 12rpx 28rpx;
  border: 2rpx solid currentColor;
  border-radius: 24rpx;
  font-size: 26rpx;
  opacity: 0.55;
}
.aif-chip.on {
  opacity: 1;
  background: var(--ink, #2c2c2c);
  color: var(--bg, #f7f1e3);
}
.aif-input {
  width: 100%;
  padding: 16rpx 20rpx;
  background: rgba(0,0,0,0.05);
  border-radius: 12rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}
.aif-textarea {
  width: 100%;
  height: 120rpx;
  padding: 16rpx 20rpx;
  background: rgba(0,0,0,0.05);
  border-radius: 12rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}
.aif-actions {
  display: flex;
  margin-top: 24rpx;
}
.aif-btn-cancel,
.aif-btn-submit {
  flex: 1;
  text-align: center;
  padding: 22rpx 0;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 16rpx;
}
.aif-btn-cancel {
  margin-right: 16rpx;
  background: rgba(0,0,0,0.08);
}
.aif-btn-submit {
  background: var(--ink, #2c2c2c);
  color: var(--bg, #f7f1e3);
}
```

- [ ] **Step 3: 提交**

```bash
git add src/components/AIPlanForm/
git commit -m "feat(component): AIPlanForm preference sheet"
```

---

### Task 12: AIPlanPreview 组件

**Files:**
- Create: `src/components/AIPlanPreview/index.tsx`
- Create: `src/components/AIPlanPreview/index.scss`

- [ ] **Step 1: index.tsx**

```tsx
import { useState } from 'react'
import { View, Text, ScrollView, Textarea } from '@tarojs/components'
import type { GeneratedPlan, GeneratedSpot } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  plan: GeneratedPlan | null
  generating: boolean
  onRegenerate: (feedback: string) => void
  onApply: () => void
  onClose: () => void
}

const TYPE_LABEL: Record<string, string> = {
  spot: '景',
  hotel: '宿',
  meal: '食',
  transport: '行',
  arrive: '抵',
}

function unresolvedCount(plan: GeneratedPlan): number {
  let n = 0
  for (const d of plan.days) for (const s of d.spots) if (s._unresolved) n++
  return n
}

export default function AIPlanPreview({
  open, plan, generating, onRegenerate, onApply, onClose,
}: Props) {
  const [feedback, setFeedback] = useState('')
  if (!open || !plan) return null

  const unres = unresolvedCount(plan)

  return (
    <View className='aip-mask' onClick={onClose}>
      <View className='aip-sheet' catchMove onClick={(e) => e.stopPropagation()}>
        <View className='aip-header'>
          <Text className='aip-title'>AI 生成的方案</Text>
          <Text className='aip-close' onClick={onClose}>✕</Text>
        </View>

        {unres > 0 && (
          <View className='aip-warn'>
            有 {unres} 个地点未在高德找到, 应用后可手动调整
          </View>
        )}

        <ScrollView scrollY className='aip-body'>
          {plan.days.map((d, di) => (
            <View key={`d-${di}`} className='aip-day'>
              <View className='aip-day-title'>Day {di + 1} · {d.date}</View>
              {d.spots.map((s: GeneratedSpot, si) => (
                <View
                  key={`s-${di}-${si}`}
                  className={`aip-spot ${s._unresolved ? 'unresolved' : ''}`}
                >
                  <Text className='aip-spot-tag'>{TYPE_LABEL[s.type] || '·'}</Text>
                  <View className='aip-spot-body'>
                    <Text className='aip-spot-name'>{s.name}</Text>
                    {s.time && <Text className='aip-spot-time'>{s.time}</Text>}
                    {s.note && <Text className='aip-spot-note'>{s.note}</Text>}
                    {typeof s.price === 'number' && s.price > 0 && (
                      <Text className='aip-spot-price'>¥{s.price}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>

        <View className='aip-feedback'>
          <Text className='aip-feedback-label'>想调整哪里? (可选)</Text>
          <Textarea
            className='aip-feedback-input'
            value={feedback}
            onInput={(e) => setFeedback(e.detail.value)}
            placeholder='例如: 第二天太赶, 改悠闲点'
            maxlength={200}
            disabled={generating}
          />
        </View>

        <View className='aip-actions'>
          <View
            className={`aip-btn-regen ${generating ? 'disabled' : ''}`}
            onClick={() => !generating && onRegenerate(feedback)}
          >{generating ? '生成中…' : '重新生成'}</View>
          <View
            className={`aip-btn-apply ${generating ? 'disabled' : ''}`}
            onClick={() => !generating && onApply()}
          >应用</View>
        </View>
      </View>
    </View>
  )
}
```

- [ ] **Step 2: index.scss**

```scss
.aip-mask {
  position: fixed;
  left: 0; right: 0; top: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  z-index: 1500;
  display: flex;
  align-items: flex-end;
}
.aip-sheet {
  width: 100%;
  background: var(--bg, #f7f1e3);
  border-radius: 24rpx 24rpx 0 0;
  padding: 24rpx 24rpx 48rpx;
  box-sizing: border-box;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
}
.aip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}
.aip-title { font-size: 32rpx; font-weight: 700; }
.aip-close { font-size: 36rpx; opacity: 0.6; padding: 8rpx 16rpx; }

.aip-warn {
  background: rgba(196, 61, 61, 0.12);
  color: #c43d3d;
  font-size: 24rpx;
  padding: 12rpx 16rpx;
  border-radius: 12rpx;
  margin-bottom: 12rpx;
}

.aip-body {
  flex: 1;
  min-height: 200rpx;
  max-height: 60vh;
}
.aip-day {
  margin-bottom: 20rpx;
}
.aip-day-title {
  font-size: 28rpx;
  font-weight: 700;
  margin-bottom: 8rpx;
}
.aip-spot {
  display: flex;
  align-items: flex-start;
  padding: 12rpx;
  border-radius: 12rpx;
  margin-bottom: 8rpx;
  background: rgba(0,0,0,0.04);
}
.aip-spot.unresolved {
  background: rgba(0,0,0,0.02);
  opacity: 0.55;
}
.aip-spot-tag {
  display: inline-block;
  width: 48rpx;
  height: 48rpx;
  line-height: 48rpx;
  text-align: center;
  border-radius: 999rpx;
  background: var(--ink, #2c2c2c);
  color: var(--bg, #f7f1e3);
  font-size: 22rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
}
.aip-spot-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.aip-spot-name { font-size: 28rpx; font-weight: 600; }
.aip-spot-time { font-size: 22rpx; opacity: 0.55; margin-top: 4rpx; }
.aip-spot-note { font-size: 24rpx; opacity: 0.7; margin-top: 4rpx; line-height: 1.4; }
.aip-spot-price { font-size: 24rpx; margin-top: 4rpx; }

.aip-feedback {
  margin-top: 16rpx;
}
.aip-feedback-label {
  font-size: 24rpx;
  opacity: 0.65;
  display: block;
  margin-bottom: 8rpx;
}
.aip-feedback-input {
  width: 100%;
  height: 100rpx;
  padding: 12rpx 16rpx;
  background: rgba(0,0,0,0.05);
  border-radius: 12rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}

.aip-actions {
  display: flex;
  margin-top: 20rpx;
}
.aip-btn-regen,
.aip-btn-apply {
  flex: 1;
  text-align: center;
  padding: 22rpx 0;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 16rpx;
}
.aip-btn-regen {
  margin-right: 16rpx;
  background: rgba(0,0,0,0.08);
}
.aip-btn-apply {
  background: var(--ink, #2c2c2c);
  color: var(--bg, #f7f1e3);
}
.aip-btn-regen.disabled,
.aip-btn-apply.disabled {
  opacity: 0.5;
}
```

- [ ] **Step 3: 提交**

```bash
git add src/components/AIPlanPreview/
git commit -m "feat(component): AIPlanPreview with regenerate and apply"
```

---

### Task 13: new-trip 页接入 AI 入口

**Files:**
- Modify: `src/pages/new-trip/index.tsx`
- Modify: `src/pages/new-trip/index.scss`

- [ ] **Step 1: 在 import 段加 AI 相关 imports**

在 new-trip 页 import 段加:

```tsx
import AILoading from '../../components/AILoading'
import AIPlanForm from '../../components/AIPlanForm'
import AIPlanPreview from '../../components/AIPlanPreview'
import type { AIPreferences, GeneratedPlan } from '../../types/trip'
import { planToDays } from '../../utils/trip-helpers'
```

`planToDays` 也可以并到现有从 `trip-helpers` 的 import 行里 —— 现有 import 行如 `import { buildNewTrip } from '../../utils/trip-helpers'` 改为 `import { buildNewTrip, planToDays } from '../../utils/trip-helpers'`,然后上方那行单独的 `import { planToDays } from '../../utils/trip-helpers'` 就不需要了。

- [ ] **Step 2: 在 NewTrip 组件加 AI 状态变量**

定位到 `export default function NewTrip()` 内部,与现有 useState 同级,追加:

```tsx
const [aiFormOpen, setAiFormOpen] = useState(false)
const [aiLoading, setAiLoading] = useState(false)
const [aiPlan, setAiPlan] = useState<GeneratedPlan | null>(null)
const [aiPreviewOpen, setAiPreviewOpen] = useState(false)
const [aiPrefs, setAiPrefs] = useState<AIPreferences | null>(null)
```

- [ ] **Step 3: 加 AI 调用函数**

在 `submit` 函数下方追加:

```tsx
const callAI = async (prefs: AIPreferences, previousResult?: GeneratedPlan, userFeedback?: string) => {
  setAiLoading(true)
  try {
    const r: any = await Taro.cloud.callFunction({
      name: 'ai-plan-trip',
      data: {
        tripContext: {
          name: name || '未命名',
          destinations,
          startDate: dates.start,
          endDate: dates.end,
          pax,
        },
        preferences: prefs,
        previousResult,
        userFeedback,
      },
    })
    const plan = r.result && r.result.result
    if (!plan) throw new Error('AI 返回为空')
    setAiPlan(plan as GeneratedPlan)
    setAiPreviewOpen(true)
  } catch (e: any) {
    console.error('[ai-plan-trip]', e)
    Taro.showToast({ title: e.message || 'AI 生成失败', icon: 'none' })
  } finally {
    setAiLoading(false)
  }
}

const handleAiSubmit = (prefs: AIPreferences) => {
  setAiPrefs(prefs)
  setAiFormOpen(false)
  callAI(prefs)
}

const handleAiRegenerate = (feedback: string) => {
  if (!aiPrefs || !aiPlan) return
  callAI(aiPrefs, aiPlan, feedback || '请优化方案')
}

const handleAiApply = async () => {
  if (!aiPlan || !openid) return
  try {
    const input = buildNewTrip({
      name: name || '未命名',
      pax,
      startDate: dates.start,
      endDate: dates.end,
      destinations,
    })
    input.ownerOpenid = openid
    input.days = planToDays(aiPlan)
    const tripId = await createTrip(input)
    setAiPreviewOpen(false)
    Taro.showToast({ title: '已创建', icon: 'success' })
    setTimeout(() => Taro.redirectTo({ url: `/pages/trip/index?id=${tripId}` }), 600)
  } catch (e: any) {
    console.error('[ai apply]', e)
    Taro.showToast({ title: '保存失败', icon: 'none' })
  }
}
```

注意:如果 collab-fixes plan 已经合并并改了 createTrip 调用方式(传 ownerNickname/ownerAvatarUrl),则把对应字段也加上:`input.ownerNickname = me?.nickname || '行册旅人'; input.ownerAvatarUrl = me?.avatarUrl || ''`。检查当前文件是否已有这两行,有就保留,没有就先按上方实现。

- [ ] **Step 4: 加 AI 按钮 + 三个 sheet 渲染**

定位到 return 里的"创建"按钮所在区域。原代码里 submit 按钮通常长这样(具体看现有 JSX):

```tsx
<Button className='nt-submit' disabled={!canSubmit || submitting} onClick={submit}>
  {submitting ? '创建中...' : '创建'}
</Button>
```

把它包成一个 actions 容器,再加 AI 按钮:

```tsx
<View className='nt-actions'>
  <Button className='nt-submit' disabled={!canSubmit || submitting} onClick={submit}>
    {submitting ? '创建中...' : '创建'}
  </Button>
  <Button
    className='nt-submit-ai'
    disabled={!canSubmit}
    onClick={() => setAiFormOpen(true)}
  >
    ✨ AI 帮我规划
  </Button>
</View>
```

(如果现有 JSX 已经把 Button 放在某个容器里, 把那个容器改名为 `nt-actions`,并在 Button 后追加 AI Button)

然后在组件 return 的最外层 View 结尾位置,与其他可能的 modal 同级,追加:

```tsx
<AIPlanForm
  open={aiFormOpen}
  onClose={() => setAiFormOpen(false)}
  onSubmit={handleAiSubmit}
/>
<AILoading open={aiLoading} />
<AIPlanPreview
  open={aiPreviewOpen}
  plan={aiPlan}
  generating={aiLoading}
  onRegenerate={handleAiRegenerate}
  onApply={handleAiApply}
  onClose={() => setAiPreviewOpen(false)}
/>
```

- [ ] **Step 5: 改 scss**

打开 `src/pages/new-trip/index.scss`,在文件末尾追加:

```scss
.nt-actions {
  display: flex;
  flex-direction: column;
  padding: 24rpx;
}
.nt-actions .nt-submit {
  margin-bottom: 16rpx;
}
.nt-submit-ai {
  background: linear-gradient(135deg, #6b46c1 0%, #c43d3d 100%) !important;
  color: white !important;
  font-weight: 600;
  border-radius: 16rpx !important;
}
.nt-submit-ai[disabled] {
  opacity: 0.5;
}
```

(`.nt-submit` 已有样式不影响;`!important` 是覆盖 weapp Button 默认样式;如果已有不同样式,以现有为准微调)

- [ ] **Step 6: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无报错。

- [ ] **Step 7: 提交**

```bash
git add src/pages/new-trip/index.tsx src/pages/new-trip/index.scss
git commit -m "feat(new-trip): AI plan entry with form/loading/preview"
```

---

### Task 14: trip 详情页接入 AI 入口(仅 owner)

**Files:**
- Modify: `src/pages/trip/index.tsx`
- Modify: `src/pages/trip/index.scss`

- [ ] **Step 1: import 段补充**

在现有 import 区追加(具体位置看现有结构,放在 components imports 那一组):

```tsx
import AILoading from '../../components/AILoading'
import AIPlanForm from '../../components/AIPlanForm'
import AIPlanPreview from '../../components/AIPlanPreview'
import type { AIPreferences, GeneratedPlan } from '../../types/trip'
import { planToDays } from '../../utils/trip-helpers'
import { updateTrip } from '../../utils/db'
```

(`updateTrip` 已 export,核对 src/utils/db.ts 确认。`Taro` 也已 import,无需重复)

- [ ] **Step 2: 在 TripBody 组件内部加状态 + 处理函数**

定位 `function TripBody()` 内部。在现有 useState 同级追加:

```tsx
const [aiFormOpen, setAiFormOpen] = useState(false)
const [aiLoading, setAiLoading] = useState(false)
const [aiPlan, setAiPlan] = useState<GeneratedPlan | null>(null)
const [aiPreviewOpen, setAiPreviewOpen] = useState(false)
const [aiPrefs, setAiPrefs] = useState<AIPreferences | null>(null)
```

接着加处理函数(放在已有的事件 handler 同区):

```tsx
const callAI = async (prefs: AIPreferences, previousResult?: GeneratedPlan, userFeedback?: string) => {
  if (!t) return
  setAiLoading(true)
  try {
    const r: any = await Taro.cloud.callFunction({
      name: 'ai-plan-trip',
      data: {
        tripContext: {
          name: t.name,
          destinations: t.destinations,
          startDate: t.startDate,
          endDate: t.endDate,
          pax: t.pax,
        },
        preferences: prefs,
        previousResult,
        userFeedback,
      },
    })
    const plan = r.result && r.result.result
    if (!plan) throw new Error('AI 返回为空')
    setAiPlan(plan as GeneratedPlan)
    setAiPreviewOpen(true)
  } catch (e: any) {
    console.error('[ai-plan-trip]', e)
    Taro.showToast({ title: e.message || 'AI 生成失败', icon: 'none' })
  } finally {
    setAiLoading(false)
  }
}

const handleAiSubmit = (prefs: AIPreferences) => {
  setAiPrefs(prefs)
  setAiFormOpen(false)
  callAI(prefs)
}

const handleAiRegenerate = (feedback: string) => {
  if (!aiPrefs || !aiPlan) return
  callAI(aiPrefs, aiPlan, feedback || '请优化方案')
}

const handleAiApply = async () => {
  if (!t || !aiPlan) return
  const confirm = await Taro.showModal({
    title: '应用 AI 方案?',
    content: '这将覆盖当前所有 days',
    confirmText: '应用',
    confirmColor: '#c43d3d',
  })
  if (!confirm.confirm) return
  try {
    await updateTrip(t._id, { days: planToDays(aiPlan) }, openid)
    setAiPreviewOpen(false)
    Taro.showToast({ title: '已应用', icon: 'success' })
  } catch (e: any) {
    console.error('[ai apply]', e)
    Taro.showToast({ title: '保存失败', icon: 'none' })
  }
}

const handleAiOpen = () => {
  if (!isOwner) return
  setAiFormOpen(true)
}
```

- [ ] **Step 3: 在 trip-head 区加 AI 按钮**

定位到 trip-head 块,大致是:

```tsx
<View className='trip-head'>
  <View className='th-row'>
    <Text className='th-name'>{t.name}</Text>
    <View className='th-menu' onClick={() => setActionOpen(true)}>⋯</View>
  </View>
  ...
</View>
```

在 `<View className='th-menu'>` 后面、还在 `th-row` 内,加 AI 按钮(仅 owner 显示):

```tsx
{isOwner && (
  <View className='th-ai-btn' onClick={handleAiOpen}>✨ AI</View>
)}
```

(放在菜单按钮旁边)

- [ ] **Step 4: 三个 sheet 渲染**

在 TripBody return 的最外层 View 结尾,与其他 ActionSheet/ShareTypeSheet 同级,追加:

```tsx
<AIPlanForm
  open={aiFormOpen}
  onClose={() => setAiFormOpen(false)}
  onSubmit={handleAiSubmit}
/>
<AILoading open={aiLoading} />
<AIPlanPreview
  open={aiPreviewOpen}
  plan={aiPlan}
  generating={aiLoading}
  onRegenerate={handleAiRegenerate}
  onApply={handleAiApply}
  onClose={() => setAiPreviewOpen(false)}
/>
```

- [ ] **Step 5: 改 scss**

打开 `src/pages/trip/index.scss`,在文件末尾追加:

```scss
.th-ai-btn {
  margin-left: 16rpx;
  padding: 8rpx 16rpx;
  font-size: 22rpx;
  font-weight: 600;
  border-radius: 12rpx;
  background: linear-gradient(135deg, #6b46c1 0%, #c43d3d 100%);
  color: white;
  letter-spacing: 1rpx;
}
```

- [ ] **Step 6: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无报错。

- [ ] **Step 7: 提交**

```bash
git add src/pages/trip/index.tsx src/pages/trip/index.scss
git commit -m "feat(trip): AI re-plan entry for owner"
```

---

### Task 15: 手动验证

**Files:** 无改动。

- [ ] **Step 1: 配置云函数环境变量 + 上传(若 Task 9 没做)**

参照 Task 9 Step 2 步骤,在微信开发者工具中:
1. 上传 ai-plan-trip 云函数(云端安装依赖)
2. 云控制台为该云函数配置环境变量:
   - `LLM_PROVIDER=mimo`
   - `LLM_MODEL=mimo-v2-pro`(或用户给的实际型号)
   - `MIMO_API_KEY=<key>`
   - `BOCHA_API_KEY=<key>`
3. 高级配置 → 超时 60s
4. 重新部署一次让环境变量生效

- [ ] **Step 2: 启动 dev**

Run: `npm run dev:weapp`
Expected: 编译成功。

- [ ] **Step 3: 主入口验证(新建 trip)**

打开小程序 → 新建攻略 → 填:
- 攻略名: "杭州 3 日"
- 日期: 任意未来 3 天
- 目的地: 添加"杭州"
- 人数: 2

点 "✨ AI 帮我规划" → 偏好表单弹出。
- 节奏: 悠闲
- 出行人群: 情侣
- 预算上限: 800
- 其他偏好: "喜欢拍照、想去小众地方"

点"开始生成" → loading 蒙层显示 → 等 10-30s。

Expected:
- loading 文案随时间切换(0-5s 构思 / 5-15s 查询 / 15+ 整理)
- 拿到预览 sheet → 3 个 day,每个 day 3-6 个 spot
- 大多数 spot 有 note 和 price
- 顶部没有"未定位"警告(或最多 1-2 个)

- [ ] **Step 4: 重新生成验证**

在预览 sheet 文本框写"第二天太赶,改悠闲点" → 点"重新生成"。

Expected:
- 蒙层重新显示
- 拿到新方案,第二天的 spots 看上去更少/更紧凑
- 文本框清空

- [ ] **Step 5: 应用验证**

点"应用" → toast"已创建" → 跳到 trip 详情。

Expected:
- ItineraryView 显示 3 个 day,每个 day 有生成的 spots
- 切到地图 tab → 大多数 spot 有 marker
- 切到开销 tab → 有 price 汇总

- [ ] **Step 6: trip 详情页 AI 重新规划**

在 trip 详情页 → trip-head 看到"✨ AI"按钮(右上角附近) → 点 → 偏好表单 → 提交 → loading → 预览 → 点应用 → modal 确认覆盖 → toast"已应用"。

Expected:
- ItineraryView 内容被覆盖为新方案
- 协作者视角(用账号 B 进入同一 trip): 看不到"✨ AI"按钮

- [ ] **Step 7: 错误降级**

(a) 临时把云控制台 `BOCHA_API_KEY` 删掉 → 重新部署 → 再次生成。
Expected: 仍然能生成,只是没有 web_search 灵感(LLM 用自己的知识写),完成流程通畅。

(b) 临时把 `MIMO_API_KEY` 设成错的 → 再次生成。
Expected: toast "AI 服务暂不可用" 或 "LLM HTTP 401"。

完成后记得恢复正确 key。

- [ ] **Step 8: 边界测试**

- 跑一次只有"出行人群"勾选 / 无预算 / 无自由文本 的最简生成 → 应该正常
- 跑一次极长 freeText (≥150 字) → 应该正常
- 跑一次 destinations 为空但点了 AI → 由于 canSubmit=false 按钮 disabled,点不动(说明 UI 兜底正确)

- [ ] **Step 9: 失败时回去修对应 Task → 重新走通该验证 → 然后继续。**

- [ ] **Step 10: 最终 push**

```bash
git status
# 应该 clean
git push -u origin claude/install-superpowers-skill-8d88r
```

---

## 自检要点

1. **wxcloud node 版本**: 云函数默认 Node 12/14/16,async/await/Promise.all 都 OK。axios 1.x 兼容
2. **wx-server-sdk callFunction**: 在云函数内部跨调云函数已支持,免鉴权
3. **环境变量更新需要重新部署**: 改了变量必须点"重新部署"
4. **博查 API 路径**: 文档可能用 `/v1/web-search` 或别的,实施时若 404 自己调整 endpoint 字串
5. **MiMo 实际模型名**: 用户告知后填到 `LLM_MODEL`;若不传走默认 `mimo-v2-pro`,如果该名不存在云函数会报错
6. **OpenAI tool_calls 结构 quirk**: assistant 消息回填时必须带 `tool_calls` 字段,顺序 assistant → tool → tool... → 下一轮 assistant。Task 9 代码已正确处理
7. **响应过大时 message history 超 token**: tools 返回的 web_search 摘要可能很长,实测如果触发 token 上限,降低 `count` 或截断 summary
8. **多次 _unresolved 是正常的**: 小众餐厅、新开酒店高德可能没收录,UI 已经有降级显示
