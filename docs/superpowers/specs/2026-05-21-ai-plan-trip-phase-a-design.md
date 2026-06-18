# AI 行程生成 Phase A 设计

- 日期: 2026-05-21
- 范围: AI 基础设施 + AI 行程生成主入口(新建 trip 和 trip 详情页两处触发)
- 状态: Brainstorming → 已通过设计,待落实施计划
- Phase B(后续 spec): AI 预算估算 + AI 清单生成

## 目标

让用户在不熟悉目的地、或没耐心手动排路线时,**一键生成可直接落地的多日行程方案**:
- AI 输出符合 Trip schema 的结构化 JSON
- 自动用真实存在的 POI(高德可查)
- 自动补坐标(地图 tab 立即可用)
- 用户可补充信息重新生成,直到满意才"应用"覆盖现有 trip

## 非目标

- 不做预算估算(Phase B)
- 不做清单生成(Phase B)
- 不做"针对某一天单独重生"(整 trip 重生成已经够用)
- 不做流式输出(loading 提示替代)
- 协作者不能触发 AI(仅 owner)
- 不显示 web_search 原始结果(对 LLM 透明使用)

## 架构

```
weapp 用户点"AI 帮我规划"
  ↓
弹"偏好表单 sheet" (pace / audience / budgetCap / freeText)
  ↓
client → cloud function `ai-plan-trip`
  ↓
[ai-plan-trip 内部]
  ├─ 拼装 messages (system prompt + user prompt)
  ├─ Agent loop (最多 8 轮):
  │   ├─ callLLM(messages, tools, response_format=json_object)
  │   ├─ if tool_calls → 执行 search_poi / web_search → 追加 role:'tool' 消息 → 循环
  │   └─ else 最终 JSON → 跳出
  ├─ JSON.parse + schema 校验; 失败重试 1 次
  └─ POI grounding: 并发反查每个 spot 的 lat/lng/adcode
  ↓
返回 GeneratedPlan 给 client
  ↓
"预览 sheet" 展示 days, 用户可:
  ├─ 应用 → 写入 trip (覆盖 days)
  ├─ 重新生成 + 补充反馈 → 回云函数(带 previousResult + userFeedback)
  └─ 取消
```

## LLM 选型

**首选 MiMo(小米),用户有官方 API key。环境变量切换备用 DeepSeek。**

| 项 | MiMo | DeepSeek |
|---|---|---|
| Base URL | `https://api.xiaomimimo.com/v1` | `https://api.deepseek.com/v1` |
| 默认 model | `mimo-v2-pro`(由用户最终确认) | `deepseek-chat` |
| 兼容 | OpenAI 格式 | OpenAI 格式 |
| `response_format: json_object` | ✅ | ✅ |
| `response_format: json_schema`(严格) | ❌ 不依赖 | ❌ 明确不支持 |
| Tool calling | ✅ OpenAI 兼容 | ✅ OpenAI 兼容,最多 128 tools |

**JSON 形状的"准 schema"约束**(因两家都不支持严格 schema):
1. API 参数 `response_format: { type: 'json_object' }` 强制合法 JSON
2. System prompt 嵌入 TypeScript 风格的 schema 定义 + one-shot 示例
3. 云函数侧手写校验(必填字段、类型、数组非空)
4. 校验失败 → 加反馈消息重试 1 次

## 云函数 `ai-plan-trip`

**位置:** `cloudfunctions/ai-plan-trip/`

**结构:**
```
cloudfunctions/ai-plan-trip/
  index.js                # 入口 + agent loop
  lib/
    llm.js                # provider 抽象, callChat({ messages, tools })
    tools.js              # search_poi / web_search 实现
    prompts.js            # system + user prompt 拼装
    validate.js           # JSON 校验
    grounding.js          # POI 反查补坐标
  package.json            # 依赖: wx-server-sdk, node-fetch (或 wx-server-sdk 自带 http)
```

**入口签名:**

```ts
// client 侧调用
const r = await Taro.cloud.callFunction({
  name: 'ai-plan-trip',
  data: {
    tripContext: {
      name: string,
      destinations: Destination[],
      startDate: string,        // 'YYYY-MM-DD'
      endDate: string,
      pax: number,
    },
    preferences: {
      pace: '悠闲' | '平衡' | '紧凑',
      audience: ('情侣' | '亲子' | '老人' | '朋友')[],
      budgetCap?: number,        // 人均/天 RMB
      freeText?: string,
    },
    previousResult?: GeneratedPlan,   // 重生成时传
    userFeedback?: string,            // 重生成时传
  }
})
// 返回: { result: GeneratedPlan }
```

**`GeneratedPlan` 类型** (位于 `src/types/trip.ts` 新增):

```ts
export interface GeneratedSpot {
  type: SpotType                  // 已有联合类型
  name: string
  city: string
  note?: string
  price?: number
  time?: string                   // 'HH:mm'

  // grounding 后补
  lat?: number
  lng?: number
  adcode?: string
  _unresolved?: boolean           // 高德查不到时 true
}

export interface GeneratedDay {
  date: string                    // 'YYYY-MM-DD'
  spots: GeneratedSpot[]
}

export interface GeneratedPlan {
  days: GeneratedDay[]
}
```

## Provider 抽象(`lib/llm.js`)

```js
const PROVIDERS = {
  mimo: {
    endpoint: 'https://api.xiaomimimo.com/v1/chat/completions',
    model: process.env.LLM_MODEL || 'mimo-v2-pro',
    headerKey: 'Authorization',
    headerVal: () => `Bearer ${process.env.MIMO_API_KEY}`,
  },
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: process.env.LLM_MODEL || 'deepseek-chat',
    headerKey: 'Authorization',
    headerVal: () => `Bearer ${process.env.DEEPSEEK_API_KEY}`,
  },
}

async function callChat({ messages, tools, responseFormat }) {
  const provider = process.env.LLM_PROVIDER || 'mimo'
  const cfg = PROVIDERS[provider]
  const body = {
    model: cfg.model,
    messages,
    tools,
    response_format: responseFormat,
    temperature: 0.7,
    max_tokens: 4096,
  }
  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [cfg.headerKey]: cfg.headerVal() },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`)
  const json = await res.json()
  return json.choices[0].message  // { role, content?, tool_calls? }
}
```

**API key 配置** (manual,云控制台):
- 微信云开发控制台 → 云函数 → ai-plan-trip → 环境变量
- 添加:
  - `LLM_PROVIDER=mimo`
  - `LLM_MODEL=mimo-v2-pro`(可选,有默认)
  - `MIMO_API_KEY=<你的 key>`
  - `BOCHA_API_KEY=<博查 key>`
- 切到 DeepSeek 时改 `LLM_PROVIDER=deepseek` + 加 `DEEPSEEK_API_KEY`

## Tools (`lib/tools.js`)

**`search_poi(args)`** — 调用现有 `amap-poi-search` 云函数

```js
async function search_poi({ city, keyword, category }) {
  const r = await cloud.callFunction({
    name: 'amap-poi-search',
    data: { city, keyword, type: category }  // 字段名按现有云函数适配
  })
  const pois = (r.result?.pois || []).slice(0, 5)
  // 返回精简结构, 故意不带 lat/lng
  return pois.map(p => ({
    name: p.name,
    address: p.address,
    category: p.type,
  }))
}
```

**`web_search(args)`** — 调博查 API

```js
async function web_search({ query }) {
  const res = await fetch('https://api.bochaai.com/v1/web-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.BOCHA_API_KEY}`,
    },
    body: JSON.stringify({ query, count: 8, summary: true }),
  })
  if (!res.ok) return { error: '搜索暂时不可用' }
  const json = await res.json()
  const items = (json.data?.webPages?.value || []).slice(0, 5)
  return items.map(it => ({
    title: it.name,
    url: it.url,
    summary: it.summary || it.snippet,
  }))
}
```

(博查 API 字段名待对照官方文档微调;以上是预期结构)

**OpenAI 格式 tool 声明** 见 §3 之前讨论的 `tools` 数组。

## Prompts (`lib/prompts.js`)

**System prompt:**

```
你是“行迹”小程序的旅行规划助手。任务: 为用户生成一份可直接落地的行程 JSON。

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
5. 不要输出 ```json``` 代码块标记, 直接输出 JSON

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
{"days":[{"date":"2026-06-01","spots":[{"type":"arrive","name":"杭州东站","city":"杭州","time":"10:00"},{"type":"meal","name":"知味观(湖滨店)","city":"杭州","price":80,"time":"12:00"},{"type":"spot","name":"西湖断桥","city":"杭州","note":"步行可达, 适合午后散步","time":"14:30"},{"type":"hotel","name":"杭州西湖国宾馆","city":"杭州","price":880,"time":"19:00"}]}]}
```

**User prompt — 首次:**

```
请为以下行程生成方案:
- 攻略名: {trip.name}
- 目的地: {destinations.map(d => d.name).join('、')}
- 日期: {startDate} 至 {endDate} (共 {N} 天)
- 人数: {pax}
- 节奏: {preferences.pace}
- 出行人群: {preferences.audience.join('、')}
- 预算上限(人均/天): {preferences.budgetCap ?? '不限'}
- 其他偏好: {preferences.freeText ?? '无'}

请只输出 JSON。
```

**User prompt — 重生成:**

```
{上方相同 base 段}

【上一版方案】
{JSON.stringify(previousResult)}

【用户希望调整】
{userFeedback}

请基于上一版调整, 而不是完全推翻。只输出 JSON。
```

**校验失败重试 prompt:**

```
上次返回不是合法的目标格式: {错误描述}。请只输出符合 Output 类型的合法 JSON, 不要任何其他文字。
```

## Agent loop (`index.js`)

```js
const MAX_TURNS = 8

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const { tripContext, preferences, previousResult, userFeedback } = event
  const messages = buildMessages(tripContext, preferences, previousResult, userFeedback)

  let finalJson = null
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const msg = await callChat({
      messages,
      tools: TOOLS_SCHEMA,
      responseFormat: { type: 'json_object' },
    })

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push(msg) // assistant message with tool_calls
      for (const tc of msg.tool_calls) {
        const result = await executeTool(tc.function.name, JSON.parse(tc.function.arguments))
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        })
      }
      continue
    }

    // 没有 tool_call → 应是最终 JSON
    finalJson = msg.content
    break
  }

  if (!finalJson) throw new Error('AI 生成超时, 请稍后重试')

  let parsed
  try { parsed = JSON.parse(finalJson) } catch { parsed = null }
  let validation = parsed ? validatePlan(parsed, tripContext) : { ok: false, error: 'JSON.parse 失败' }

  if (!validation.ok) {
    // 重试 1 次
    messages.push({ role: 'user', content: retryPrompt(validation.error) })
    const retry = await callChat({ messages, tools: TOOLS_SCHEMA, responseFormat: { type: 'json_object' } })
    try { parsed = JSON.parse(retry.content) } catch { parsed = null }
    validation = parsed ? validatePlan(parsed, tripContext) : { ok: false, error: '重试后仍非合法 JSON' }
    if (!validation.ok) throw new Error('AI 返回格式错误, 请稍后重试')
  }

  // POI grounding
  const grounded = await groundPois(parsed)
  return { result: grounded }
}
```

## Schema 校验 (`lib/validate.js`)

```js
function validatePlan(obj, tripContext) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: '不是对象' }
  if (!Array.isArray(obj.days)) return { ok: false, error: '缺少 days 数组' }

  const expectedDays = daysBetween(tripContext.startDate, tripContext.endDate)
  if (obj.days.length !== expectedDays) {
    return { ok: false, error: `days 数量 ${obj.days.length}, 应为 ${expectedDays}` }
  }

  for (let i = 0; i < obj.days.length; i++) {
    const d = obj.days[i]
    if (!d.date || typeof d.date !== 'string') return { ok: false, error: `days[${i}].date 缺失` }
    if (!Array.isArray(d.spots) || d.spots.length === 0) return { ok: false, error: `days[${i}].spots 为空` }
    for (let j = 0; j < d.spots.length; j++) {
      const s = d.spots[j]
      if (!s.type || !s.name || !s.city) return { ok: false, error: `days[${i}].spots[${j}] 缺少必填字段` }
      if (!['spot','hotel','meal','transport','arrive'].includes(s.type)) {
        return { ok: false, error: `days[${i}].spots[${j}].type 不合法` }
      }
    }
  }
  return { ok: true }
}
```

## POI Grounding (`lib/grounding.js`)

```js
async function groundPois(plan) {
  const tasks = []
  for (const d of plan.days) {
    for (const s of d.spots) {
      // 不需要坐标的类型(arrive/transport 可能没具体 POI)直接跳过
      if (s.type === 'transport') continue
      tasks.push(groundOne(s))
    }
  }
  // 并发 5 个一批
  for (let i = 0; i < tasks.length; i += 5) {
    await Promise.all(tasks.slice(i, i + 5))
  }
  return plan
}

async function groundOne(spot) {
  try {
    const r = await cloud.callFunction({
      name: 'amap-poi-search',
      data: { city: spot.city, keyword: spot.name }
    })
    const first = r.result?.pois?.[0]
    if (first && first.location) {
      const [lng, lat] = first.location.split(',').map(Number)
      spot.lat = lat
      spot.lng = lng
      spot.adcode = first.adcode
    } else {
      spot._unresolved = true
    }
  } catch (e) {
    spot._unresolved = true
  }
}
```

## Client UI

### 偏好表单 sheet — 新组件

`src/components/AIPlanForm/index.tsx`:

```tsx
interface Props {
  open: boolean
  initialDestinations: Destination[]
  initialStartDate: string
  initialEndDate: string
  initialPax: number
  onSubmit: (prefs: AIPreferences) => void
  onClose: () => void
}

interface AIPreferences {
  pace: '悠闲' | '平衡' | '紧凑'
  audience: ('情侣' | '亲子' | '老人' | '朋友')[]
  budgetCap?: number
  freeText?: string
}
```

UI: 节奏单选 chip 组、人群多选 chip 组、预算上限数字输入(可选)、自由文本 textarea(可选)、底部"开始生成"按钮。

### 预览 sheet — 新组件

`src/components/AIPlanPreview/index.tsx`:

```tsx
interface Props {
  open: boolean
  plan: GeneratedPlan
  generating: boolean       // 重生成中
  onRegenerate: (feedback: string) => void
  onApply: () => void
  onClose: () => void
}
```

UI:
- 顶部标题"AI 生成的方案"
- 按 day 滚动展示,每个 spot 一行(type 图标 + name + note + price)
- `_unresolved: true` 的 spot 灰底 + 警告图标
- 底部 textarea "想调整哪里? (可选)"
- 两个按钮:"重新生成" / "应用"
- generating=true 时整个 sheet 罩 loading 蒙层

### Loading 蒙层 — 新组件

`src/components/AILoading/index.tsx`:

简单全屏蒙层 + 文案 + 阶段提示("正在构思… / 正在查询地点… / 整理结果…")。

阶段切换:云函数返回前 client 根据 elapsed time 切换文案(粗略,5s 内"构思",5-15s"查询",15s+"整理")。

## 入口接入

### 新建 trip 页

`src/pages/new-trip/index.tsx` 在"创建"按钮旁加"AI 帮我规划"次按钮:

```tsx
<View className='nt-actions'>
  <Button className='nt-btn-primary' onClick={submit} disabled={!canSubmit}>创建</Button>
  <Button className='nt-btn-secondary' onClick={() => setAiOpen(true)} disabled={!canSubmit}>AI 帮我规划</Button>
</View>
```

流程: 点 AI → AIPlanForm sheet 弹出(初值填好) → submit → 关 form, 开 loading → 调云函数 → 关 loading, 开 AIPlanPreview → 用户点应用 → **将 GeneratedPlan 转成 `Day[]` 并塞进 NewTripInput, 一次性 createTrip** → 跳到 trip 详情。

转换函数(放 `src/utils/trip-helpers.ts`): `planToDays(plan: GeneratedPlan): Day[]` —— 为每个 GeneratedDay 生成 nanoid id, 为每个 GeneratedSpot 生成 nanoid id, 字段直接映射。`_unresolved` 标记不入库(它只是 client 端预览用)。

### trip 详情页

`src/pages/trip/index.tsx` 在顶部加按钮(owner 视角):

```tsx
{isOwner && <View className='trip-ai-btn' onClick={() => setAiOpen(true)}>✨ AI 重新规划</View>}
```

流程: 同上,但应用阶段直接 updateTrip 覆盖 days 字段。

应用前 modal 确认:"这将覆盖当前所有 days,确定?"。

## 错误处理 / 降级

| 失败场景 | 处理 |
|---|---|
| 8 轮内 LLM 没返回最终 JSON | throw,toast"AI 生成超时,请稍后重试" |
| JSON.parse 失败/schema 校验失败,重试 1 次仍失败 | throw,toast"AI 返回格式错误,请稍后重试" |
| search_poi 失败(高德 QPS/网络) | 该 tool call 返回 `[]`,LLM 自行继续 |
| web_search 失败(博查 API 失效) | 该 tool call 返回 `{ error: '搜索暂时不可用' }`,LLM 自行继续 |
| LLM HTTP 4xx/5xx | throw,toast"AI 服务暂不可用" |
| 全部 spot 都 _unresolved | 预览 sheet 显示警告 banner,允许应用但提示用户手动调整 |
| 云函数执行超时(wxcloud 默认 20s,需调到 60s) | manual: 云控制台改 ai-plan-trip 超时为 60s |

## 成本 / 延迟预期

| 场景 | tool 调用 | 总 latency |
|---|---|---|
| 熟悉一线城市,3 天行程 | 0-2 次 | 8-15s |
| 中等城市,5-7 天 | 3-6 次 | 15-30s |
| 小众目的地,要求特色推荐 | 6-10 次 | 25-45s |

LLM token 成本 + 博查 search 成本:单次生成约 0.05-0.3 RMB,可接受。

## 验证(手动)

1. **新建 trip + AI 规划(主入口)**: 新建 trip → 填目的地+日期 → 点"AI 帮我规划" → 填偏好 → 提交 → 看到 loading 阶段提示 → 拿到预览 sheet → 应用 → 跳 trip 详情,看到生成的 days
2. **重新生成**: 在预览 sheet 上输入"第二天太赶,改悠闲点" → 点重新生成 → loading → 新预览 → 看到第二天确实变化
3. **POI grounding**: 应用后切到地图 tab → 大多数 spot 有坐标 marker
4. **trip 详情页重规划**: 已有 trip → 点"✨ AI 重新规划" → 确认覆盖 → 流程同上
5. **取消**: 偏好表单或预览 sheet 上点关闭 → trip 数据不动
6. **错误降级**: 临时关掉博查 API key → 重新生成 → tool call 失败但 LLM 仍能输出 → 预览正常
7. **超时**: 临时把 MAX_TURNS 设为 1 → 复杂行程触发未完成 → toast 显示"超时"
8. **协作者无权限**: 协作者打开 trip 详情 → 看不到"AI 重新规划"按钮

## 不在 Phase A 范围(明确)

- AI 预算估算(Phase B)
- AI 清单生成(Phase B)
- "针对某一天单独重生"
- 协作者触发 AI
- web_search 结果展示给用户
- Streaming
- 多语言

## 文件改动清单

新建:
- `cloudfunctions/ai-plan-trip/{index.js, package.json, lib/{llm,tools,prompts,validate,grounding}.js}`
- `src/components/AIPlanForm/{index.tsx, index.scss}`
- `src/components/AIPlanPreview/{index.tsx, index.scss}`
- `src/components/AILoading/{index.tsx, index.scss}`

修改:
- `src/types/trip.ts` 增加 `GeneratedSpot / GeneratedDay / GeneratedPlan`
- `src/pages/new-trip/index.tsx` 加 AI 入口
- `src/pages/trip/index.tsx` 加 AI 入口(仅 owner)
- `src/utils/db.ts` 可能加 helper(将 GeneratedPlan 转成 Day[] 并写入 trip)

manual:
- 云控制台 → ai-plan-trip 云函数 → 环境变量 + 超时调到 60s
- 上传 ai-plan-trip 云函数
- 申请博查 API key
