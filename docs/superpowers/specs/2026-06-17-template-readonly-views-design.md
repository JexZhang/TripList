# 模板只读页复用真实视图 + 复制 Bug 修复

**日期**: 2026-06-17
**状态**: 用户已批准（方案 A）
**范围**: `pages/template`、`store/trip-store`、四个视图、两个云函数

## 背景

模板只读阅读页 (`pages/template`) 必须复用真实的 ItineraryView / MapView / BudgetView / PackingView，以「只读」方式展示，内容与真实攻略逐像素一致（含地点描述、每日预算图表+明细、地图分 day 标签），仅去掉编辑入口。

当前实现为绕开 trip-store 耦合，另写了一套简化的 `.tpl-itin/.tpl-bud/.tpl-map/.tpl-pack` 视图。用户否决："模板攻略除了只读之外所有的展示都应该和正常攻略一样，现在全是简化版的，用户怎么会想复制"。简化版要删除。

**Why:** 简化展示让用户看不到模板价值，没有复制欲望；且与真实视图持续漂移。

## 决策记录

| 决策点 | 选项 | 选定 |
|--------|------|------|
| readonly 传递方式 | a) context 暴露 / b) dispatch no-op / c) 两者结合 | **c: context 暴露 readonly + dispatch no-op 双重保障** |
| openid 处理 | 可选 / 空字符串 / 必须登录 | **必须登录**（模板库仅登录用户可访问），openid 正常传入 |
| 模板页壳 | 保留现有 / 改用 TripHeader | **保留现有模板壳**（hero + tabs + CTA），仅 tab 下方内容区换真实视图 |
| 地图定位按钮 | 保留 / 隐藏 | **只读时隐藏**「回到我的位置」 |

## 设计

### §1 TripProvider 改造

**文件**: `src/store/trip-store.tsx`

**签名变化:**

```ts
// 改前
TripProvider({ tripId, openid, children }: { tripId: string; openid: string; children: ReactNode })

// 改后
TripProvider({
  tripId?,          // 可选：传 initialTrip 时不需要
  openid,           // 必填（模板页也要求登录）
  children,
  initialTrip?,     // 可选 Trip：只读模式下直接初始化 state
  readonly?,        // 可选 boolean，默认 false
})
```

**内部逻辑分支:**

| 行为 | 正常模式 (`readonly=false`) | 只读模式 (`readonly=true`) |
|------|---------------------------|---------------------------|
| 初始化 state | `getTrip(tripId)` 异步拉取 | 直接用 `initialTrip`，state 立即 ready（`loading: false`） |
| watch 订阅 | `Taro.cloud.database().collection('trips').doc(tripId).watch(...)` | 跳过，不创建 watcher |
| 防抖保存 effect | 500ms debounce → `updateTrip()` | 跳过，不注册该 effect |
| dispatch | 正常 reducer | 包裹一层：readonly 时直接 return（no-op） |

**Context 扩展:**

```ts
interface ContextValue {
  state: State
  dispatch: React.Dispatch<Action>
  openid: string
  readonly: boolean  // 新增
}
```

`useTripStore()` 返回值自动带上 `readonly`，下游视图直接读取。

**真实攻略页零影响:** `trip/index.tsx` 调用方式不变（`<TripProvider tripId={tripId} openid={openid}>`），`readonly` 默认 `false`。

### §2 四个视图的只读适配

每个视图做两件事：**JS 条件渲染** + **CSS `.is-ro` 隐藏**。

#### 2a. JS 条件渲染（不渲染交互弹层）

| 视图 | 文件 | 只读时不渲染 |
|------|------|-------------|
| ItineraryView | `src/views/ItineraryView/index.tsx` | `SpotSearch`、`EditSpotSheet` |
| BudgetView | `src/views/BudgetView/index.tsx` | `EditSpotSheet`；「最贵一笔」行和分类明细行不绑定 `onClick` |
| MapView | `src/views/MapView/index.tsx` | `SheetContainer`（点 marker 气泡不弹详情）；隐藏 `.mv-locate-btn` |
| PackingView | `src/views/PackingView/index.tsx` | `TemplateImport`；不渲染输入框（`draftByCat`）和删除操作 |

每个视图根节点根据 `readonly` 加 `is-ro` CSS 类：

```tsx
<View className={`itinerary${readonly ? ' is-ro' : ''}`}>
```

#### 2b. CSS `.is-ro` 规则（只改 4 个 index.scss）

| 文件 | 隐藏的选择器（精确类名） |
|------|------------------------|
| `ItineraryView/index.scss` | `.is-ro .dt-add`（DayTabs 添加天按钮，4 变体共享基类）；`.is-ro .itintg-add, .is-ro .itinmg-add, .is-ro .itinpp-add, .is-ro .itinmin-add`（各变体「+ 添加地点」按钮） |
| `MapView/index.scss` | `.is-ro .mv-locate-btn`（「回到我的位置」按钮） |
| `PackingView/index.scss` | `.is-ro .ptg-add-row, .is-ro .ptg-add-btn, .is-ro .pmg-add, .is-ro .ppp-add, .is-ro .ppp-add-btn, .is-ro .pmin-add, .is-ro .pmin-box--add`（各变体输入行和添加按钮） |
| `BudgetView/index.scss` | 无需 CSS 改动（交互元素已通过 JS 条件渲染处理） |

**不改 22 个主题变体文件**（ItinTegami / ItinMagazine / PackTegami 等）。

### §3 template/index.tsx 集成

#### 3a. Template → Trip 适配函数

新增纯函数，仅用于只读展示（非复制）：

```ts
function templateAsTrip(tpl: Template): Trip {
  return {
    ...tpl,
    _openid: '',
    ownerOpenid: '',
    collaborators: [],
    updatedBy: '',
    aiTaskId: null,
    aiStatus: null,
    aiDraft: null,
    aiError: null,
  }
}
```

`Template` 本身 `extends Omit<Trip, ...>`，核心字段（days、packing、destinations、pax）结构完全一致，展开即可。

#### 3b. 渲染结构

```tsx
<TripProvider initialTrip={templateAsTrip(tpl)} readonly openid={openid}>
  {/* 保留现有壳 */}
  <View className='tpl-top'>...</View>     // 顶栏 + 返回 + 只读徽标
  <View className='tpl-hero'>...</View>    // 名称 + 城市 + 天数 + 标签
  <View className='tpl-tabs'>...</View>    // 四 tab

  {/* tab 内容区：换成真实视图 */}
  <View className='tpl-body'>
    {tab === 'itinerary' && <ItineraryView />}
    {tab === 'map'      && <MapView />}
    {tab === 'budget'   && <BudgetView />}
    {tab === 'packing'  && <PackingView />}
  </View>

  {/* 保留底部 CTA + 复制 sheet */}
  <View className='tpl-cta'>...</View>
  {copyOpen && <复制sheet />}
</TripProvider>
```

#### 3c. 删除简化版

- 删除内联组件：`TemplateMap`、`TemplateBudget`、`TemplatePacking`
- 删除不再需要的 import：`Map as TaroMap`、`Picker`、`aggregateBudget`、`conicFromBuckets`、`collectLocated`、`dayColor`、`encodeMarkerId`、`PACKING_CATEGORIES`、`SpotType`、`SPOT_ICON`

#### 3d. 滚动容器适配

`.tpl-body` 从 `ScrollView` 改为普通 `View`（`flex: 1; overflow: hidden`），让真实视图自行管理滚动，避免嵌套 ScrollView 冲突。

### §4 CSS 与清理

**`template/index.scss` 调整:**

- `.tpl-body`：去掉 `ScrollView` 相关样式，改为 `flex: 1; overflow: hidden` 的普通容器
- 删除所有简化版样式：`.tpl-itin`、`.tpl-day`、`.tpl-day-head`、`.tpl-day-no`、`.tpl-day-empty`、`.tpl-spot`、`.tpl-spot-time`、`.tpl-spot-name`、`.tpl-spot-price`、`.tpl-map-wrap`、`.tpl-map`、`.tpl-map-empty`、`.tpl-bud`、`.tpl-bud-head`、`.tpl-bud-total`、`.tpl-bud-perpax`、`.tpl-bud-donut`、`.tpl-bud-donut-hole`、`.tpl-bud-legend`、`.tpl-bud-row`、`.tpl-bud-sw`、`.tpl-bud-label`、`.tpl-bud-pct`、`.tpl-bud-v`、`.tpl-pack`、`.tpl-pack-group`、`.tpl-pack-cat`、`.tpl-pack-row`、`.tpl-pack-label`、`.tpl-pack-empty` 及对应的 empty 状态样式
- 保留壳样式：`.tpl-top`、`.tpl-readonly`、`.tpl-hero`、`.tpl-tabs`、`.tpl-cta`、`.tpl-sheet-*`

**不改动:**

- 22 个主题变体文件零改动
- 4 个 PackingView 变体文件零改动
- `trip/index.tsx`（真实攻略页）零改动

### §5 Bug 修复：模板/分享复制后攻略丢失

**根因:** `clone-template` 和 `clone-trip` 两个云函数在 `db.collection('trips').add()` 时未显式写入 `_openid` 字段。微信云开发中，`_openid` 仅在客户端 SDK 调用 `add()` 时自动注入，云函数（服务端）调用时不会自动注入。导致新 trip 文档缺少 `_openid`，而 `list-my-trips` 查询条件 `{ _openid: OPENID }` 匹配不到。

**修复:**

`cloudfunctions/clone-template/index.js`:

```js
const created = await db.collection(TRIPS).add({
  data: {
    _openid: OPENID,    // ← 新增
    ...rest,
    days,
    startDate: s,
    endDate,
    ownerOpenid: OPENID,
    // ... 其余不变
  },
})
```

`cloudfunctions/clone-trip/index.js`:

```js
const created = await db.collection('trips').add({
  data: {
    _openid: OPENID,    // ← 新增
    ...rest,
    ownerOpenid: OPENID,
    // ... 其余不变
  },
})
```

## 影响范围

| 区域 | 改动类型 | 文件 |
|------|---------|------|
| TripProvider | 功能扩展 | `src/store/trip-store.tsx` |
| ItineraryView | readonly 适配 | `src/views/ItineraryView/index.tsx` + `index.scss` |
| MapView | readonly 适配 | `src/views/MapView/index.tsx` + `index.scss` |
| BudgetView | readonly 适配 | `src/views/BudgetView/index.tsx` |
| PackingView | readonly 适配 | `src/views/PackingView/index.tsx` + `index.scss` |
| 模板页 | 重写内容区 | `src/pages/template/index.tsx` + `index.scss` |
| clone-template | bug 修复 | `cloudfunctions/clone-template/index.js` |
| clone-trip | bug 修复 | `cloudfunctions/clone-trip/index.js` |

## 副作用

此改法同时修复模板页「内容超出屏幕宽度」问题——真实视图宽度本就正确；简化页的横向溢出根因是满宽 flex 子项带 padding 但非 border-box，全局无 `* { box-sizing }`。
