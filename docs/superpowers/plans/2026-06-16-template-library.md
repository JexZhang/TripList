# 攻略库(模板库) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把前端本地「示例攻略」升级为云端只读「攻略库」:用户可浏览/搜索/按天数筛选模板,一键复制到自己的可编辑行程,模板本身严格只读且形态上一眼可辨。

**Architecture:** 新增云端集合 `trip_templates`(全员可读、客户端禁写);读取走小程序 SDK 直查 + Storage SWR 缓存,只有「复制」走 `clone-template` 云函数(注入身份 + 按出发日 rebase 日期 + 写入 `trips`)。前端两张主题无关单布局页:`pages/template`(四 Tab 只读阅读器,复用 BudgetView/MapView 的纯 helper)与 `pages/library`(天数主筛选 + 次级筛选 + 搜索 + 网格)。新增统一 `<Icon>` 组件(CSS mask 渲染 SVG,随主题变色,零 emoji)。最后删除 seed 全链路(6 文件)。

**Tech Stack:** Taro 4.2 + React 18 + TypeScript;腾讯 CloudBase(云数据库 + 云函数 wx-server-sdk);dayjs;node --test(仅用于无依赖的云函数纯逻辑)。

**测试说明(重要):** 本仓库未配置 TS 测试运行器(见 CLAUDE.md),用户全局规则优先于 TDD skill。因此:
- 无依赖的纯逻辑(云函数日期 rebase)用 `node --test` 做真正的 RED→GREEN(Node 18+ 内置,无需装包)。
- 其余 TS/TSX 代码的验证门为 `npx tsc --noEmit`(类型门)+ 微信开发者工具真机/模拟器预览(手动观察)。
- `npx tsc --noEmit` 当前因历史 `tsconfig` 的 TS5107 deprecation 警告会以非零码退出;验证标准是「无新增报错」,不是「退出码 0」。

---

## 文件结构(改动总览)

新增:
- `cloudfunctions/clone-template/index.js` — 复制云函数(读模板→剥离→rebase→写 trips)
- `cloudfunctions/clone-template/rebase.js` — 纯日期 rebase 逻辑(无 wx-server-sdk,可测)
- `cloudfunctions/clone-template/rebase.test.mjs` — rebase 单测(node --test)
- `cloudfunctions/clone-template/package.json` — 声明 wx-server-sdk 依赖
- `src/types/template.ts` — `Template` / `TemplateCard` / `TemplateQuery`
- `src/utils/templates.ts` — 前端直查 + 复制封装(含 Storage SWR)
- `src/data/template-filters.ts` — 策展筛选清单(天数/城市/tags/人群/季节候选)
- `src/components/Icon/index.tsx` + `index.scss` — 统一图标(CSS mask)
- `src/pages/template/index.tsx` + `index.scss` — 只读阅读器(四 Tab)
- `src/pages/library/index.tsx` + `index.scss` — 攻略库页
- `docs/superpowers/deploy/2026-06-16-template-library-cloudbase.md` — 用户侧云端部署清单

修改:
- `src/utils/cloud.ts` — 增 `cloneTemplate`
- `src/app.config.ts` — 注册两页
- `src/pages/home/index.tsx` / `HomeTegami.tsx` / `HomeMagazine.tsx` — 接精选区、去 seed
- `src/utils/db.ts` / `src/store/trip-store.tsx` / `src/pages/trip/index.tsx` — 去 seed 分支

删除:
- `src/data/seed-trips.json` / `src/data/seed-trips.ts`

---

## Phase 1 — 云端基座:clone-template 云函数

### Task 1: 日期 rebase 纯逻辑 + 单测

**Files:**
- Create: `cloudfunctions/clone-template/rebase.js`
- Test: `cloudfunctions/clone-template/rebase.test.mjs`

- [ ] **Step 1: 写失败测试**

`cloudfunctions/clone-template/rebase.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDaysISO, isValidISODate, rebaseTemplateDates } from './rebase.js'

test('addDaysISO 顺延并跨月', () => {
  assert.equal(addDaysISO('2026-06-16', 0), '2026-06-16')
  assert.equal(addDaysISO('2026-06-16', 2), '2026-06-18')
  assert.equal(addDaysISO('2026-06-30', 1), '2026-07-01')
})

test('isValidISODate 校验格式与合法性', () => {
  assert.equal(isValidISODate('2026-06-16'), true)
  assert.equal(isValidISODate('2026-6-16'), false)
  assert.equal(isValidISODate('2026-13-01'), false)
  assert.equal(isValidISODate('abc'), false)
  assert.equal(isValidISODate(''), false)
})

test('rebaseTemplateDates 按序号顺延 + 清空天气 + 顺延 endDate', () => {
  const days = [
    { id: 'a', date: '2000-01-01', weather: { desc: '晴' }, spots: [] },
    { id: 'b', date: '2000-01-02', weather: { desc: '雨' }, spots: [] },
    { id: 'c', date: '2000-01-03', weather: null, spots: [] },
  ]
  const r = rebaseTemplateDates(days, '2026-06-16')
  assert.deepEqual(r.days.map((d) => d.date), ['2026-06-16', '2026-06-17', '2026-06-18'])
  assert.deepEqual(r.days.map((d) => d.weather), [null, null, null])
  assert.equal(r.startDate, '2026-06-16')
  assert.equal(r.endDate, '2026-06-18')
  // 不可变:原数组未被改动
  assert.equal(days[0].date, '2000-01-01')
})

test('rebaseTemplateDates 空 days 时 endDate 回落 startDate', () => {
  const r = rebaseTemplateDates([], '2026-06-16')
  assert.deepEqual(r.days, [])
  assert.equal(r.startDate, '2026-06-16')
  assert.equal(r.endDate, '2026-06-16')
})
```

- [ ] **Step 2: 跑测试确认 RED**

Run: `node --test cloudfunctions/clone-template/rebase.test.mjs`
Expected: FAIL — `Cannot find module './rebase.js'`。

- [ ] **Step 3: 写最小实现**

`cloudfunctions/clone-template/rebase.js`:

```js
// 纯函数:把模板 days 按出发日顺延、清空天气。无任何 wx-server-sdk 依赖,便于单测。

function addDaysISO(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function isValidISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return false
  // 防止 2026-13-01 被 Date 容错进位:回写比对
  return d.toISOString().slice(0, 10) === s
}

// 返回新对象,绝不原地 mutate 入参
function rebaseTemplateDates(days, startDate) {
  const rebased = days.map((d, i) => ({
    ...d,
    date: addDaysISO(startDate, i),
    weather: null,
  }))
  const endDate = days.length ? addDaysISO(startDate, days.length - 1) : startDate
  return { days: rebased, startDate, endDate }
}

module.exports = { addDaysISO, isValidISODate, rebaseTemplateDates }
```

- [ ] **Step 4: 跑测试确认 GREEN**

Run: `node --test cloudfunctions/clone-template/rebase.test.mjs`
Expected: PASS — 4 tests, 0 fail。

- [ ] **Step 5: 提交**

```bash
git add cloudfunctions/clone-template/rebase.js cloudfunctions/clone-template/rebase.test.mjs
git commit -m "feat: clone-template 日期 rebase 纯逻辑 + 单测"
```

### Task 2: clone-template 云函数主体

**Files:**
- Create: `cloudfunctions/clone-template/index.js`
- Create: `cloudfunctions/clone-template/package.json`

- [ ] **Step 1: 写 package.json**

`cloudfunctions/clone-template/package.json`:

```json
{
  "name": "clone-template",
  "version": "1.0.0",
  "description": "复制攻略模板到当前用户的 trips",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

注:`wx-server-sdk` 版本对齐其它云函数(参考 `cloudfunctions/clone-trip/package.json`,如本仓库无该文件则保持 `~2.6.3`,部署时云开发会自动安装)。

- [ ] **Step 2: 写云函数主体**

`cloudfunctions/clone-template/index.js`:

```js
const cloud = require('wx-server-sdk')
const { isValidISODate, rebaseTemplateDates } = require('./rebase')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const TEMPLATES = 'trip_templates'
const TRIPS = 'trips'

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const { templateId, startDate } = event || {}
  if (!templateId) throw new Error('templateId required')
  if (!isValidISODate(startDate)) throw new Error('startDate must be YYYY-MM-DD')

  const db = cloud.database()

  const tplDoc = await db.collection(TEMPLATES).doc(templateId).get().catch(() => null)
  if (!tplDoc || !tplDoc.data) throw new Error('template not found')

  // 剥离:文档主键 + 模板专属字段 + (模板本不该有的)身份/AI 字段,留下纯行程内容
  const {
    _id: _tplId,
    _openid: _tplOpenid,
    city: _city,
    region: _region,
    dayCount: _dayCount,
    spotCount: _spotCount,
    tags: _tags,
    audience: _audience,
    seasons: _seasons,
    featured: _featured,
    sortWeight: _sortWeight,
    coverImages: _coverImages,
    version: _version,
    ownerOpenid: _o1,
    ownerNickname: _o2,
    ownerAvatarUrl: _o3,
    collaborators: _c1,
    collaboratorOpenids: _c2,
    createdAt: _ca,
    updatedAt: _ua,
    updatedBy: _ub,
    aiTaskId: _ai1,
    aiStatus: _ai2,
    aiDraft: _ai3,
    aiError: _ai4,
    days: tplDays = [],
    ...rest
  } = tplDoc.data

  const { days, startDate: s, endDate } = rebaseTemplateDates(tplDays, startDate)

  // 拉当前用户资料,写入新攻略 owner
  const meDoc = await db.collection('users').doc(OPENID).get().catch(() => null)
  const me = (meDoc && meDoc.data) || {}

  const now = Date.now()
  const created = await db.collection(TRIPS).add({
    data: {
      ...rest,
      days,
      startDate: s,
      endDate,
      ownerOpenid: OPENID,
      ownerNickname: me.nickname || '行迹旅人',
      ownerAvatarUrl: me.avatarUrl || '',
      collaborators: [],
      collaboratorOpenids: [],
      createdAt: now,
      updatedAt: now,
      updatedBy: OPENID,
    },
  })

  return { newTripId: created._id }
}
```

- [ ] **Step 3: 自检语法**

Run: `node -e "require('./cloudfunctions/clone-template/rebase.js'); console.log('rebase ok')"`
Expected: 打印 `rebase ok`(确认 require 路径正确;index.js 因依赖 wx-server-sdk 不在本地跑,部署后由云开发环境提供)。

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/clone-template/index.js cloudfunctions/clone-template/package.json
git commit -m "feat: clone-template 云函数(剥离模板字段 + rebase + 写 trips)"
```

---

## Phase 2 — 数据封装与页面注册

### Task 3: 模板类型定义

**Files:**
- Create: `src/types/template.ts`

- [ ] **Step 1: 写类型**

`src/types/template.ts`:

```ts
import type { Trip, AIAudience } from './trip'

// 模板专属字段(运营/分类用)
export interface TemplateMeta {
  city: string
  region: string
  dayCount: number      // 冗余:= days.length
  spotCount: number     // 冗余:各 day spots 之和
  tags: string[]        // 主题玩法:美食/古镇/自然/citywalk/博物馆/温泉/海岛...
  audience: AIAudience[] // 复用 AI 枚举:独行/情侣/亲子/老人/朋友
  seasons: string[]     // 季节:春/夏/秋/冬/看雪/避暑(可空)
  featured: boolean
  sortWeight: number
  coverImages: string[] // 初期可空
  version: number
}

// 完整模板文档:复用 Trip 的行程内容字段,去掉身份/AI 字段,叠加模板字段。
// 注:days/pax 等结构与 Trip 一致,故复用 aggregateBudget(trip)/collectLocated(days) 等纯 helper 时
//     用 `template as unknown as Trip` 结构化传入(只读 days/pax,安全)。
export interface Template
  extends Omit<
      Trip,
      | '_openid' | 'ownerOpenid' | 'ownerNickname' | 'ownerAvatarUrl'
      | 'collaborators' | 'updatedBy'
      | 'aiTaskId' | 'aiStatus' | 'aiDraft' | 'aiError'
    >,
    TemplateMeta {}

// 列表轻字段卡片:不含 days/packing 等重字段,避免列表误带大对象
export interface TemplateCard {
  _id: string
  name: string
  city: string
  region: string
  dayCount: number
  spotCount: number
  tags: string[]
  audience: AIAudience[]
  seasons: string[]
  coverImages: string[]
}

export interface TemplateQuery {
  dayCount?: number      // 精确天数(1..5)
  dayCountGte?: number   // 「6天+」用 dayCountGte=6
  city?: string
  region?: string
  tags?: string[]        // 维度内 OR
  audience?: AIAudience[]
  seasons?: string[]
  keyword?: string       // 命中 name / city
  skip?: number
  limit?: number
}
```

- [ ] **Step 2: 类型门**

Run: `npx tsc --noEmit`
Expected: 无新增报错(仅历史 TS5107)。

- [ ] **Step 3: 提交**

```bash
git add src/types/template.ts
git commit -m "feat: 模板类型 Template/TemplateCard/TemplateQuery"
```

### Task 4: cloud.ts 增 cloneTemplate

**Files:**
- Modify: `src/utils/cloud.ts`

- [ ] **Step 1: 在 cloud 对象内追加方法**

把 `src/utils/cloud.ts` 中 `cloneTrip` 之后插入(紧跟其后,保持风格一致):

```ts
  cloneTemplate: (data: { templateId: string; startDate: string }) =>
    call<typeof data, { newTripId: string }>('clone-template', data),
```

- [ ] **Step 2: 类型门**

Run: `npx tsc --noEmit`
Expected: 无新增报错。

- [ ] **Step 3: 提交**

```bash
git add src/utils/cloud.ts
git commit -m "feat: cloud.cloneTemplate 调用封装"
```

### Task 5: templates.ts 直查 + SWR + 复制

**Files:**
- Create: `src/utils/templates.ts`

- [ ] **Step 1: 写数据封装**

`src/utils/templates.ts`:

```ts
import Taro from '@tarojs/taro'
import { cloud } from './cloud'
import type { Template, TemplateCard, TemplateQuery } from '../types/template'

// @ts-ignore Taro.cloud 在 weapp 端可用
const db = () => Taro.cloud.database()
const COLL = 'trip_templates'

// 列表只取轻字段,避免误带 days
const CARD_FIELD = {
  name: true, city: true, region: true,
  dayCount: true, spotCount: true,
  tags: true, audience: true, seasons: true,
  coverImages: true,
} as const

// ── Storage SWR:精选区缓存 6 小时,先回缓存再后台刷新 ──
const FEATURED_KEY = 'tpl-featured-cache'
const FEATURED_TTL = 6 * 60 * 60 * 1000

interface FeaturedCache { ts: number; cards: TemplateCard[] }

function readFeaturedCache(): TemplateCard[] | null {
  try {
    const c = Taro.getStorageSync(FEATURED_KEY) as FeaturedCache | ''
    if (c && Array.isArray(c.cards) && Date.now() - c.ts < FEATURED_TTL) return c.cards
  } catch { /* ignore */ }
  return null
}

function writeFeaturedCache(cards: TemplateCard[]): void {
  try { Taro.setStorageSync(FEATURED_KEY, { ts: Date.now(), cards } as FeaturedCache) } catch { /* ignore */ }
}

/**
 * 首页精选:featured=true,按 sortWeight 降序取前 N。
 * 返回 { cards, fromCache }:命中缓存则先把缓存交给调用方渲染,同时本调用仍会发起网络刷新。
 */
export async function listFeaturedTemplates(limit = 8): Promise<TemplateCard[]> {
  const res = await db().collection(COLL)
    .where({ featured: true })
    .field(CARD_FIELD)
    .orderBy('sortWeight', 'desc')
    .limit(limit)
    .get()
  const cards = ((res && res.data) || []) as TemplateCard[]
  writeFeaturedCache(cards)
  return cards
}

/** 同步读精选缓存(供首页首屏立即渲染,不等网络) */
export function getFeaturedCache(): TemplateCard[] | null {
  return readFeaturedCache()
}

/**
 * 攻略库查询。初期数据量小:服务端用 where 收敛天数/城市,其余多选维度(tags/audience/seasons)
 * 与 keyword 拉回后客户端 OR/AND 精筛(见 template-filter)。
 */
export async function listTemplates(q: TemplateQuery): Promise<TemplateCard[]> {
  const _ = db().command
  const where: Record<string, unknown> = {}
  if (typeof q.dayCount === 'number') where.dayCount = q.dayCount
  else if (typeof q.dayCountGte === 'number') where.dayCount = _.gte(q.dayCountGte)
  if (q.city) where.city = q.city
  if (q.region) where.region = q.region

  let query = db().collection(COLL).where(where).field(CARD_FIELD).orderBy('sortWeight', 'desc')
  if (typeof q.skip === 'number') query = query.skip(q.skip)
  query = query.limit(q.limit ?? 30)

  const res = await query.get()
  return ((res && res.data) || []) as TemplateCard[]
}

/** 只读详情:取完整文档(含 days) */
export async function getTemplate(id: string): Promise<Template | null> {
  try {
    const res = await db().collection(COLL).doc(id).get({})
    if (!res || !res.data) return null
    return res.data as Template
  } catch (e: unknown) {
    const err = e as { errCode?: number; errMsg?: string }
    if (err && (err.errCode === -502005 || /not.*exist|not.*found/i.test(err.errMsg || ''))) return null
    console.error('[getTemplate]', id, e)
    throw e
  }
}

/** 复制模板 → 新 trip,返回 newTripId */
export async function cloneTemplate(templateId: string, startDate: string): Promise<string> {
  const { newTripId } = await cloud.cloneTemplate({ templateId, startDate })
  return newTripId
}
```

- [ ] **Step 2: 类型门**

Run: `npx tsc --noEmit`
Expected: 无新增报错。

- [ ] **Step 3: 提交**

```bash
git add src/utils/templates.ts
git commit -m "feat: templates.ts 直查/SWR/复制封装"
```

### Task 6: 客户端精筛纯函数

**Files:**
- Create: `src/utils/template-filter.ts`

- [ ] **Step 1: 写纯函数**

`src/utils/template-filter.ts`:

```ts
import type { TemplateCard, TemplateQuery } from '../types/template'

// 维度内多选 = OR;跨维度 = AND。dayCount/city/region 已在服务端 where 收敛,这里兜底再筛。
export function matchesTemplate(card: TemplateCard, q: TemplateQuery): boolean {
  if (typeof q.dayCount === 'number' && card.dayCount !== q.dayCount) return false
  if (typeof q.dayCountGte === 'number' && card.dayCount < q.dayCountGte) return false
  if (q.city && card.city !== q.city) return false
  if (q.region && card.region !== q.region) return false

  if (q.tags && q.tags.length && !q.tags.some((t) => card.tags.includes(t))) return false
  if (q.audience && q.audience.length && !q.audience.some((a) => card.audience.includes(a))) return false
  if (q.seasons && q.seasons.length && !q.seasons.some((s) => card.seasons.includes(s))) return false

  if (q.keyword && q.keyword.trim()) {
    const k = q.keyword.trim().toLowerCase()
    const hay = `${card.name} ${card.city} ${card.region}`.toLowerCase()
    if (!hay.includes(k)) return false
  }
  return true
}

export function filterTemplates(cards: TemplateCard[], q: TemplateQuery): TemplateCard[] {
  return cards.filter((c) => matchesTemplate(c, q))
}
```

- [ ] **Step 2: 类型门**

Run: `npx tsc --noEmit`
Expected: 无新增报错。

- [ ] **Step 3: 提交**

```bash
git add src/utils/template-filter.ts
git commit -m "feat: 模板客户端精筛纯函数(维度内 OR/跨维度 AND)"
```

### Task 7: 策展筛选清单

**Files:**
- Create: `src/data/template-filters.ts`

- [ ] **Step 1: 写策展候选**

`src/data/template-filters.ts`:

```ts
import type { AIAudience } from '../types/trip'

// 天数主筛选:1..5 精确,「6天+」用 gte=6
export interface DayChip { label: string; dayCount?: number; dayCountGte?: number }
export const DAY_CHIPS: DayChip[] = [
  { label: '1天', dayCount: 1 },
  { label: '2天', dayCount: 2 },
  { label: '3天', dayCount: 3 },
  { label: '4天', dayCount: 4 },
  { label: '5天', dayCount: 5 },
  { label: '6天+', dayCountGte: 6 },
]

// 次级维度候选(前端固定策展,后期可换后端 distinct)
export const TAG_OPTIONS: string[] = ['美食', '古镇', '自然', 'citywalk', '博物馆', '温泉', '海岛', '亲子乐园', '历史人文']
export const AUDIENCE_OPTIONS: AIAudience[] = ['独行', '情侣', '亲子', '老人', '朋友']
export const SEASON_OPTIONS: string[] = ['春', '夏', '秋', '冬', '看雪', '避暑']
// 城市初期留空,由首批模板覆盖后补;空数组时 UI 隐藏城市筛选行
export const CITY_OPTIONS: string[] = []
```

- [ ] **Step 2: 提交**

```bash
git add src/data/template-filters.ts
git commit -m "feat: 攻略库策展筛选清单(天数/tags/人群/季节)"
```

### Task 8: 注册两个新页面

**Files:**
- Modify: `src/app.config.ts:2-8`

- [ ] **Step 1: 在 pages 数组追加**

把 `src/app.config.ts` 的 pages 数组改为:

```ts
  pages: [
    'pages/home/index',
    'pages/new-trip/index',
    'pages/trip/index',
    'pages/share/index',
    'pages/me/index',
    'pages/library/index',
    'pages/template/index',
  ],
```

- [ ] **Step 2: 提交**

```bash
git add src/app.config.ts
git commit -m "chore: 注册 pages/library 与 pages/template"
```

---

## Phase 3 — 图标体系 <Icon>

### Task 9: Icon 组件(CSS mask)

**Files:**
- Create: `src/components/Icon/index.tsx`
- Create: `src/components/Icon/index.scss`

- [ ] **Step 1: 写 Icon 组件**

设计:每个图标是一段 SVG 内联标记(stroke/fill 用黑色 `#000`,只取其 alpha 作 mask),组件渲染一个 `<View>`,用 `mask-image` 贴 SVG data-URI,`backgroundColor` 决定实际颜色(默认 `var(--ink)`,可传 token 覆盖)。weapp 支持 `mask-image` 的 data-URI。

`src/components/Icon/index.tsx`:

```tsx
import { View } from '@tarojs/components'
import type { CSSProperties } from 'react'
import './index.scss'

export type IconName =
  | 'search' | 'pin' | 'tag' | 'people' | 'season' | 'lock' | 'sliders'
  | 'itinerary' | 'map' | 'budget' | 'packing'
  | 'spot' | 'hotel' | 'meal' | 'transport'
  | 'check' | 'plus' | 'close' | 'arrow-left' | 'chevron-down' | 'chevron-right'

// 仅内层 path/circle;统一 24×24 viewBox。stroke/fill 用 #000(mask 只看 alpha)。
const PATHS: Record<IconName, string> = {
  search: `<circle cx='11' cy='11' r='7'/><path d='M20 20l-3.5-3.5'/>`,
  pin: `<path d='M12 21s-7-7-7-12a7 7 0 0114 0c0 5-7 12-7 12z'/><circle cx='12' cy='9' r='2.5'/>`,
  tag: `<path d='M4 4h7l9 9-7 7-9-9V4z'/><circle cx='8' cy='8' r='1.3' fill='#000' stroke='none'/>`,
  people: `<circle cx='9' cy='9' r='3'/><path d='M3 20c0-3 2.5-5 6-5s6 2 6 5'/><circle cx='16' cy='10' r='2.5'/><path d='M16 15c2.5 0 5 2 5 5'/>`,
  season: `<path d='M12 3v18M5 7l14 10M19 7L5 17'/><circle cx='12' cy='12' r='2'/>`,
  lock: `<rect x='5' y='10' width='14' height='10' rx='2'/><path d='M8 10V7a4 4 0 018 0v3'/>`,
  sliders: `<path d='M4 7h10M18 7h2M4 17h2M10 17h10'/><circle cx='16' cy='7' r='2'/><circle cx='8' cy='17' r='2'/>`,
  itinerary: `<rect x='4.5' y='3' width='15' height='18' rx='2'/><path d='M9 8h6M9 12h6M9 16h4'/><circle cx='7' cy='8' r='0.7' fill='#000' stroke='none'/><circle cx='7' cy='12' r='0.7' fill='#000' stroke='none'/><circle cx='7' cy='16' r='0.7' fill='#000' stroke='none'/>`,
  map: `<path d='M9 4l-5 2v14l5-2 6 2 5-2V4l-5 2-6-2z'/><path d='M9 4v14M15 6v14'/>`,
  budget: `<circle cx='12' cy='12' r='9'/><path d='M12 6.5v11M14.5 9h-3.5a1.5 1.5 0 000 3h2a1.5 1.5 0 010 3H9'/>`,
  packing: `<path d='M6 8h12v12a1 1 0 01-1 1H7a1 1 0 01-1-1V8z'/><path d='M9 8V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V8'/><path d='M12 11v6'/>`,
  spot: `<path d='M12 3c-3.5 0-6 2.6-6 6 0 4.5 6 12 6 12s6-7.5 6-12c0-3.4-2.5-6-6-6z'/><circle cx='12' cy='9' r='2.2'/>`,
  hotel: `<path d='M3 18V7a1 1 0 011-1h16a1 1 0 011 1v11'/><path d='M3 14h18M3 18v2M21 18v2'/><circle cx='7.5' cy='11' r='1.2'/><path d='M10 14V12a1 1 0 011-1h6a1 1 0 011 1v2'/>`,
  meal: `<path d='M5 3v6M8 3v6M5 9a3 3 0 003 3v9M19 3l-1 9h2v9'/>`,
  transport: `<path d='M5 17V8a3 3 0 013-3h8a3 3 0 013 3v9'/><path d='M5 12h14'/><circle cx='8.5' cy='17.5' r='1.5'/><circle cx='15.5' cy='17.5' r='1.5'/>`,
  check: `<path d='M5 12.5l5 5L19 7'/>`,
  plus: `<path d='M12 5v14M5 12h14'/>`,
  close: `<path d='M6 6l12 12M18 6l-12 12'/>`,
  'arrow-left': `<path d='M19 12H5M11 18l-6-6 6-6'/>`,
  'chevron-down': `<path d='M6 9l6 6 6-6'/>`,
  'chevron-right': `<path d='M9 6l6 6-6 6'/>`,
}

function dataUri(name: IconName): string {
  const inner = PATHS[name]
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='#000' ` +
    `stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'>${inner}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

interface IconProps {
  name: IconName
  size?: number          // px
  color?: string         // 任意 CSS color / token,默认 var(--ink)
  className?: string
  style?: CSSProperties
}

export default function Icon({ name, size = 22, color = 'var(--ink)', className = '', style }: IconProps) {
  const uri = dataUri(name)
  const merged: CSSProperties = {
    width: size,
    height: size,
    backgroundColor: color,
    WebkitMaskImage: uri,
    maskImage: uri,
    ...style,
  }
  return <View className={`icon ${className}`} style={merged} />
}
```

- [ ] **Step 2: 写 Icon 样式(mask 公共项)**

`src/components/Icon/index.scss`:

```scss
.icon {
  display: inline-block;
  flex-shrink: 0;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}
```

- [ ] **Step 3: 类型门**

Run: `npx tsc --noEmit`
Expected: 无新增报错。

- [ ] **Step 4: 提交**

```bash
git add src/components/Icon
git commit -m "feat: 统一 Icon 组件(CSS mask 渲染 SVG,随色,零 emoji)"
```

- [ ] **Step 5: 预览验证(手动)**

在微信开发者工具临时把某页放一个 `<Icon name='lock' size={24} color='var(--accent)' />`,确认:图标显示为线条锁形、颜色随 `color` 变化、切主题时跟随 CSS 变量。确认后撤掉临时代码。

---

## Phase 4 — 只读阅读页 pages/template

> 复用纯 helper:`aggregateBudget`/`conicFromBuckets`(`src/views/BudgetView/helpers`)、`collectLocated`/`dayColor`/`encodeMarkerId`(`src/views/MapView/helpers`)。不复用四主题变体视图(它们与 store 强耦合且是主题分发器,违背本页「主题无关单布局」),改为单布局只读渲染。

### Task 10: 阅读器骨架 + 行程 Tab + 复制流

**Files:**
- Create: `src/pages/template/index.tsx`
- Create: `src/pages/template/index.scss`

- [ ] **Step 1: 写页面(四 Tab,先实现 行程/复制,地图/开销/清单 占位为后续 Task 填充)**

`src/pages/template/index.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Map, Picker } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import dayjs from 'dayjs'
import type { Template } from '../../types/template'
import type { Trip, SpotType } from '../../types/trip'
import { getTemplate, cloneTemplate } from '../../utils/templates'
import { aggregateBudget, conicFromBuckets } from '../../views/BudgetView/helpers'
import { collectLocated, dayColor, encodeMarkerId } from '../../views/MapView/helpers'
import { PACKING_CATEGORIES } from '../../data/packing'
import { useThemeClass } from '../../utils/theme-class'
import Icon, { type IconName } from '../../components/Icon'
import './index.scss'

type Tab = 'itinerary' | 'map' | 'budget' | 'packing'
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'itinerary', label: '行程', icon: 'itinerary' },
  { key: 'map', label: '地图', icon: 'map' },
  { key: 'budget', label: '开销', icon: 'budget' },
  { key: 'packing', label: '清单', icon: 'packing' },
]
const SPOT_ICON: Record<SpotType, IconName> = { spot: 'spot', hotel: 'hotel', meal: 'meal', transport: 'transport' }

function nightsLabel(dayCount: number): string {
  const nights = Math.max(0, dayCount - 1)
  return `${dayCount}天${nights}晚`
}

export default function TemplatePage() {
  const themeCls = useThemeClass()
  const router = useRouter()
  const id = router.params.id || ''
  const [tpl, setTpl] = useState<Template | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [tab, setTab] = useState<Tab>('itinerary')
  const [copyOpen, setCopyOpen] = useState(false)
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    if (!id) { setStatus('error'); return }
    getTemplate(id)
      .then((t) => { if (t) { setTpl(t); setStatus('ready') } else setStatus('error') })
      .catch(() => setStatus('error'))
  }, [id])

  const spotCount = useMemo(
    () => (tpl ? tpl.days.reduce((n, d) => n + d.spots.length, 0) : 0),
    [tpl],
  )

  const doCopy = async () => {
    if (!tpl || copying) return
    setCopying(true)
    Taro.showLoading({ title: '复制中…' })
    try {
      const newId = await cloneTemplate(tpl._id, startDate)
      Taro.hideLoading()
      setCopyOpen(false)
      Taro.showToast({ title: '已复制到我的行程', icon: 'success', duration: 700 })
      setTimeout(() => Taro.redirectTo({ url: `/pages/trip/index?id=${newId}` }), 720)
    } catch (e) {
      Taro.hideLoading()
      console.error('[cloneTemplate]', e)
      Taro.showToast({ title: '复制失败,请重试', icon: 'none' })
    } finally {
      setCopying(false)
    }
  }

  if (status === 'loading') {
    return <View className={`${themeCls} tpl-state`}><Text>加载中…</Text></View>
  }
  if (status === 'error' || !tpl) {
    return (
      <View className={`${themeCls} tpl-state`}>
        <Text className='tpl-state-title'>模板不存在或加载失败</Text>
        <View className='tpl-state-btn' onClick={() => Taro.navigateBack().catch(() => Taro.reLaunch({ url: '/pages/library/index' }))}>返回</View>
      </View>
    )
  }

  return (
    <View className={`${themeCls} tpl`}>
      {/* 顶部:返回 + 只读标识 */}
      <View className='tpl-top'>
        <View className='tpl-back' onClick={() => Taro.navigateBack().catch(() => Taro.reLaunch({ url: '/pages/library/index' }))}>
          <Icon name='arrow-left' size={22} />
        </View>
        <View className='tpl-readonly'>
          <Icon name='lock' size={14} color='var(--accent)' />
          <Text className='tpl-readonly-t'>样板 · 只读</Text>
        </View>
      </View>

      {/* 概览 */}
      <View className='tpl-hero'>
        <Text className='tpl-name'>{tpl.name}</Text>
        <View className='tpl-meta'>
          <View className='tpl-meta-i'><Icon name='pin' size={14} color='var(--ink-3)' /><Text>{tpl.city}</Text></View>
          <Text className='tpl-meta-dot'>·</Text>
          <Text>{nightsLabel(tpl.dayCount || tpl.days.length)}</Text>
          <Text className='tpl-meta-dot'>·</Text>
          <Text>{spotCount} 个地点</Text>
        </View>
        {tpl.tags?.length > 0 && (
          <View className='tpl-tags'>
            {tpl.tags.map((t) => <Text key={t} className='tpl-tag'>{t}</Text>)}
          </View>
        )}
      </View>

      {/* Tab 条 */}
      <View className='tpl-tabs'>
        {TABS.map((tb) => (
          <View key={tb.key} className={`tpl-tab ${tab === tb.key ? 'on' : ''}`} onClick={() => setTab(tb.key)}>
            <Icon name={tb.icon} size={20} color={tab === tb.key ? 'var(--accent)' : 'var(--ink-3)'} />
            <Text className='tpl-tab-l'>{tb.label}</Text>
          </View>
        ))}
      </View>

      {/* 内容 */}
      <ScrollView scrollY className='tpl-body'>
        {tab === 'itinerary' && (
          <View className='tpl-itin'>
            {tpl.days.map((d, i) => (
              <View key={d.id} className='tpl-day'>
                <View className='tpl-day-head'><Text className='tpl-day-no'>第 {i + 1} 天</Text></View>
                {d.spots.length === 0 && <Text className='tpl-day-empty'>(空)</Text>}
                {d.spots.map((s) => (
                  <View key={s.id} className='tpl-spot'>
                    <Icon name={SPOT_ICON[s.type]} size={18} color='var(--ink-3)' />
                    {s.time && <Text className='tpl-spot-time'>{s.time}</Text>}
                    <Text className='tpl-spot-name'>{s.name}</Text>
                    {(s.price || 0) > 0 && <Text className='tpl-spot-price'>¥{s.price}</Text>}
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {tab === 'map' && <TemplateMap tpl={tpl} />}
        {tab === 'budget' && <TemplateBudget tpl={tpl} />}
        {tab === 'packing' && <TemplatePacking tpl={tpl} />}
        <View className='tpl-body-pad' />
      </ScrollView>

      {/* 底部常驻复制 */}
      <View className='tpl-cta'>
        <View className='tpl-cta-hint'><Icon name='lock' size={13} color='var(--ink-3)' /><Text>模板只读,复制后可自由编辑</Text></View>
        <View className='tpl-cta-btn' onClick={() => setCopyOpen(true)}>
          <Icon name='plus' size={18} color='#fff' /><Text>复制到我的行程</Text>
        </View>
      </View>

      {/* 复制:选出发日 */}
      {copyOpen && (
        <View className='tpl-sheet-mask' onClick={() => !copying && setCopyOpen(false)}>
          <View className='tpl-sheet' onClick={(e) => e.stopPropagation()}>
            <Text className='tpl-sheet-title'>选择出发日期</Text>
            <Picker mode='date' value={startDate} onChange={(e) => setStartDate(String(e.detail.value))}>
              <View className='tpl-sheet-date'>
                <Text className='tpl-sheet-date-l'>出发</Text>
                <Text className='tpl-sheet-date-v'>{startDate}</Text>
              </View>
            </Picker>
            <Text className='tpl-sheet-note'>共 {tpl.dayCount || tpl.days.length} 天,日期将自动顺延。</Text>
            <View className={`tpl-sheet-go ${copying ? 'busy' : ''}`} onClick={doCopy}>
              <Text>{copying ? '复制中…' : '确认复制'}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

// ── 地图 Tab(只读)──
function TemplateMap({ tpl }: { tpl: Template }) {
  const located = useMemo(() => collectLocated(tpl.days), [tpl.days])
  const markers = located.map((p) => ({
    id: encodeMarkerId(p.dayIdx, p.spotIdx),
    latitude: p.lat,
    longitude: p.lng,
    width: 1, height: 1, anchor: { x: 0.5, y: 1 },
    callout: {
      content: String(p.dayIdx + 1), color: '#FFFFFF', fontSize: 14,
      bgColor: dayColor(p.dayIdx), padding: 10, borderRadius: 999,
      borderWidth: 3, borderColor: '#FFFFFF', display: 'ALWAYS' as const,
      textAlign: 'center' as const,
    },
    iconPath: '',
  }))
  const center = located[0] || { lat: tpl.destinations?.[0]?.lat ?? 30.27, lng: tpl.destinations?.[0]?.lng ?? 120.15 }
  if (located.length === 0) {
    return <View className='tpl-map-empty'><Text>该模板暂无地点坐标</Text></View>
  }
  return (
    <View className='tpl-map-wrap'>
      <Map className='tpl-map' latitude={center.lat} longitude={center.lng} scale={11}
        markers={markers as any} showLocation={false} enableTraffic={false} onError={() => {}} />
    </View>
  )
}

// ── 开销 Tab(只读,复用 aggregateBudget)──
function TemplateBudget({ tpl }: { tpl: Template }) {
  const trip = tpl as unknown as Trip
  const { buckets, total, perPax } = aggregateBudget(trip)
  const conic = conicFromBuckets(buckets)
  return (
    <View className='tpl-bud'>
      <View className='tpl-bud-head'>
        <View>
          <Text className='tpl-bud-cap'>预计总开销</Text>
          <Text className='tpl-bud-total'>¥{total.toLocaleString()}</Text>
          <Text className='tpl-bud-perpax'>人均 ¥{perPax.toLocaleString()}</Text>
        </View>
        <View className='tpl-bud-donut' style={{ background: `conic-gradient(${conic})` }}>
          <View className='tpl-bud-donut-hole' />
        </View>
      </View>
      <View className='tpl-bud-legend'>
        {buckets.map((b) => (
          <View key={b.type} className='tpl-bud-row'>
            <View className='tpl-bud-sw' style={{ background: b.color }} />
            <Text className='tpl-bud-label'>{b.label}</Text>
            <Text className='tpl-bud-pct'>{Math.round(b.pct)}%</Text>
            <Text className='tpl-bud-v'>¥{b.total.toLocaleString()}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ── 清单 Tab(只读)──
function TemplatePacking({ tpl }: { tpl: Template }) {
  const catLabel = (catId: string) => PACKING_CATEGORIES.find((c) => c.id === catId)?.label || catId
  const groups = useMemo(() => {
    const map = new Map<string, typeof tpl.packing>()
    for (const item of tpl.packing) {
      const arr = map.get(item.category) || []
      arr.push(item)
      map.set(item.category, arr)
    }
    return Array.from(map.entries())
  }, [tpl.packing])
  if (tpl.packing.length === 0) {
    return <View className='tpl-pack-empty'><Text>该模板暂无打包清单</Text></View>
  }
  return (
    <View className='tpl-pack'>
      {groups.map(([cat, items]) => (
        <View key={cat} className='tpl-pack-group'>
          <Text className='tpl-pack-cat'>{catLabel(cat)}</Text>
          {items.map((it) => (
            <View key={it.id} className='tpl-pack-row'>
              <Icon name='check' size={16} color={it.checked ? 'var(--accent)' : 'var(--line)'} />
              <Text className='tpl-pack-label'>{it.label}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}
```

- [ ] **Step 2: 写样式**

`src/pages/template/index.scss`:

```scss
.tpl { display: flex; flex-direction: column; min-height: 100vh; background: var(--bg); color: var(--ink); padding-bottom: 160px; }
.tpl-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 24px; color: var(--ink); }
.tpl-state-title { font-size: 30px; }
.tpl-state-btn, .tpl-sheet-go { padding: 18px 40px; border-radius: 999px; background: var(--accent); color: #fff; }

.tpl-top { display: flex; align-items: center; justify-content: space-between; padding: 24px 28px 8px; }
.tpl-readonly { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); }
.tpl-readonly-t { font-size: 24px; color: var(--accent); }

.tpl-hero { padding: 8px 28px 16px; }
.tpl-name { font-size: 44px; font-family: var(--font-display, serif); line-height: 1.25; }
.tpl-meta { display: flex; align-items: center; gap: 10px; margin-top: 14px; color: var(--ink-3); font-size: 26px; }
.tpl-meta-i { display: flex; align-items: center; gap: 6px; }
.tpl-meta-dot { color: var(--line); }
.tpl-tags { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
.tpl-tag { font-size: 22px; padding: 6px 16px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); color: var(--ink); }

.tpl-tabs { display: flex; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin: 8px 0; }
.tpl-tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px 0; color: var(--ink-3); }
.tpl-tab.on { color: var(--accent); }
.tpl-tab-l { font-size: 24px; }

.tpl-body { flex: 1; padding: 0 28px; }
.tpl-body-pad { height: 40px; }

.tpl-day { padding: 18px 0; border-bottom: 1px dashed var(--line); }
.tpl-day-no { font-size: 28px; font-weight: 600; }
.tpl-day-empty { color: var(--ink-3); font-size: 24px; }
.tpl-spot { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
.tpl-spot-time { font-size: 22px; color: var(--ink-3); width: 80px; }
.tpl-spot-name { flex: 1; font-size: 28px; }
.tpl-spot-price { font-size: 24px; color: var(--accent); }

.tpl-map-wrap, .tpl-map { width: 100%; height: 700px; }
.tpl-map-empty, .tpl-pack-empty { padding: 80px 0; text-align: center; color: var(--ink-3); }

.tpl-bud-head { display: flex; align-items: center; justify-content: space-between; padding: 24px 0; }
.tpl-bud-cap { font-size: 24px; color: var(--ink-3); }
.tpl-bud-total { display: block; font-size: 48px; font-weight: 700; }
.tpl-bud-perpax { font-size: 24px; color: var(--ink-3); }
.tpl-bud-donut { position: relative; width: 140px; height: 140px; border-radius: 50%; }
.tpl-bud-donut-hole { position: absolute; inset: 28px; border-radius: 50%; background: var(--bg); }
.tpl-bud-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
.tpl-bud-sw { width: 20px; height: 20px; border-radius: 6px; }
.tpl-bud-label { flex: 1; font-size: 26px; }
.tpl-bud-pct { font-size: 24px; color: var(--ink-3); width: 80px; text-align: right; }
.tpl-bud-v { font-size: 26px; width: 140px; text-align: right; }

.tpl-pack-group { padding: 16px 0; }
.tpl-pack-cat { font-size: 26px; font-weight: 600; color: var(--accent); }
.tpl-pack-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; }
.tpl-pack-label { font-size: 28px; }

.tpl-cta { position: fixed; left: 0; right: 0; bottom: 0; padding: 16px 28px 40px; background: var(--bg); border-top: 1px solid var(--line); }
.tpl-cta-hint { display: flex; align-items: center; gap: 8px; font-size: 22px; color: var(--ink-3); margin-bottom: 12px; }
.tpl-cta-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 24px; border-radius: 16px; background: var(--accent); color: #fff; font-size: 30px; }

.tpl-sheet-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: flex-end; z-index: 100; }
.tpl-sheet { width: 100%; background: var(--bg); border-radius: 28px 28px 0 0; padding: 36px 28px 48px; }
.tpl-sheet-title { font-size: 32px; font-weight: 600; }
.tpl-sheet-date { display: flex; align-items: center; justify-content: space-between; margin: 24px 0 12px; padding: 24px; border-radius: 16px; border: 1px solid var(--line); }
.tpl-sheet-date-l { color: var(--ink-3); font-size: 26px; }
.tpl-sheet-date-v { font-size: 30px; }
.tpl-sheet-note { font-size: 24px; color: var(--ink-3); }
.tpl-sheet-go { margin-top: 28px; text-align: center; }
.tpl-sheet-go.busy { opacity: 0.6; }
```

- [ ] **Step 3: 类型门**

Run: `npx tsc --noEmit`
Expected: 无新增报错。

- [ ] **Step 4: 提交**

```bash
git add src/pages/template
git commit -m "feat: 只读阅读页 pages/template(四 Tab 只读 + 选出发日复制)"
```

- [ ] **Step 5: 预览验证(手动,等 Phase 7 有数据后可联调)**

四 Tab 切换正常;无任何编辑/长按入口;底部复制弹出选日期 → 确认后跳到可编辑 trip。无真数据时先用控制台手插一条 `trip_templates` 文档验证(或留到部署后)。

---

## Phase 5 — 攻略库页 pages/library

### Task 11: 攻略库页(搜索 + 天数主筛选 + 次级筛选 + 网格 + 三态)

**Files:**
- Create: `src/pages/library/index.tsx`
- Create: `src/pages/library/index.scss`

- [ ] **Step 1: 写页面**

`src/pages/library/index.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { TemplateCard, TemplateQuery } from '../../types/template'
import { listTemplates } from '../../utils/templates'
import { filterTemplates } from '../../utils/template-filter'
import { DAY_CHIPS, TAG_OPTIONS, AUDIENCE_OPTIONS, SEASON_OPTIONS, CITY_OPTIONS } from '../../data/template-filters'
import type { AIAudience } from '../../types/trip'
import { useThemeClass } from '../../utils/theme-class'
import Icon from '../../components/Icon'
import './index.scss'

type Status = 'loading' | 'ready' | 'error'

function nightsLabel(dayCount: number): string {
  return `${dayCount}天${Math.max(0, dayCount - 1)}晚`
}

export default function LibraryPage() {
  const themeCls = useThemeClass()
  const [status, setStatus] = useState<Status>('loading')
  const [raw, setRaw] = useState<TemplateCard[]>([])   // 服务端按天数/城市拉回的切片
  const [keyword, setKeyword] = useState('')
  const [dayIdx, setDayIdx] = useState<number>(-1)     // DAY_CHIPS 下标,-1 = 不限
  const [tags, setTags] = useState<string[]>([])
  const [audience, setAudience] = useState<AIAudience[]>([])
  const [seasons, setSeasons] = useState<string[]>([])
  const [showMore, setShowMore] = useState(false)

  // 服务端只按「天数」收敛(主筛选),其余维度客户端精筛
  const serverQuery: TemplateQuery = useMemo(() => {
    const chip = dayIdx >= 0 ? DAY_CHIPS[dayIdx] : undefined
    return { dayCount: chip?.dayCount, dayCountGte: chip?.dayCountGte, limit: 60 }
  }, [dayIdx])

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const cards = await listTemplates(serverQuery)
      setRaw(cards)
      setStatus('ready')
    } catch (e) {
      console.error('[library] load failed', e)
      setStatus('error')
    }
  }, [serverQuery])

  useEffect(() => { void load() }, [load])

  const clientQuery: TemplateQuery = { tags, audience, seasons, keyword }
  const list = useMemo(() => filterTemplates(raw, clientQuery), [raw, tags, audience, seasons, keyword])

  const toggle = <T,>(arr: T[], v: T, set: (n: T[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const clearAll = () => { setDayIdx(-1); setTags([]); setAudience([]); setSeasons([]); setKeyword('') }
  const hasFilter = dayIdx >= 0 || tags.length || audience.length || seasons.length || keyword.trim()

  return (
    <View className={`${themeCls} lib`}>
      {/* 搜索 */}
      <View className='lib-search'>
        <Icon name='search' size={20} color='var(--ink-3)' />
        <Input className='lib-search-input' value={keyword} placeholder='搜目的地 / 攻略名'
          confirmType='search' onInput={(e) => setKeyword(e.detail.value)} />
        {keyword.length > 0 && <View onClick={() => setKeyword('')}><Icon name='close' size={18} color='var(--ink-3)' /></View>}
      </View>

      {/* 天数主筛选(紧凑一排) */}
      <ScrollView scrollX className='lib-days' showScrollbar={false}>
        <View className={`lib-day-chip ${dayIdx < 0 ? 'on' : ''}`} onClick={() => setDayIdx(-1)}>不限</View>
        {DAY_CHIPS.map((c, i) => (
          <View key={c.label} className={`lib-day-chip ${dayIdx === i ? 'on' : ''}`} onClick={() => setDayIdx(i)}>{c.label}</View>
        ))}
        <View className='lib-day-more' onClick={() => setShowMore((v) => !v)}>
          <Icon name='sliders' size={18} color={hasFilter ? 'var(--accent)' : 'var(--ink-3)'} />
        </View>
      </ScrollView>

      {/* 次级筛选(折叠) */}
      {showMore && (
        <View className='lib-more'>
          <FilterRow icon='tag' title='玩法' options={TAG_OPTIONS} selected={tags} onToggle={(v) => toggle(tags, v, setTags)} />
          <FilterRow icon='people' title='人群' options={AUDIENCE_OPTIONS} selected={audience} onToggle={(v) => toggle(audience, v as AIAudience, setAudience as (n: string[]) => void)} />
          <FilterRow icon='season' title='季节' options={SEASON_OPTIONS} selected={seasons} onToggle={(v) => toggle(seasons, v, setSeasons)} />
          {CITY_OPTIONS.length > 0 && (
            <FilterRow icon='pin' title='城市' options={CITY_OPTIONS} selected={[]} onToggle={() => {}} />
          )}
          {hasFilter && <View className='lib-clear' onClick={clearAll}>清空筛选</View>}
        </View>
      )}

      {/* 列表 / 三态 */}
      {status === 'loading' && (
        <View className='lib-grid'>
          {[0, 1, 2, 3].map((i) => <View key={i} className='lib-card lib-card-skel' />)}
        </View>
      )}
      {status === 'error' && (
        <View className='lib-empty'>
          <Text className='lib-empty-t'>加载失败,请检查网络</Text>
          <View className='lib-empty-btn' onClick={() => void load()}>重试</View>
        </View>
      )}
      {status === 'ready' && list.length === 0 && (
        <View className='lib-empty'>
          <Text className='lib-empty-t'>没有符合条件的攻略</Text>
          <Text className='lib-empty-sub'>试着放宽天数或清空筛选</Text>
          {hasFilter && <View className='lib-empty-btn' onClick={clearAll}>清空筛选</View>}
        </View>
      )}
      {status === 'ready' && list.length > 0 && (
        <ScrollView scrollY className='lib-scroll'>
          <View className='lib-grid'>
            {list.map((c) => (
              <View key={c._id} className='lib-card' onClick={() => Taro.navigateTo({ url: `/pages/template/index?id=${c._id}` })}>
                <Text className='lib-card-name'>{c.name}</Text>
                <View className='lib-card-meta'>
                  <Icon name='pin' size={13} color='var(--ink-3)' />
                  <Text>{c.city}</Text>
                  <Text className='lib-card-dot'>·</Text>
                  <Text>{nightsLabel(c.dayCount)}</Text>
                </View>
                <Text className='lib-card-sub'>{c.spotCount} 个地点</Text>
                {c.tags?.length > 0 && (
                  <View className='lib-card-tags'>
                    {c.tags.slice(0, 3).map((t) => <Text key={t} className='lib-card-tag'>{t}</Text>)}
                  </View>
                )}
              </View>
            ))}
          </View>
          <View className='lib-grid-pad' />
        </ScrollView>
      )}
    </View>
  )
}

function FilterRow({ icon, title, options, selected, onToggle }: {
  icon: 'tag' | 'people' | 'season' | 'pin'
  title: string
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <View className='lib-frow'>
      <View className='lib-frow-h'><Icon name={icon} size={16} color='var(--ink-3)' /><Text className='lib-frow-t'>{title}</Text></View>
      <View className='lib-frow-chips'>
        {options.map((o) => (
          <View key={o} className={`lib-chip ${selected.includes(o) ? 'on' : ''}`} onClick={() => onToggle(o)}>{o}</View>
        ))}
      </View>
    </View>
  )
}
```

- [ ] **Step 2: 写样式**

`src/pages/library/index.scss`:

```scss
.lib { display: flex; flex-direction: column; min-height: 100vh; background: var(--bg); color: var(--ink); }

.lib-search { display: flex; align-items: center; gap: 12px; margin: 24px 28px 12px; padding: 18px 24px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); }
.lib-search-input { flex: 1; font-size: 28px; color: var(--ink); }

.lib-days { white-space: nowrap; padding: 8px 28px; }
.lib-day-chip { display: inline-block; padding: 10px 24px; margin-right: 12px; border-radius: 999px; font-size: 26px; background: var(--surface); border: 1px solid var(--line); color: var(--ink); }
.lib-day-chip.on { background: var(--accent); color: #fff; border-color: var(--accent); }
.lib-day-more { display: inline-flex; align-items: center; padding: 12px; vertical-align: middle; }

.lib-more { padding: 8px 28px 16px; border-bottom: 1px solid var(--line); }
.lib-frow { padding: 12px 0; }
.lib-frow-h { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.lib-frow-t { font-size: 24px; color: var(--ink-3); }
.lib-frow-chips { display: flex; flex-wrap: wrap; gap: 12px; }
.lib-chip { padding: 8px 20px; border-radius: 999px; font-size: 24px; background: var(--surface); border: 1px solid var(--line); color: var(--ink); }
.lib-chip.on { background: var(--accent); color: #fff; border-color: var(--accent); }
.lib-clear { margin-top: 12px; font-size: 24px; color: var(--accent); }

.lib-scroll { flex: 1; }
.lib-grid { display: flex; flex-wrap: wrap; gap: 20px; padding: 20px 28px; }
.lib-card { width: calc(50% - 10px); box-sizing: border-box; padding: 24px; border-radius: 20px; background: var(--surface); border: 1px solid var(--line); }
.lib-card-skel { height: 200px; opacity: 0.5; }
.lib-card-name { font-size: 30px; font-weight: 600; line-height: 1.3; }
.lib-card-meta { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 24px; color: var(--ink-3); }
.lib-card-dot { color: var(--line); }
.lib-card-sub { display: block; margin-top: 6px; font-size: 22px; color: var(--ink-3); }
.lib-card-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.lib-card-tag { font-size: 20px; padding: 4px 12px; border-radius: 8px; background: var(--bg); border: 1px solid var(--line); }
.lib-grid-pad { height: 40px; }

.lib-empty { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 120px 0; }
.lib-empty-t { font-size: 30px; }
.lib-empty-sub { font-size: 24px; color: var(--ink-3); }
.lib-empty-btn { padding: 16px 40px; border-radius: 999px; background: var(--accent); color: #fff; font-size: 26px; }
```

- [ ] **Step 3: 类型门**

Run: `npx tsc --noEmit`
Expected: 无新增报错。

- [ ] **Step 4: 提交**

```bash
git add src/pages/library
git commit -m "feat: 攻略库页 pages/library(搜索+天数主筛选+次级筛选+网格+三态)"
```

---

## Phase 6 — 首页接精选 + seed 全链路清理

> 顺序要点:先把首页精选改为云端来源并去 seed,再删 seed 文件,最后清理 store/trip/db,保证每步 tsc 可过。

### Task 12: 首页精选区接云端 + 去 seed

**Files:**
- Modify: `src/pages/home/index.tsx`
- Modify: `src/pages/home/shared.tsx`
- Modify: `src/pages/home/HomeTegami.tsx`
- Modify: `src/pages/home/HomeMagazine.tsx`

- [ ] **Step 1: shared.tsx 增精选字段**

`src/pages/home/shared.tsx` 的 `HomeViewProps` 追加:

```ts
  /** 云端精选模板(轻字段) */
  featuredTemplates: import('../../types/template').TemplateCard[]
  onOpenTemplate: (id: string) => void
  onOpenLibrary: () => void
```

- [ ] **Step 2: home/index.tsx 去 SEED_TRIPS、改精选来源**

改动点(逐处):

1) 删除第 6 行 `import { SEED_TRIPS, isSeedTripId } from '../../data/seed-trips'`,新增:

```ts
import { listFeaturedTemplates, getFeaturedCache } from '../../utils/templates'
import type { TemplateCard } from '../../types/template'
```

2) 第 25 行注释保留;`trips` 初始 state 改为不掺 seed:

```ts
  const [trips, setTrips] = useState<Trip[]>(() => {
    try {
      const cached = Taro.getStorageSync(STORAGE_KEY) as Trip[] | ''
      if (Array.isArray(cached) && cached.length) return cached
    } catch { /* ignore */ }
    return []
  })
```

3) `loadTrips` 内 `setTrips([...SEED_TRIPS, ...list])` → `setTrips(list)`;AI 轮询块(第 86 行)同理 `setTrips(list)`。

4) 新增精选 state + 拉取(挂载并行,先回缓存):

```ts
  const [featuredTemplates, setFeaturedTemplates] = useState<TemplateCard[]>(() => getFeaturedCache() || [])
  useEffect(() => {
    listFeaturedTemplates(8).then(setFeaturedTemplates).catch((e) => console.warn('[home] featured', e))
  }, [])
```

5) `onCoverLongPress`(第 231-237 行)去掉 seed 守卫:

```ts
    onCoverLongPress: (t) => setCoverTrip(t),
```

6) `props` 追加三字段:

```ts
    featuredTemplates,
    onOpenTemplate: (id) => Taro.navigateTo({ url: `/pages/template/index?id=${id}` }),
    onOpenLibrary: () => Taro.navigateTo({ url: '/pages/library/index' }),
```

7) `TripActionSheet` 的 `actions={actionTrip && isSeedTripId(actionTrip._id) ? ['copy'] : undefined}`(第 250 行)→ 删除该 prop(普通 trip 用默认 actions):

```tsx
      <TripActionSheet
        open={!!actionTrip}
        tripName={actionTrip?.name || ''}
        onSelect={handleAction}
        onClose={() => setActionTrip(null)}
      />
```

8) `handleAction` 里的 `'copy'` 分支(第 137-142 行)保留与否:`copyTripLocally` 仍用于用户复制自己的 trip(非 seed),保留。但其 import 在 Task 14 会因 db.ts 改动而变化——此处不动。

- [ ] **Step 3: HomeMagazine.tsx 去 seed featured 兜底**

`src/pages/home/HomeMagazine.tsx`:删第 10 行 `import { isSeedTripId } ...`;第 26 行 `const userTrips = trips.filter((t) => !isSeedTripId(t._id))` → `const userTrips = trips`;第 28 行 `const featured = sortedUser[0] ?? trips.find((t) => isSeedTripId(t._id))` → `const featured = sortedUser[0]`。

- [ ] **Step 4: HomeTegami.tsx 去示例角标**

`src/pages/home/HomeTegami.tsx`:删第 10 行 import;第 58 行 `const isCollab = t._openid !== openid && !isSeedTripId(t._id)` → `const isCollab = t._openid !== openid`;删第 59 行 `const isSeed = ...`;删第 80 行 `{isSeed && <View ...>示例</View>}`。

- [ ] **Step 5: 四主题变体渲染精选区(最小版)**

在 `HomeTegami` / `HomeMagazine` / `HomePostcard` / `HomeMinimal` 各自合适位置(列表上方或下方)插入精选横滑区。最小统一片段(用各文件已有 props,新增 `featuredTemplates/onOpenTemplate/onOpenLibrary`):

```tsx
{featuredTemplates.length > 0 && (
  <View className='home-featured'>
    <View className='home-featured-h'>
      <Text className='home-featured-t'>精选攻略</Text>
      <Text className='home-featured-more' onClick={onOpenLibrary}>查看全部 ›</Text>
    </View>
    <ScrollView scrollX className='home-featured-row' showScrollbar={false}>
      {featuredTemplates.map((c) => (
        <View key={c._id} className='home-featured-card' onClick={() => onOpenTemplate(c._id)}>
          <Text className='home-featured-name'>{c.name}</Text>
          <Text className='home-featured-meta'>{c.city} · {c.dayCount}天{Math.max(0, c.dayCount - 1)}晚</Text>
        </View>
      ))}
    </ScrollView>
  </View>
)}
```

> 注:`ScrollView`/`Text`/`View` 需在各文件已 import(多数已有);若缺则补 import。各变体的 props 解构需加上 `featuredTemplates, onOpenTemplate, onOpenLibrary`。配套样式加进各自 `.scss`(或共享 `home/index.scss`):`.home-featured-row{white-space:nowrap}` `.home-featured-card{display:inline-block;width:300px;margin-right:16px;padding:20px;border-radius:16px;background:var(--surface);border:1px solid var(--line)}` 等。

- [ ] **Step 6: 类型门**

Run: `npx tsc --noEmit`
Expected: 无新增报错(此时 seed 文件仍在,Task 13 再删)。

- [ ] **Step 7: 提交**

```bash
git add src/pages/home
git commit -m "feat: 首页精选区接云端模板 + 移除 seed 角标/兜底"
```

### Task 13: trip-store / trip 页去 seed,删 seed 文件

**Files:**
- Modify: `src/store/trip-store.tsx:6,154-163,204-215`
- Modify: `src/pages/trip/index.tsx:23,228-231,321`
- Modify: `src/utils/db.ts:4,86-112`
- Delete: `src/data/seed-trips.ts`, `src/data/seed-trips.json`

- [ ] **Step 1: trip-store.tsx 去 seed 本地加载分支**

删第 6 行 `import { isSeedTripId, getSeedTrip } from '../data/seed-trips'`。
删第 144 行 `const seedWarningShownRef = useRef(false)`。
删初次拉取里的 seed 整段(第 153-163 行,即 `if (isSeedTripId(tripId)) { ... return }`),让 `getTrip` 成为唯一路径。
删 debounce 保存里的 seed 整段(第 204-215 行,即 `if (isSeedTripId(tripId)) { ...警告... return }`)。

- [ ] **Step 2: trip/index.tsx 去 seed 分支**

删第 23 行 `import { isSeedTripId } from '../../data/seed-trips'`。
删第 228-231 行的 `if (isSeedTripId(t._id)) { Taro.showToast(...); return }`。
第 321 行 `actions={isSeedTripId(t._id) ? ['copy'] : undefined}` → 删该 prop:

```tsx
      <TripActionSheet
        open={actionOpen}
        tripName={t.name}
        onSelect={handleAction}
        onClose={() => setActionOpen(false)}
      />
```

> 注:trip 页的 `'copy'` action(第 219-226 行,`copyTripLocally`)用于用户复制自己已有的 trip,保留。

- [ ] **Step 3: db.ts 去 seed import + copyTripLocally seed 分支**

删第 4 行 `import { isSeedTripId, getSeedTrip } from '../data/seed-trips'`。
`copyTripLocally` 内第 91-94 行:

```ts
  const src = isSeedTripId(sourceTripId)
    ? getSeedTrip(sourceTripId)
    : await getTrip(sourceTripId)
  if (!src) throw new Error('source trip not found')
```

改为:

```ts
  const src = await getTrip(sourceTripId)
  if (!src) throw new Error('source trip not found')
```

- [ ] **Step 4: 删 seed 文件**

```bash
git rm src/data/seed-trips.ts src/data/seed-trips.json
```

- [ ] **Step 5: 确认无残留引用**

Run: `grep -rn "seed-trips\|isSeedTripId\|getSeedTrip\|SEED_TRIPS\|isSeed" src`
Expected: 无输出(全部清理干净)。

- [ ] **Step 6: 类型门**

Run: `npx tsc --noEmit`
Expected: 无新增报错。

- [ ] **Step 7: 提交**

```bash
git add -A src
git commit -m "refactor: 移除 seed 示例攻略全链路(store/trip/db + 删数据文件)"
```

---

## Phase 7 — 初始数据 + 用户侧部署清单

### Task 14: 初始模板 JSON(由旧 seed 内容转换)

**Files:**
- Create: `docs/superpowers/deploy/trip-templates-seed.json`

> seed 文件已在 Task 13 删除,但其内容可从 git 历史取回:`git show HEAD~1:src/data/seed-trips.json`(取删除前那次提交)。基于两条旧示例(南京金陵四日、南京→大兴安岭寻北)转换。

- [ ] **Step 1: 取回旧内容**

Run: `git show HEAD~1:src/data/seed-trips.json > /tmp/old-seed.json && node -e "const a=require('/tmp/old-seed.json'); console.log(a.length, a.map(t=>t.name))"`
Expected: 打印 `2` 与两条攻略名。

- [ ] **Step 2: 生成模板 JSON**

把 `/tmp/old-seed.json` 的每条转换为模板文档:
- 删除字段:`_id`、`_openid`、`ownerOpenid`、`ownerNickname`、`ownerAvatarUrl`、`collaborators`、`collaboratorOpenids`、`updatedBy`、`aiTaskId`/`aiStatus`/`aiDraft`/`aiError`、`createdAt`/`updatedAt`、`coverUrl`。
- 每个 `days[i].weather` 设为 `null`。
- 新增字段(逐条人工填,示例值):

```json
{
  "city": "南京",
  "region": "江苏",
  "dayCount": 4,
  "spotCount": 0,
  "tags": ["历史人文", "美食", "citywalk"],
  "audience": ["情侣", "朋友"],
  "seasons": ["春", "秋"],
  "featured": true,
  "sortWeight": 100,
  "coverImages": [],
  "version": 1,
  "updatedAt": 1750000000000
}
```

`dayCount` = `days.length`;`spotCount` = 各 `days[i].spots.length` 之和(用脚本算):

Run: `node -e "const a=require('/tmp/old-seed.json'); a.forEach(t=>console.log(t.name, t.days.length, t.days.reduce((n,d)=>n+d.spots.length,0)))"`
Expected: 打印每条的天数与地点数,据此填 `dayCount`/`spotCount`。

把两条转换结果写入 `docs/superpowers/deploy/trip-templates-seed.json`(数组,2 个对象)。

- [ ] **Step 3: 校验 JSON 合法**

Run: `node -e "const a=require('./docs/superpowers/deploy/trip-templates-seed.json'); console.log('ok', a.length, a.every(t=>t.dayCount===t.days.length))"`
Expected: 打印 `ok 2 true`。

- [ ] **Step 4: 提交**

```bash
git add docs/superpowers/deploy/trip-templates-seed.json
git commit -m "chore: 攻略库初始模板数据(由旧 seed 转换)"
```

### Task 15: 用户侧 CloudBase 部署清单

**Files:**
- Create: `docs/superpowers/deploy/2026-06-16-template-library-cloudbase.md`

- [ ] **Step 1: 写部署文档**

`docs/superpowers/deploy/2026-06-16-template-library-cloudbase.md`(标题用有序编号,表格不加粗):

```markdown
# 攻略库 CloudBase 部署清单

1. 建集合

1.1. 在云开发控制台「数据库」新建集合 trip_templates。

2. 安全规则

2.1. 集合 trip_templates 的权限设为「自定义安全规则」,内容:

{
  "read": true,
  "write": false
}

2.2. 含义:全员可读,客户端禁写;写入仅经控制台/CLI 管理员通道。

3. 部署云函数 clone-template

3.1. 在微信开发者工具 cloudfunctions/clone-template 右键「上传并部署:云端安装依赖」。

3.2. 确认 trips 集合写权限允许云函数写入(沿用 clone-trip 的现有配置)。

4. 导入初始数据

4.1. 在 trip_templates 集合「导入」docs/superpowers/deploy/trip-templates-seed.json。

4.2. 导入后抽查:至少 1 条 featured=true,dayCount 与 days 长度一致。

5. 联调验证

5.1. 小程序首页应出现「精选攻略」横滑区。

5.2. 进入模板 → 四 Tab 只读 → 复制选出发日 → 跳转到可编辑 trip,日期从所选出发日顺延。

5.3. 攻略库页天数 chip / 次级筛选 / 搜索均生效,无结果/无网络/loading 三态正常。
```

- [ ] **Step 2: 提交**

```bash
git add docs/superpowers/deploy/2026-06-16-template-library-cloudbase.md
git commit -m "docs: 攻略库 CloudBase 部署清单"
```

### Task 16: 更新 CLAUDE.md 架构说明

**Files:**
- Modify: `CLAUDE.md`(§3.3 数据流、§3.4 云函数计数)

- [ ] **Step 1: 改 §3.3**

把「示例攻略 seed-trips」段落替换为:模板由云端 `trip_templates` 集合提供,只读;读取走 `src/utils/templates.ts` 直查 + SWR,复制走 `clone-template` 云函数;前端不再含本地 seed。

- [ ] **Step 2: 改 §3.4**

云函数数量 10 → 11,新增 `clone-template`(复制模板到 trips,带日期 rebase)。

- [ ] **Step 3: 提交**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md 更新攻略库数据流与云函数清单"
```

---

## Phase 8(后续小任务)— 全 App emoji 清理

> 独立于攻略库 PR(§9.4),避免主 PR 过大。可在攻略库合并后单开分支。

### Task 17: 替换现存 emoji 为 <Icon>

**Files(逐一排查):**
- `src/views/PackingView/*`、`src/data/packing.ts`(PackingCategory.icon 的 ◇◆◈ 等字符)
- `src/views/ItineraryView/*`(SpotCard 等)、`src/components/AILoadingTheater/*`、`src/components/AIPlanPreview/*`、`src/pages/home/HomePostcard.tsx`

- [ ] **Step 1: 全量定位**

Run: `grep -rnP "[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2190}-\x{21FF}\x{25A0}-\x{25FF}]" src --include=*.tsx --include=*.ts | grep -v "components/Icon"`
Expected: 输出所有含 emoji/符号字形的位置清单(含 ItineraryView 里 `←⇤⇥→` 等操作箭头、packing 的 ◇◆ 等)。

- [ ] **Step 2: 逐处替换**

每处用对应 `<Icon name=... />` 替换;`PackingCategory.icon` 字段从字形改为 `IconName`(如 `'pk-id'` 类),并在 Icon 的 `PATHS` 中补齐 `pk-*` 行李分类图标(从 triplist-design/project/icons.jsx 的 `pk-id/pk-cloth/pk-elec/pk-care/pk-med` 移植)。ActionSheet 文案里的箭头(`←/→/⇤/⇥`)属纯文本提示,可保留或改用文字「前移/移到最前」。

- [ ] **Step 3: 类型门 + 预览**

Run: `npx tsc --noEmit`
Expected: 无新增报错。预览各页确认图标显示正常、无残留 emoji。

- [ ] **Step 4: 提交**

```bash
git add -A src
git commit -m "refactor: 全 App emoji 替换为统一 Icon"
```

---

## Self-Review

1. Spec 覆盖核对

1.1. §2.1 独立只读页 → Task 10(pages/template,无编辑入口)。✓
1.2. §2.2 V3 自适应首页 + 精选 → Task 12(featuredTemplates + 横滑区 + 查看全部)。✓ 注:空状态置顶引导依赖各变体已有空态;若变体无空态,执行时在 Step 5 一并补。
1.3. §2.3 集合 trip_templates + 安全规则 → Task 15(部署清单)。✓
1.4. §2.6 clone-template → Task 1-2。✓
1.5. §3.1 字段 → Task 3(类型)+ Task 14(数据)。✓
1.6. §3.4 日期语义 + §4.2 rebase → Task 1(纯逻辑+测)+ Task 2(云函数)。✓
1.7. §3.5 筛选模型(天数主 + 维度内 OR/跨维度 AND)→ Task 6 + Task 7 + Task 11。✓
1.8. §5.1 templates.ts(featured/list/get/clone + SWR + 轻字段)→ Task 5。✓
1.9. §5.2 四 Tab 只读 + 复制选出发日 → Task 10。✓
1.10. §5.3 搜索 + 天数 chip + 次级 + 三态 → Task 11。✓
1.11. §5.5 清理 6 文件 → Task 12(home×3)+ Task 13(store/trip/db + 删文件)。✓
1.12. §5.6 注册页面 → Task 8。✓
1.13. §9 Icon 体系 + 全 App emoji → Task 9 + Task 17。✓

2. Placeholder 扫描:已为每个写代码步骤给出完整代码;Task 14 的数据转换给了取数脚本与字段模板(非 TODO);Task 12/13 给了逐行 old→new。无「TBD/类似上文」。

3. 类型一致性核对

3.1. 集合名统一 `trip_templates`;云函数名统一 `clone-template`;入参统一 `{ templateId, startDate }`。
3.2. `cloneTemplate(id, startDate)`(templates.ts)→ `cloud.cloneTemplate({templateId,startDate})`(cloud.ts)→ 云函数 event 同名。✓
3.3. `IconName` 在 Icon/index.tsx 定义并被 template/library 页 import 复用;`PATHS` 覆盖所用全部 name。Task 17 若用 `pk-*` 需先补 PATHS(已在 Task 17 Step 2 注明)。✓
3.4. `TemplateCard` 字段(name/city/region/dayCount/spotCount/tags/audience/seasons/coverImages)与 `CARD_FIELD` 投影一致。✓
3.5. `aggregateBudget`/`collectLocated` 接收 `Trip`,reader 用 `tpl as unknown as Trip` 传入(只读 days/pax,已注释)。✓

---

## 执行入口

部署门(Task 15)依赖用户在 CloudBase 侧建集合/设规则/部署/导数据;前端代码任务(Task 1-14、16)可先全部完成并 tsc 通过,联调与预览在用户完成云端步骤后进行。
