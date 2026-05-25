# AI 行程生成 Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户在"新建 trip"或"trip 详情页"点 "AI 帮我规划",选模型(MiMo-V2.5 / DeepSeek-V4-PRO / DeepSeek-V4-Flash)+ 填偏好,LLM 通过 agent loop(高德 POI + 博查 web 搜索)异步生成行程。客户端实时订阅生成进度,可关页面继续后台跑。预览阶段可逐日勾选要应用的天。

**Architecture:**
- 单云函数 `ai-plan-trip` + `_mode` 路由('start' / 'run'):start 模式插任务记录 + fire-and-forget 自调用 worker;run 模式跑 agent loop,逐天写入任务记录。
- 客户端 `wx.cloud.callFunction` 立刻拿到 `taskId`,`db.collection('ai_tasks').doc(taskId).watch()` 订阅进度。
- 关页面不影响后台生成;再次进入若发现进行中或未应用的 task,弹回预览。
- POI 坐标由 LLM 直接从 `search_poi` 工具结果里抄到输出 JSON,无后置 grounding 阶段。

**Tech Stack:** Taro + React + 微信云开发;LLM:MiMo + DeepSeek(OpenAI 兼容 function calling);web 搜索:博查 API;HTTP 客户端:axios(amap-poi-search 已用)。

参考 spec: `docs/superpowers/specs/2026-05-21-ai-plan-trip-phase-a-design.md`

---

## 与其他 plan 的关系

正在排队的两个 plan 也修改同样的页面文件:
- `docs/superpowers/plans/2026-05-21-map-view.md` 改 `src/pages/trip/index.tsx`(加 map tab)
- `docs/superpowers/plans/2026-05-21-collaboration-fixes.md` 改 `src/pages/trip/index.tsx`(CollaboratorsBar)和 `src/pages/new-trip/index.tsx`(useMe)

本 plan 改:
- `src/pages/trip/index.tsx` 增加"AI 重新规划"按钮 + AI 相关状态 + 三个 sheet(owner 视角)
- `src/pages/new-trip/index.tsx` 增加"AI 帮我规划"按钮 + AI 相关状态 + 三个 sheet

改动区域与前两个 plan 不重叠;三个 plan 串行无冲突。

---

## 文件结构

| 路径 | 操作 | 责任 |
| --- | --- | --- |
| `src/types/trip.ts` | 改 | `GeneratedSpot/Day/Plan`、`AIPreferences`、`AIModelAlias`、`AITask` |
| `src/utils/trip-helpers.ts` | 改 | `planDayToDay()`、`mergePlanIntoDays()` |
| `cloudfunctions/ai-plan-trip/package.json` | 新 | wx-server-sdk + axios |
| `cloudfunctions/ai-plan-trip/config.json` | 新 | timeout=60, memorySize=256 |
| `cloudfunctions/ai-plan-trip/index.js` | 新 | 入口 + `_mode` 路由 + agent loop |
| `cloudfunctions/ai-plan-trip/lib/llm.js` | 新 | provider/model alias 映射, callChat() |
| `cloudfunctions/ai-plan-trip/lib/prompts.js` | 新 | system + user prompt |
| `cloudfunctions/ai-plan-trip/lib/tools.js` | 新 | `search_poi`(回 lat/lng)、`web_search` |
| `cloudfunctions/ai-plan-trip/lib/validate.js` | 新 | `validatePlan()` |
| `cloudfunctions/ai-plan-trip/lib/task-store.js` | 新 | 任务记录读写封装 |
| `src/utils/ai-task.ts` | 新 | client 侧封装:startAITask + watchAITask |
| `src/components/AILoading/index.tsx` | 新 | 任务进度蒙层(可关闭) |
| `src/components/AILoading/index.scss` | 新 | |
| `src/components/AIPlanForm/index.tsx` | 新 | 偏好表单 + 模型选择 |
| `src/components/AIPlanForm/index.scss` | 新 | |
| `src/components/AIPlanPreview/index.tsx` | 新 | 预览 sheet + 逐日勾选 + 应用 |
| `src/components/AIPlanPreview/index.scss` | 新 | |
| `src/pages/new-trip/index.tsx` | 改 | AI 入口 + 状态 + 三个 sheet |
| `src/pages/new-trip/index.scss` | 改 | 按钮样式 |
| `src/pages/trip/index.tsx` | 改 | AI 入口(owner) + 状态 + 三个 sheet |
| `src/pages/trip/index.scss` | 改 | 按钮样式 |

manual(非代码):
- 申请博查 API key (https://open.bochaai.com/)
- 微信云控制台 → 数据库 → 新建集合 `ai_tasks`,权限设为"仅创建者可读写"
- 微信云控制台 → 云函数 ai-plan-trip → 环境变量:
  - `MIMO_API_KEY=<key>`
  - `MIMO_ENDPOINT=<MiMo 实际 endpoint>` (例 `https://api.xiaomimimo.com/v1/chat/completions`)
  - `MIMO_MODEL=<MiMo 实际模型名>`
  - `DEEPSEEK_API_KEY=<key>`
  - `DEEPSEEK_PRO_MODEL=<DeepSeek pro 模型名>` (例 `deepseek-chat`)
  - `DEEPSEEK_FLASH_MODEL=<DeepSeek flash 模型名>` (例 `deepseek-flash`)
  - `BOCHA_API_KEY=<key>`
- 超时已在 `config.json` 写为 60s,部署即生效;无需手动改云控制台
- 动手前先与用户确认:MiMo 真实 endpoint、MiMo 模型名、DeepSeek PRO/Flash 实际模型名,否则首次调用必报错

---

### Task 1: 类型定义

**Files:**
- Modify: `src/types/trip.ts`

- [ ] **Step 1: 在文件末尾追加新类型**

```ts
// === AI 行程生成相关类型 ===

export type AIPace = '悠闲' | '平衡' | '紧凑'
export type AIAudience = '独行' | '情侣' | '亲子' | '老人' | '朋友'

// 前端展示给用户的模型 alias;server 端映射到真实 provider + model
export type AIModelAlias = 'MiMo-V2.5' | 'DeepSeek-V4-PRO' | 'DeepSeek-V4-Flash'
export const AI_MODEL_ALIASES: AIModelAlias[] = ['MiMo-V2.5', 'DeepSeek-V4-PRO', 'DeepSeek-V4-Flash']

export interface AIPreferences {
  pace: AIPace
  audience: AIAudience[]
  budgetCap?: number          // 人均/天 RMB
  freeText?: string
  modelAlias: AIModelAlias    // 必填, 默认 'MiMo-V2.5'
}

// 注意: 必须复用现有 SpotType ('spot' | 'hotel' | 'meal' | 'transport')。
// 不要新增 'arrive' 等类型, 否则 ItineraryView/MapView 不识别会渲染异常。
// 抵达/出发用 type='transport' 表达。
export interface GeneratedSpot {
  type: SpotType
  name: string
  city: string
  note?: string
  price?: number
  time?: string               // 'HH:mm'
  lat?: number                // LLM 从 search_poi 工具结果抄过来; 无则前端标记 _unresolved
  lng?: number
  adcode?: string
  _unresolved?: boolean       // 缺 lat/lng 时由 client 端预览标记
}

export interface GeneratedDay {
  date: string                // 'YYYY-MM-DD'
  spots: GeneratedSpot[]
}

export interface GeneratedPlan {
  days: GeneratedDay[]
}

// 异步任务记录(对应 cloud db 集合 ai_tasks)
export type AITaskStatus = 'pending' | 'streaming' | 'done' | 'error'

export interface AITask {
  _id: string
  _openid: string
  tripId?: string             // 详情页发起带, 新建页不带
  status: AITaskStatus
  progress?: GeneratedPlan    // 增量结果, 每生成完 1 天追加
  result?: GeneratedPlan      // 最终结果
  error?: string
  modelAlias: AIModelAlias
  tripContext: any            // 提交时的 tripContext 副本(便于复现)
  preferences: AIPreferences
  meta?: {
    elapsedMs?: number
    promptTokens?: number
    completionTokens?: number
    turns?: number
  }
  createdAt: number
  updatedAt: number
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add src/types/trip.ts
git commit -m "feat(types): AI plan generation + async task types"
```

---

### Task 2: helpers — planDayToDay / mergePlanIntoDays

**Files:**
- Modify: `src/utils/trip-helpers.ts`

- [ ] **Step 1: 把 `GeneratedDay / GeneratedPlan` 加进现有 import 行**

现有:
```ts
import type { Day, NewTripInput, Destination } from '../types/trip'
```
改为:
```ts
import type { Day, NewTripInput, Destination, GeneratedDay, GeneratedPlan } from '../types/trip'
```

- [ ] **Step 2: 在文件末尾追加函数**

```ts
/**
 * 把一个 LLM 生成的 day 转成 Trip.days 形态(补 id, 丢掉 _unresolved 标记)。
 */
export function planDayToDay(gd: GeneratedDay): Day {
  return {
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
  }
}

/**
 * 按用户勾选的日期, 把 AI 生成的对应天合并进原 days 数组。
 * - existing 中未被选中的天保持不变
 * - 选中的天用 AI 版本替换(按 date 匹配)
 * - 若 AI 给的日期在 existing 中不存在(不该发生), 忽略
 */
export function mergePlanIntoDays(
  existing: Day[],
  plan: GeneratedPlan,
  selectedDates: string[],
): Day[] {
  const selectedSet = new Set(selectedDates)
  const aiByDate = new Map<string, GeneratedDay>()
  for (const gd of plan.days) aiByDate.set(gd.date, gd)

  return existing.map(d => {
    if (!selectedSet.has(d.date)) return d
    const gd = aiByDate.get(d.date)
    if (!gd) return d
    const replaced = planDayToDay(gd)
    // 保留原 day 的 id 和 weather, 只替换 spots
    return { ...d, spots: replaced.spots }
  })
}
```

- [ ] **Step 3: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/utils/trip-helpers.ts
git commit -m "feat(helpers): planDayToDay + mergePlanIntoDays"
```

---

### Task 3: 云函数 package.json + config.json

**Files:**
- Create: `cloudfunctions/ai-plan-trip/package.json`
- Create: `cloudfunctions/ai-plan-trip/config.json`

- [ ] **Step 1: package.json**

```json
{
  "name": "ai-plan-trip",
  "version": "1.0.0",
  "description": "AI itinerary generation with agent loop (async)",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~3.0.0",
    "axios": "^1.7.0"
  }
}
```

(版本号与 `cloudfunctions/amap-poi-search/package.json` 对齐 —— 已确认它用 `wx-server-sdk@~3.0.0` 和 `axios@^1.7.0`)

- [ ] **Step 2: config.json**

```json
{
  "timeout": 60,
  "memorySize": 256
}
```

- [ ] **Step 3: 提交**

```bash
git add cloudfunctions/ai-plan-trip/package.json cloudfunctions/ai-plan-trip/config.json
git commit -m "feat(cloudfn): scaffold ai-plan-trip (60s timeout)"
```

---

### Task 4: lib/llm.js — 模型 alias 映射 + callChat

**Files:**
- Create: `cloudfunctions/ai-plan-trip/lib/llm.js`

- [ ] **Step 1: 写文件**

```js
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
```

- [ ] **Step 2: 提交**

```bash
git add cloudfunctions/ai-plan-trip/lib/llm.js
git commit -m "feat(ai-plan): model alias mapping + callChat"
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
- web_search(query): 搜互联网攻略/博主/季节性活动, 返回标题+摘要。

【工具使用指导】
- 不熟悉的目的地 / 想要差异化推荐 → 先 web_search 拿灵感
- 任何地点写入最终 JSON 前 → 必须用 search_poi 拿到 lat/lng, 然后把工具返回的 lat/lng/adcode 原样抄进 Spot 字段
- 编造坐标 = 严重错误。不确定就用工具。
- 一次生成 web_search 用 1-3 次, search_poi 按需调用(每个写入的 spot 都需要)
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
git commit -m "feat(ai-plan): prompts (instruct LLM to copy lat/lng from tool)"
```

---

### Task 6: lib/validate.js

**Files:**
- Create: `cloudfunctions/ai-plan-trip/lib/validate.js`

- [ ] **Step 1: 写文件**

```js
const VALID_TYPES = ['spot', 'hotel', 'meal', 'transport']

function expectedDates(startDate, endDate) {
  const out = []
  const s = new Date(startDate + 'T00:00:00')
  const e = new Date(endDate + 'T00:00:00')
  for (let cur = s.getTime(); cur <= e.getTime(); cur += 86400000) {
    const d = new Date(cur)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    out.push(`${d.getFullYear()}-${m}-${day}`)
  }
  return out
}

function inChinaBox(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number'
    && lat >= 3 && lat <= 54 && lng >= 73 && lng <= 136
}

function validatePlan(obj, tripContext) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: '不是对象' }
  if (!Array.isArray(obj.days)) return { ok: false, error: '缺少 days 数组' }

  const expectedSeq = expectedDates(tripContext.startDate, tripContext.endDate)
  if (obj.days.length !== expectedSeq.length) {
    return { ok: false, error: `days 数量 ${obj.days.length}, 应为 ${expectedSeq.length}` }
  }

  for (let i = 0; i < obj.days.length; i++) {
    const d = obj.days[i]
    if (!d.date || typeof d.date !== 'string') {
      return { ok: false, error: `days[${i}].date 缺失或非字符串` }
    }
    if (d.date !== expectedSeq[i]) {
      return { ok: false, error: `days[${i}].date=${d.date}, 应为 ${expectedSeq[i]}` }
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
      // 坐标 sanity: 有就必须落在中国范围, 否则视为幻觉, 抹掉
      if (s.lat != null || s.lng != null) {
        if (!inChinaBox(s.lat, s.lng)) {
          delete s.lat; delete s.lng; delete s.adcode
        }
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
git commit -m "feat(ai-plan): plan schema validator with coord sanity"
```

---

### Task 7: lib/tools.js — search_poi 返回 lat/lng

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
```

- [ ] **Step 2: 提交**

```bash
git add cloudfunctions/ai-plan-trip/lib/tools.js
git commit -m "feat(ai-plan): tools (search_poi returns coords, web_search)"
```

---

### Task 8: lib/task-store.js — 任务记录读写

**Files:**
- Create: `cloudfunctions/ai-plan-trip/lib/task-store.js`

- [ ] **Step 1: 写文件**

```js
const cloud = require('wx-server-sdk')

const COL = 'ai_tasks'

async function createTask({ openid, tripId, modelAlias, tripContext, preferences }) {
  const db = cloud.database()
  const now = Date.now()
  const res = await db.collection(COL).add({
    data: {
      _openid: openid,
      tripId: tripId || null,
      status: 'pending',
      modelAlias,
      tripContext,
      preferences,
      progress: { days: [] },
      result: null,
      error: null,
      meta: { turns: 0 },
      createdAt: now,
      updatedAt: now,
    },
  })
  return res._id
}

async function updateTask(taskId, patch) {
  const db = cloud.database()
  await db.collection(COL).doc(taskId).update({
    data: { ...patch, updatedAt: Date.now() },
  })
}

async function getTask(taskId) {
  const db = cloud.database()
  const r = await db.collection(COL).doc(taskId).get().catch(() => null)
  return r && r.data ? r.data : null
}

module.exports = { createTask, updateTask, getTask, COL }
```

- [ ] **Step 2: 微信云控制台手动建集合 + 设权限**

数据库 → 新建集合 `ai_tasks` → 权限设置:
- 读: 仅创建者可读(_openid 匹配)
- 写: 仅创建者可读写

(云函数内部走 admin 身份不受此限制;前端订阅时受此限制,正好满足"用户只能看自己任务"的需求)

- [ ] **Step 3: 提交**

```bash
git add cloudfunctions/ai-plan-trip/lib/task-store.js
git commit -m "feat(ai-plan): ai_tasks store wrapper"
```

---

### Task 9: index.js — `_mode` 路由 + agent loop

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
```

> **注**: 当前实现是"先一次性拿完 LLM 结果, 再逐天 update 模拟流式"。真正的 token-level streaming 需要 axios 改 `responseType: 'stream'` + 解析 SSE, Phase A 不做。逐天 update 足以让客户端看到"Day 1 出来了 → Day 2 出来了"的体验。

- [ ] **Step 2: 上传云函数(manual)**

微信开发者工具:
1. 右键 `cloudfunctions/ai-plan-trip` → "上传并部署: 云端安装依赖"
2. 等待依赖安装
3. 云控制台 → ai-plan-trip → 环境变量,添加所有 manual 段列出的 key
4. 不需要手动改超时(已在 config.json)
5. 改完环境变量重新部署一次让其生效

若当下不能操作 IDE,记到 todo,Task 16(验证)统一做。

- [ ] **Step 3: 提交**

```bash
git add cloudfunctions/ai-plan-trip/index.js
git commit -m "feat(ai-plan): main entry with _mode routing (async self-trigger)"
```

---

### Task 10: client 侧 ai-task 封装

**Files:**
- Create: `src/utils/ai-task.ts`

- [ ] **Step 1: 写文件**

```ts
import Taro from '@tarojs/taro'
import type { AITask, AIPreferences, GeneratedPlan } from '../types/trip'

interface StartParams {
  tripContext: {
    name: string
    destinations: any[]
    startDate: string
    endDate: string
    pax: number
  }
  preferences: AIPreferences
  tripId?: string
  previousResult?: GeneratedPlan
  userFeedback?: string
}

export async function startAITask(p: StartParams): Promise<string> {
  const r: any = await (Taro as any).cloud.callFunction({
    name: 'ai-plan-trip',
    data: { _mode: 'start', ...p },
  })
  const taskId = r && r.result && r.result.taskId
  if (!taskId) throw new Error('启动 AI 任务失败')
  return taskId
}

export interface TaskWatcher {
  close: () => void
}

/**
 * 订阅一条 ai_tasks 记录。onChange 会在任务 update 时被调用。
 * 返回的 watcher.close() 用来取消订阅。
 */
export function watchAITask(taskId: string, onChange: (t: AITask) => void): TaskWatcher {
  const db = (Taro as any).cloud.database()
  // 注意: 用 .where({_id}) 而非 .doc().watch(), 兼容性更稳, 也是官方文档推荐写法
  const watcher = db.collection('ai_tasks').where({ _id: taskId }).watch({
    onChange: (snap: any) => {
      if (snap && snap.docs && snap.docs[0]) onChange(snap.docs[0] as AITask)
    },
    onError: (err: any) => console.error('[watchAITask]', err),
  })
  return { close: () => { try { watcher.close() } catch (_) {} } }
}

/** 兜底:任务 > 10s 仍 pending 视为失败 */
export const PENDING_TIMEOUT_MS = 10000
```

- [ ] **Step 2: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/utils/ai-task.ts
git commit -m "feat(client): ai-task client wrapper (start + watch)"
```

---

### Task 11: AILoading 组件(可关闭, 跟随任务状态)

**Files:**
- Create: `src/components/AILoading/index.tsx`
- Create: `src/components/AILoading/index.scss`

- [ ] **Step 1: index.tsx**

```tsx
import { View, Text } from '@tarojs/components'
import type { AITaskStatus } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  status: AITaskStatus
  doneCount: number       // 已生成天数(由 progress.days.length)
  totalDays: number       // 期望总天数
  onClose: () => void     // 关闭蒙层(任务继续后台跑)
  elapsedSec: number      // 已用时
}

export default function AILoading({ open, status, doneCount, totalDays, onClose, elapsedSec }: Props) {
  if (!open) return null

  const label = status === 'pending'
    ? '排队中…'
    : doneCount > 0
      ? `已生成 Day ${doneCount} / ${totalDays}`
      : '正在构思…'

  return (
    <View className='ail-mask'>
      <View className='ail-card'>
        <View className='ail-spinner' />
        <Text className='ail-text'>{label}</Text>
        <Text className='ail-elapsed'>{elapsedSec}s · 可关闭页面, 后台继续生成</Text>
        <View className='ail-close' onClick={onClose}>关闭蒙层(继续后台跑)</View>
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
  min-width: 420rpx;
}
.ail-spinner {
  width: 64rpx; height: 64rpx;
  border: 4rpx solid rgba(0,0,0,0.15);
  border-top-color: var(--ink, #2c2c2c);
  border-radius: 50%;
  animation: ail-spin 1s linear infinite;
  margin-bottom: 24rpx;
}
@keyframes ail-spin { to { transform: rotate(360deg); } }
.ail-text { font-size: 30rpx; font-weight: 600; margin-bottom: 8rpx; }
.ail-elapsed { font-size: 22rpx; opacity: 0.6; margin-bottom: 24rpx; }
.ail-close {
  font-size: 24rpx;
  padding: 12rpx 24rpx;
  border: 2rpx solid currentColor;
  border-radius: 24rpx;
  opacity: 0.7;
}
```

- [ ] **Step 3: 提交**

```bash
git add src/components/AILoading/
git commit -m "feat(component): AILoading mask (closeable, follows task status)"
```

---

### Task 12: AIPlanForm 组件(含模型选择)

**Files:**
- Create: `src/components/AIPlanForm/index.tsx`
- Create: `src/components/AIPlanForm/index.scss`

- [ ] **Step 1: index.tsx**

```tsx
import { useState } from 'react'
import { View, Text, Input, Textarea } from '@tarojs/components'
import type { AIPace, AIAudience, AIPreferences, AIModelAlias } from '../../types/trip'
import { AI_MODEL_ALIASES } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  onSubmit: (prefs: AIPreferences) => void
  onClose: () => void
}

const PACES: AIPace[] = ['悠闲', '平衡', '紧凑']
const AUDIENCES: AIAudience[] = ['独行', '情侣', '亲子', '老人', '朋友']

export default function AIPlanForm({ open, onSubmit, onClose }: Props) {
  const [model, setModel] = useState<AIModelAlias>('MiMo-V2.5')
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
      modelAlias: model,
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
          <Text className='aif-label'>模型</Text>
          <View className='aif-chips'>
            {AI_MODEL_ALIASES.map(m => (
              <View
                key={m}
                className={`aif-chip ${model === m ? 'on' : ''}`}
                onClick={() => setModel(m)}
              >{m}</View>
            ))}
          </View>
        </View>

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
.aif-title { font-size: 34rpx; font-weight: 700; margin-bottom: 24rpx; }
.aif-field { margin-bottom: 24rpx; }
.aif-label { font-size: 26rpx; opacity: 0.7; display: block; margin-bottom: 12rpx; }
.aif-chips { display: flex; flex-wrap: wrap; }
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
.aif-input, .aif-textarea {
  width: 100%;
  padding: 16rpx 20rpx;
  background: rgba(0,0,0,0.05);
  border-radius: 12rpx;
  box-sizing: border-box;
}
.aif-input { font-size: 28rpx; }
.aif-textarea { height: 120rpx; font-size: 26rpx; }
.aif-actions { display: flex; margin-top: 24rpx; }
.aif-btn-cancel, .aif-btn-submit {
  flex: 1;
  text-align: center;
  padding: 22rpx 0;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 16rpx;
}
.aif-btn-cancel { margin-right: 16rpx; background: rgba(0,0,0,0.08); }
.aif-btn-submit { background: var(--ink, #2c2c2c); color: var(--bg, #f7f1e3); }
```

- [ ] **Step 3: 提交**

```bash
git add src/components/AIPlanForm/
git commit -m "feat(component): AIPlanForm with model picker"
```

---

### Task 13: AIPlanPreview 组件(逐日勾选)

**Files:**
- Create: `src/components/AIPlanPreview/index.tsx`
- Create: `src/components/AIPlanPreview/index.scss`

- [ ] **Step 1: index.tsx**

```tsx
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Textarea } from '@tarojs/components'
import type { GeneratedPlan, GeneratedSpot, AITaskStatus } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  plan: GeneratedPlan | null     // 可以是 progress(部分天数)或 result
  status: AITaskStatus           // 'streaming' 时禁用"应用"
  generating: boolean            // true 时禁用按钮(用于重新生成时)
  onRegenerate: (feedback: string) => void
  onApply: (selectedDates: string[]) => void
  onClose: () => void
}

const TYPE_LABEL: Record<string, string> = {
  spot: '景', hotel: '宿', meal: '食', transport: '行',
}

function unresolvedCount(plan: GeneratedPlan): number {
  let n = 0
  for (const d of plan.days) for (const s of d.spots) {
    if (s.lat == null || s.lng == null) n++
  }
  return n
}

export default function AIPlanPreview({
  open, plan, status, generating, onRegenerate, onApply, onClose,
}: Props) {
  const [feedback, setFeedback] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // 当 plan 的日期集合变化时, 默认全选所有"已生成的天"
  const planDateKey = plan ? plan.days.map(d => d.date).join(',') : ''
  useEffect(() => {
    if (!plan) { setSelected(new Set()); return }
    setSelected(new Set(plan.days.map(d => d.date)))
  }, [planDateKey])

  if (!open || !plan) return null

  const unres = unresolvedCount(plan)
  const canApply = status === 'done' && selected.size > 0 && !generating

  const toggle = (date: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date); else next.add(date)
      return next
    })
  }

  return (
    <View className='aip-mask' onClick={onClose}>
      <View className='aip-sheet' catchMove onClick={(e) => e.stopPropagation()}>
        <View className='aip-header'>
          <Text className='aip-title'>
            AI 方案 {status === 'streaming' ? '· 生成中…' : status === 'done' ? '' : ''}
          </Text>
          <Text className='aip-close' onClick={onClose}>✕</Text>
        </View>

        {unres > 0 && (
          <View className='aip-warn'>
            有 {unres} 个地点未给出坐标, 应用后可手动调整
          </View>
        )}

        <ScrollView scrollY className='aip-body'>
          {plan.days.map((d, di) => {
            const on = selected.has(d.date)
            return (
              <View key={`d-${d.date}`} className='aip-day'>
                <View className='aip-day-head' onClick={() => toggle(d.date)}>
                  <View className={`aip-check ${on ? 'on' : ''}`}>{on ? '✓' : ''}</View>
                  <Text className='aip-day-title'>Day {di + 1} · {d.date}</Text>
                </View>
                {d.spots.map((s: GeneratedSpot, si) => {
                  const noCoord = s.lat == null || s.lng == null
                  return (
                    <View
                      key={`s-${d.date}-${si}`}
                      className={`aip-spot ${noCoord ? 'unresolved' : ''}`}
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
                  )
                })}
              </View>
            )
          })}
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
            className={`aip-btn-apply ${canApply ? '' : 'disabled'}`}
            onClick={() => canApply && onApply(Array.from(selected))}
          >应用 {selected.size > 0 ? `(${selected.size} 天)` : ''}</View>
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
.aip-body { flex: 1; min-height: 200rpx; max-height: 56vh; }
.aip-day { margin-bottom: 20rpx; }
.aip-day-head {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
  padding: 8rpx 0;
}
.aip-check {
  width: 36rpx; height: 36rpx;
  border: 2rpx solid currentColor;
  border-radius: 8rpx;
  margin-right: 16rpx;
  text-align: center;
  line-height: 36rpx;
  font-size: 24rpx;
  opacity: 0.5;
}
.aip-check.on {
  background: var(--ink, #2c2c2c);
  color: var(--bg, #f7f1e3);
  opacity: 1;
  border-color: var(--ink, #2c2c2c);
}
.aip-day-title { font-size: 28rpx; font-weight: 700; }
.aip-spot {
  display: flex;
  align-items: flex-start;
  padding: 12rpx;
  border-radius: 12rpx;
  margin-bottom: 8rpx;
  background: rgba(0,0,0,0.04);
}
.aip-spot.unresolved { background: rgba(0,0,0,0.02); opacity: 0.55; }
.aip-spot-tag {
  display: inline-block;
  width: 48rpx; height: 48rpx; line-height: 48rpx;
  text-align: center;
  border-radius: 999rpx;
  background: var(--ink, #2c2c2c);
  color: var(--bg, #f7f1e3);
  font-size: 22rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
}
.aip-spot-body { flex: 1; display: flex; flex-direction: column; }
.aip-spot-name { font-size: 28rpx; font-weight: 600; }
.aip-spot-time { font-size: 22rpx; opacity: 0.55; margin-top: 4rpx; }
.aip-spot-note { font-size: 24rpx; opacity: 0.7; margin-top: 4rpx; line-height: 1.4; }
.aip-spot-price { font-size: 24rpx; margin-top: 4rpx; }
.aip-feedback { margin-top: 16rpx; }
.aip-feedback-label { font-size: 24rpx; opacity: 0.65; display: block; margin-bottom: 8rpx; }
.aip-feedback-input {
  width: 100%;
  height: 100rpx;
  padding: 12rpx 16rpx;
  background: rgba(0,0,0,0.05);
  border-radius: 12rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}
.aip-actions { display: flex; margin-top: 20rpx; }
.aip-btn-regen, .aip-btn-apply {
  flex: 1;
  text-align: center;
  padding: 22rpx 0;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 16rpx;
}
.aip-btn-regen { margin-right: 16rpx; background: rgba(0,0,0,0.08); }
.aip-btn-apply { background: var(--ink, #2c2c2c); color: var(--bg, #f7f1e3); }
.aip-btn-regen.disabled, .aip-btn-apply.disabled { opacity: 0.4; }
```

- [ ] **Step 3: 提交**

```bash
git add src/components/AIPlanPreview/
git commit -m "feat(component): AIPlanPreview with per-day selection"
```

---

### Task 14: new-trip 接入 AI

**Files:**
- Modify: `src/pages/new-trip/index.tsx`
- Modify: `src/pages/new-trip/index.scss`

- [ ] **Step 1: 补充 imports**

在现有 import 段追加(`planToDays` 这个旧名字不再需要,改用 `planDayToDay` —— 但 new-trip 是"全应用 → 整体新建",所以直接用 plan.days.map):

```tsx
import { useEffect, useRef } from 'react'
import AILoading from '../../components/AILoading'
import AIPlanForm from '../../components/AIPlanForm'
import AIPlanPreview from '../../components/AIPlanPreview'
import type { AIPreferences, AITask, GeneratedPlan } from '../../types/trip'
import { planDayToDay } from '../../utils/trip-helpers'
import { startAITask, watchAITask, PENDING_TIMEOUT_MS, type TaskWatcher } from '../../utils/ai-task'
```

(若现有已 import 部分,合并即可。`useEffect/useRef` 可能已经 import,去重)

- [ ] **Step 2: NewTrip 内追加状态 + watcher 引用**

```tsx
const [aiFormOpen, setAiFormOpen] = useState(false)
const [aiPreviewOpen, setAiPreviewOpen] = useState(false)
const [aiLoadingOpen, setAiLoadingOpen] = useState(false)
const [aiTask, setAiTask] = useState<AITask | null>(null)
const [aiPrefs, setAiPrefs] = useState<AIPreferences | null>(null)
const [aiElapsed, setAiElapsed] = useState(0)
const watcherRef = useRef<TaskWatcher | null>(null)
const elapsedTimerRef = useRef<any>(null)
const pendingTimerRef = useRef<any>(null)
const previewAutoOpenedRef = useRef(false)   // 防止 progress 反复强弹预览
```

- [ ] **Step 3: 加 AI 调用 + 订阅函数**

```tsx
const stopWatch = () => {
  if (watcherRef.current) { watcherRef.current.close(); watcherRef.current = null }
  if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null }
  if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null }
}

const startAi = async (prefs: AIPreferences, previousResult?: GeneratedPlan, userFeedback?: string) => {
  stopWatch()
  setAiPrefs(prefs)
  setAiElapsed(0)
  setAiTask(null)
  setAiLoadingOpen(true)
  setAiPreviewOpen(false)
  previewAutoOpenedRef.current = false
  try {
    const taskId = await startAITask({
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
    })
    elapsedTimerRef.current = setInterval(() => setAiElapsed(e => e + 1), 1000)
    // 独立 setTimeout 兜底: worker 自调用若失败, db 永远不更新, watcher 回调不会触发
    pendingTimerRef.current = setTimeout(() => {
      // 用 setAiTask 的回调读最新值, 避免闭包陈旧
      setAiTask(prev => {
        if (!prev || prev.status === 'pending') {
          stopWatch(); setAiLoadingOpen(false)
          Taro.showToast({ title: 'AI 启动超时, 请重试', icon: 'none' })
        }
        return prev
      })
    }, PENDING_TIMEOUT_MS)

    watcherRef.current = watchAITask(taskId, (t) => {
      setAiTask(t)
      // 首次拿到进度才自动弹预览; 之后用户手动关掉就不再强弹
      if (!previewAutoOpenedRef.current && t.progress && t.progress.days && t.progress.days.length > 0) {
        previewAutoOpenedRef.current = true
        setAiPreviewOpen(true)
      }
      if (t.status === 'done') {
        stopWatch()
        setAiLoadingOpen(false)
        setAiPreviewOpen(true)   // done 时强制再弹一次, 确保用户能看到最终结果
      } else if (t.status === 'error') {
        stopWatch()
        setAiLoadingOpen(false)
        Taro.showToast({ title: t.error || 'AI 生成失败', icon: 'none' })
      }
    })
  } catch (e: any) {
    stopWatch()
    setAiLoadingOpen(false)
    Taro.showToast({ title: e.message || '启动失败', icon: 'none' })
  }
}

const handleAiSubmit = (prefs: AIPreferences) => {
  setAiFormOpen(false)
  startAi(prefs)
}
const handleAiRegenerate = (feedback: string) => {
  if (!aiPrefs || !aiTask || !aiTask.result) return
  startAi(aiPrefs, aiTask.result, feedback || '请优化方案')
}

const handleAiApply = async (selectedDates: string[]) => {
  if (!aiTask || !aiTask.result || !openid) return
  try {
    const plan = aiTask.result
    const input = buildNewTrip({
      name: name || '未命名',
      pax,
      startDate: dates.start,
      endDate: dates.end,
      destinations,
    })
    input.ownerOpenid = openid
    input.ownerNickname = me?.nickname || '行册旅人'
    input.ownerAvatarUrl = me?.avatarUrl || ''
    // 新建场景: 选中的天用 AI, 未选中的天保持 seedDays(空)
    const selectedSet = new Set(selectedDates)
    const aiByDate = new Map(plan.days.map(gd => [gd.date, gd]))
    input.days = input.days.map(d =>
      selectedSet.has(d.date) && aiByDate.has(d.date)
        ? { ...d, spots: planDayToDay(aiByDate.get(d.date)!).spots }
        : d
    )
    const tripId = await createTrip(input)
    setAiPreviewOpen(false)
    Taro.showToast({ title: '已创建', icon: 'success' })
    setTimeout(() => Taro.redirectTo({ url: `/pages/trip/index?id=${tripId}` }), 600)
  } catch (e: any) {
    console.error('[ai apply]', e)
    Taro.showToast({ title: '保存失败', icon: 'none' })
  }
}

// 组件卸载清理订阅
useEffect(() => () => stopWatch(), [])
```

- [ ] **Step 4: JSX —— 加按钮 + 三个 sheet**

定位"创建"按钮所在容器,改为:

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

在 return 最外层 View 结尾追加:

```tsx
<AIPlanForm
  open={aiFormOpen}
  onClose={() => setAiFormOpen(false)}
  onSubmit={handleAiSubmit}
/>
<AILoading
  open={aiLoadingOpen}
  status={aiTask?.status || 'pending'}
  doneCount={aiTask?.progress?.days?.length || 0}
  totalDays={dayjs(dates.end).diff(dayjs(dates.start), 'day') + 1}
  onClose={() => setAiLoadingOpen(false)}
  elapsedSec={aiElapsed}
/>
<AIPlanPreview
  open={aiPreviewOpen}
  plan={(aiTask?.result || aiTask?.progress) || null}
  status={aiTask?.status || 'pending'}
  generating={aiTask?.status === 'streaming' || aiTask?.status === 'pending'}
  onRegenerate={handleAiRegenerate}
  onApply={handleAiApply}
  onClose={() => setAiPreviewOpen(false)}
/>
```

(`dayjs` new-trip 顶部已 import)

- [ ] **Step 5: scss 追加**

```scss
.nt-actions {
  display: flex;
  flex-direction: column;
  padding: 24rpx;
}
.nt-actions .nt-submit { margin-bottom: 16rpx; }
.nt-submit-ai {
  background: linear-gradient(135deg, #6b46c1 0%, #c43d3d 100%) !important;
  color: white !important;
  font-weight: 600;
  border-radius: 16rpx !important;
}
.nt-submit-ai[disabled] { opacity: 0.5; }
```

- [ ] **Step 6: tsc + 提交**

```bash
npx tsc --noEmit
git add src/pages/new-trip/index.tsx src/pages/new-trip/index.scss
git commit -m "feat(new-trip): AI plan entry with async task subscription"
```

---

### Task 15: trip 详情页接入 AI(owner only, 逐日合并)

**Files:**
- Modify: `src/pages/trip/index.tsx`
- Modify: `src/pages/trip/index.scss`

- [ ] **Step 1: imports**

```tsx
import { useEffect, useRef } from 'react'
import AILoading from '../../components/AILoading'
import AIPlanForm from '../../components/AIPlanForm'
import AIPlanPreview from '../../components/AIPlanPreview'
import type { AIPreferences, AITask, GeneratedPlan } from '../../types/trip'
import { mergePlanIntoDays } from '../../utils/trip-helpers'
import { startAITask, watchAITask, PENDING_TIMEOUT_MS, type TaskWatcher } from '../../utils/ai-task'
import { updateTrip } from '../../utils/db'
```

- [ ] **Step 2: TripBody 内追加状态 + 处理函数**

注意现有结构: `const { state, dispatch } = useTripStore()`、`const { openid } = useTripStore()`、`t = state.trip`、`isOwner` 已有,下面直接复用。

```tsx
const [aiFormOpen, setAiFormOpen] = useState(false)
const [aiPreviewOpen, setAiPreviewOpen] = useState(false)
const [aiLoadingOpen, setAiLoadingOpen] = useState(false)
const [aiTask, setAiTask] = useState<AITask | null>(null)
const [aiPrefs, setAiPrefs] = useState<AIPreferences | null>(null)
const [aiElapsed, setAiElapsed] = useState(0)
const watcherRef = useRef<TaskWatcher | null>(null)
const elapsedTimerRef = useRef<any>(null)
const pendingTimerRef = useRef<any>(null)
const previewAutoOpenedRef = useRef(false)

const stopWatch = () => {
  if (watcherRef.current) { watcherRef.current.close(); watcherRef.current = null }
  if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null }
  if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null }
}

const startAi = async (prefs: AIPreferences, previousResult?: GeneratedPlan, userFeedback?: string) => {
  if (!t) return
  stopWatch()
  setAiPrefs(prefs)
  setAiElapsed(0)
  setAiTask(null)
  setAiLoadingOpen(true)
  setAiPreviewOpen(false)
  previewAutoOpenedRef.current = false
  try {
    const taskId = await startAITask({
      tripContext: {
        name: t.name,
        destinations: t.destinations,
        startDate: t.startDate,
        endDate: t.endDate,
        pax: t.pax,
      },
      preferences: prefs,
      tripId: t._id,
      previousResult,
      userFeedback,
    })
    elapsedTimerRef.current = setInterval(() => setAiElapsed(e => e + 1), 1000)
    pendingTimerRef.current = setTimeout(() => {
      setAiTask(prev => {
        if (!prev || prev.status === 'pending') {
          stopWatch(); setAiLoadingOpen(false)
          Taro.showToast({ title: 'AI 启动超时, 请重试', icon: 'none' })
        }
        return prev
      })
    }, PENDING_TIMEOUT_MS)

    watcherRef.current = watchAITask(taskId, (tk) => {
      setAiTask(tk)
      if (!previewAutoOpenedRef.current && tk.progress && tk.progress.days && tk.progress.days.length > 0) {
        previewAutoOpenedRef.current = true
        setAiPreviewOpen(true)
      }
      if (tk.status === 'done') {
        stopWatch(); setAiLoadingOpen(false); setAiPreviewOpen(true)
      } else if (tk.status === 'error') {
        stopWatch(); setAiLoadingOpen(false)
        Taro.showToast({ title: tk.error || 'AI 生成失败', icon: 'none' })
      }
    })
  } catch (e: any) {
    stopWatch(); setAiLoadingOpen(false)
    Taro.showToast({ title: e.message || '启动失败', icon: 'none' })
  }
}

const handleAiOpen = () => { if (isOwner) setAiFormOpen(true) }
const handleAiSubmit = (prefs: AIPreferences) => { setAiFormOpen(false); startAi(prefs) }
const handleAiRegenerate = (feedback: string) => {
  if (!aiPrefs || !aiTask || !aiTask.result) return
  startAi(aiPrefs, aiTask.result, feedback || '请优化方案')
}

const handleAiApply = async (selectedDates: string[]) => {
  if (!t || !aiTask || !aiTask.result) return
  const confirm = await Taro.showModal({
    title: `应用 AI 的 ${selectedDates.length} 天?`,
    content: '将覆盖选中天的现有 spots, 未选中的天保持不变',
    confirmText: '应用',
    confirmColor: '#c43d3d',
  })
  if (!confirm.confirm) return
  try {
    const newDays = mergePlanIntoDays(t.days, aiTask.result, selectedDates)
    await updateTrip(t._id, { days: newDays }, openid)
    // 同步本地 store 让 ItineraryView/MapView 立刻刷新
    dispatch({ type: 'UPDATE_TRIP', patch: { days: newDays } })
    setAiPreviewOpen(false)
    Taro.showToast({ title: '已应用', icon: 'success' })
  } catch (e: any) {
    console.error('[ai apply]', e)
    Taro.showToast({ title: '保存失败', icon: 'none' })
  }
}

useEffect(() => () => stopWatch(), [])
```

- [ ] **Step 3: trip-head 加 AI 按钮(仅 owner)**

定位 trip-head 块的 `<View className='th-row'>` 内,在 `<View className='th-menu'>` 旁边加:

```tsx
{isOwner && (
  <View className='th-ai-btn' onClick={handleAiOpen}>✨ AI</View>
)}
```

- [ ] **Step 4: 三个 sheet 渲染**

在 TripBody return 的最外层 View 结尾追加:

```tsx
<AIPlanForm open={aiFormOpen} onClose={() => setAiFormOpen(false)} onSubmit={handleAiSubmit} />
<AILoading
  open={aiLoadingOpen}
  status={aiTask?.status || 'pending'}
  doneCount={aiTask?.progress?.days?.length || 0}
  totalDays={t?.days?.length || 0}
  onClose={() => setAiLoadingOpen(false)}
  elapsedSec={aiElapsed}
/>
<AIPlanPreview
  open={aiPreviewOpen}
  plan={(aiTask?.result || aiTask?.progress) || null}
  status={aiTask?.status || 'pending'}
  generating={aiTask?.status === 'streaming' || aiTask?.status === 'pending'}
  onRegenerate={handleAiRegenerate}
  onApply={handleAiApply}
  onClose={() => setAiPreviewOpen(false)}
/>
```

- [ ] **Step 5: scss 追加**

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

- [ ] **Step 6: tsc + 提交**

```bash
npx tsc --noEmit
git add src/pages/trip/index.tsx src/pages/trip/index.scss
git commit -m "feat(trip): AI re-plan with per-day merge (owner)"
```

---

### Task 16: 手动验证

**Files:** 无改动。

- [ ] **Step 1: 配置 + 上传(若 Task 9 没做)**

依 Task 9 Step 2 + 文件结构 manual 段完成:
- 上传 ai-plan-trip
- 配置全部环境变量(MIMO + DEEPSEEK + BOCHA)
- 创建 `ai_tasks` 集合, 权限"仅创建者读写"
- 重新部署一次

- [ ] **Step 2: 启动 dev**

Run: `npm run dev:weapp`

- [ ] **Step 3: 新建 trip 主流程(MiMo)**

新建攻略 → 杭州 3 日 → 点 "✨ AI 帮我规划":
- 模型: MiMo-V2.5
- 节奏: 悠闲 / 情侣 / 预算 800

点 "开始生成":
- loading 蒙层显示 "排队中…" → "已生成 Day 1/3" → "Day 2/3" → "Day 3/3"
- 预览 sheet 应在 Day 1 出现时就弹出, 显示部分天数
- 每天默认勾选
- 大多数 spot 有坐标(没有 ⚠ 警告或 ≤2 个)

- [ ] **Step 4: 关页面继续后台跑**

再来一次,生成中点蒙层"关闭蒙层(继续后台跑)" → 蒙层消失,预览 sheet 仍可见。如果连预览也关掉(点 ✕),返回上一页:
- 注: Phase A 不实现"返回 new-trip 后再恢复" —— 关闭即丢失 task 引用。下次重新点 AI 即可。完整恢复体验留 Phase B。

- [ ] **Step 5: 重新生成**

预览底部填 "第二天太赶, 改悠闲点" → "重新生成" → 新一轮 loading → 新方案,日期重置全选。

- [ ] **Step 6: 逐日应用**

只勾选 Day 1 和 Day 3 → 应用 → "已创建" → 跳详情。
Expected:
- Day 1 / Day 3 是 AI 生成
- Day 2 是空 day(seedDays 给的)
- 地图 tab 显示 Day 1/3 的 marker

- [ ] **Step 7: 详情页 AI 重新规划**

详情页 → trip-head 看到 "✨ AI"(右上角) → 点 → 模型选 DeepSeek-V4-Flash → 提交 → 蒙层 → 预览。
- 只勾 Day 2 → 应用 → modal "应用 AI 的 1 天?" → 确认 → toast "已应用"
- ItineraryView Day 1/3 保持原状, Day 2 被 AI 替换
- 协作者视角(账号 B 进同一 trip): 看不到 "✨ AI" 按钮

- [ ] **Step 8: 模型对比**

依次用三个模型跑同一 prompt(杭州 3 日, 情侣, 悠闲),记录:
- 总耗时(看 task.meta.elapsedMs)
- token 数(task.meta.promptTokens / completionTokens)
- 内容质量(主观打分 1-5)

留 issue 记下结果。

- [ ] **Step 9: 错误降级**

(a) 临时把 `BOCHA_API_KEY` 删 → 重新部署 → 再生成。仍能完成,LLM 用自有知识。
(b) 临时把 `MIMO_API_KEY` 设错 → 再生成。task.status 变 error, toast 显示 "AI 服务暂不可用" 类信息。
(c) 临时把 `DEEPSEEK_PRO_MODEL` 不配 → 选 DeepSeek-V4-PRO 生成。task error 显示 "Model name not configured"。

完后恢复。

- [ ] **Step 10: 边界**

- 仅勾"出行人群"/无预算/无 freeText → 正常
- freeText ≥150 字 → 正常
- destinations 为空但点 AI → canSubmit=false 按钮 disabled

- [ ] **Step 11: 失败回去修对应 Task → 走通 → 继续**

- [ ] **Step 12: push**

```bash
git status   # 应该 clean
git push     # 当前分支首推则加 -u
```

---

## 架构决策:为什么用 fire-and-forget 自调用

微信云开发对"长任务异步执行"没有干净的官方方案,几种官方触发器各有硬伤:

| 方案 | 问题 |
| --- | --- |
| 数据库触发器 | 触发器绑定必须走云控制台 GUI(非全代码声明),延迟不承诺 SLA(常见 1-5s 抖动),每次 update 都会再触发需做幂等保护,必须拆双函数 |
| 定时触发器 | cron-style,不适合"用户点一下立即跑" |
| HTTP 触发器 | 同步入口,不解决异步 |
| CloudBase 任务队列 | 真正的"官方异步任务",但是 CloudBase **商业版**功能,微信云开发免费/基础版没有 |

**Fire-and-forget 自调用(本计划方案)**:
- 单函数 / 单部署 / 单 env,运维心智成本最低
- 即刻触发,无 DB 触发器的延迟抖动
- 业内同类 AI 小程序的普遍实践

代价:worker 触发可能失败(概率低但不为零)。Bug 兜底靠 client 端独立 `setTimeout(PENDING_TIMEOUT_MS)`,在 task 永远停留 `pending` 时主动报错。

**升级触发条件(留作 Phase B 信号):**
- 线上观测到 worker 触发失败率 > 1% → 迁数据库触发器
- 用户量起来准备付费 → 迁 CloudBase 商业版任务队列

---

## 自检要点

1. **wxcloud node 版本**: wx-server-sdk 3.x 对应 Node.js 16/18 运行时,async/await/Promise.all 都 OK
2. **环境变量更新需要重新部署**: 改了变量必须点"重新部署"
3. **fire-and-forget 自调用**: 详见上面"架构决策"。client 必须有独立 setTimeout 兜底, 不能只靠 watch 回调内的超时判断
4. **`ai_tasks` 权限**: 只能"创建者可读写",云函数走 admin 不受限,client `watch` 只能看自己的任务 —— 安全
5. **逐天 update progress 触发的 watch 频率**: 一次生成最多触发 N 次(N=天数),不会风暴
6. **博查 API 路径**: 若 404 自己调整;真实文档地址以官方为准
7. **模型名占位**: `MIMO_MODEL/DEEPSEEK_PRO_MODEL/DEEPSEEK_FLASH_MODEL` 必须配,否则 `resolveAlias` 抛错(已处理为友好提示)
8. **OpenAI tool_calls 结构**: assistant 消息回填时必须带 `tool_calls`,顺序 assistant → tool → ... → 下一轮。Task 9 已正确处理
9. **response_format=json_object 与 tools 冲突**: tool loop 不传 response_format,只在重试(去掉 tools)时强制 JSON
10. **lat/lng 幻觉防御**: validate 中对超出中国范围的坐标抹掉,fallback 到 _unresolved
11. **MapView 应用后刷新**: trip 详情页 apply 后必须 `dispatch UPDATE_TRIP` 同步本地 store
12. **小程序 `db.watch` 限制**: 一个连接最多 5 个 watch;Phase A 同时只会有 1 个 AI task watch,远未到上限。watch 必须用 `.where({_id})` 而非 `.doc().watch()` 以保证兼容性
13. **云函数调用配额**: 一次用户生成消耗 2 次云函数调用(start + run, 自调用算独立一次)。免费 4 万次/月足够朋友测试期;后续若紧张,考虑改同步执行或迁触发器
14. **预览自动弹出只一次**: `previewAutoOpenedRef` 防止 progress 更新反复强弹预览;用户手动关掉后只有 `status === 'done'` 才会再强弹一次
15. **真正流式 (token-level)** 留 Phase B:axios stream + SSE 解析 + 逐 token append 到 progress.days[lastDay].spots[lastSpot].name
