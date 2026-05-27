# 子项目 D · 出行前/中/后差异化

> 设计意图来源：[triplist-design/project/前端优化方向.html](../../../triplist-design/project/前端优化方向.html) 第 8 节
>
> 上层 design system 文档：[2026-05-26-design-system-application-design.md](./2026-05-26-design-system-application-design.md)

---

## 1. 目标

1.1. 根据 trip.startDate / endDate 与今天的关系自动判定 trip 阶段（pre / live / post）。

1.2. 4 主题首页卡片插入统一的 `<TripPhaseChip>`（小空间，短文案）。

1.3. 4 主题 trip 详情页在 TripHeader 之下、4-tab 之上插入统一的 `<TripPhaseHero>`（大空间，完整三态视觉）。

1.4. 接入 amap-weather 云函数：PRE 显示行程期间预报；LIVE 显示当前城市今日天气。

---

## 2. 范围

### 2.1. 涵盖

2.1.1. utils/trip-phase.ts：phase 判定 + Live 上下文推导 + Post 统计 + 距离计算

2.1.2. hooks/use-trip-weather.ts：调 amap-weather 云函数 + Taro storage 缓存（TTL 1 小时）

2.1.3. 新增组件 TripPhaseChip / TripPhaseHero（DOM 同构，主题 token 适配）

2.1.4. 4 主题 home 子组件接入 TripPhaseChip

2.1.5. trip 页（src/pages/trip/index.tsx）接入 TripPhaseHero

### 2.2. 不涵盖

2.2.1. 地理定位（不开 GPS 权限）

2.2.2. 一键叫车/导航跳高德 deeplink

2.2.3. POST canvas 可分享回顾图

2.2.4. km 数 / 最贵餐统计（POST 仅 3 字段：天数 / spots / 总花费）

2.2.5. 主题各自定制三态视觉（统一组件方式）

2.2.6. 跨时区处理（按设备本地时区）

---

## 3. 架构

### 3.1. 数据流

```
Trip
  ├─ getTripPhase(startDate, endDate, now)        → 'pre' | 'live' | 'post'
  ├─ getLiveContext(trip, now)                    → { currentDay, currentSpot, nextSpot, nextDay, status }
  ├─ getPostStats(trip)                           → { days, spotsCount, totalCost }
  └─ useTripWeather(trip, phase)                  → { loading, pre?, liveToday? }

TripPhaseChip(trip)                                 → 首页卡片渲染（chip 文案 + 视觉）
TripPhaseHero(trip)                                 → trip 页渲染（大版面三态）
```

### 3.2. 缓存策略

3.2.1. Phase / Live / Stats：纯前端纯函数 + 组件层 useMemo，无持久化。

3.2.2. Weather：Taro storage key `weather:<city>:<YYYY-MM-DD>`，TTL 1 小时；命中即用，未命中调云函数后写入。

### 3.3. Live 自动刷新

TripPhaseHero / TripPhaseChip 在 phase === 'live' 时挂 `setInterval` 每 60s 触发一次 `forceUpdate`，让 currentSpot/nextSpot 在时刻过期后切换。组件卸载清 interval。

---

## 4. 模块设计

### 4.1. utils/trip-phase.ts

4.1.1. 类型与判定：

```typescript
import dayjs, { type Dayjs } from 'dayjs'
import type { Trip, Day, Spot } from '../types/trip'

export type TripPhase = 'pre' | 'live' | 'post'

export function getTripPhase(startDate: string, endDate: string, now: Dayjs = dayjs()): TripPhase {
  const today = now.startOf('day')
  const start = dayjs(startDate).startOf('day')
  const end = dayjs(endDate).startOf('day')
  if (today.isBefore(start)) return 'pre'
  if (today.isAfter(end)) return 'post'
  return 'live'
}
```

4.1.2. PRE 倒计时：

```typescript
export function getDaysUntilStart(startDate: string, now: Dayjs = dayjs()): number {
  return Math.max(0, dayjs(startDate).startOf('day').diff(now.startOf('day'), 'day'))
}
```

4.1.3. Live 上下文：

```typescript
export type LiveStatus =
  | 'before-first'   // 今日尚未开始
  | 'in-progress'    // 进行中
  | 'after-last'     // 今日已收官
  | 'rest-day'       // 今日有 day 但 spots 为空
  | 'no-day'         // 今日不在 trip.days 中

export interface LiveContext {
  currentDay: Day | null
  currentSpot: Spot | null
  nextSpot: Spot | null
  nextDay: Day | null    // 当 nextSpot 在明天时填这个
  status: LiveStatus
}

export function getLiveContext(trip: Trip, now: Dayjs = dayjs()): LiveContext {
  const today = now.format('YYYY-MM-DD')
  const currentDay = trip.days.find((d) => d.date === today) ?? null
  if (!currentDay) {
    return { currentDay: null, currentSpot: null, nextSpot: null, nextDay: null, status: 'no-day' }
  }
  const spots = [...(currentDay.spots ?? [])].sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  if (spots.length === 0) {
    return { currentDay, currentSpot: null, nextSpot: null, nextDay: null, status: 'rest-day' }
  }
  const nowHHmm = now.format('HH:mm')
  const past = spots.filter((s) => (s.time || '00:00') <= nowHHmm)
  const future = spots.filter((s) => (s.time || '00:00') > nowHHmm)
  if (past.length === 0) {
    return { currentDay, currentSpot: null, nextSpot: spots[0], nextDay: null, status: 'before-first' }
  }
  if (future.length === 0) {
    const idx = trip.days.findIndex((d) => d.date === today)
    const tomorrowDay = trip.days[idx + 1] ?? null
    const tomorrowFirst = tomorrowDay?.spots?.[0] ?? null
    return {
      currentDay,
      currentSpot: past[past.length - 1],
      nextSpot: tomorrowFirst,
      nextDay: tomorrowFirst ? tomorrowDay : null,
      status: 'after-last',
    }
  }
  return {
    currentDay,
    currentSpot: past[past.length - 1],
    nextSpot: future[0],
    nextDay: null,
    status: 'in-progress',
  }
}
```

4.1.4. POST 统计：

```typescript
export interface PostStats {
  days: number
  spotsCount: number
  totalCost: number
}

export function getPostStats(trip: Trip): PostStats {
  const days = trip.days.length
  let spotsCount = 0
  let totalCost = 0
  for (const d of trip.days) {
    spotsCount += d.spots?.length ?? 0
    totalCost += (d.meals ?? 0) + (d.tickets ?? 0)
    if (d.hotel) totalCost += (d.hotel.price ?? 0) * (d.hotel.nights ?? 1)
  }
  return { days, spotsCount, totalCost }
}
```

4.1.5. 直线距离（用于 Live "下一站"）：

```typescript
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const s1 = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(s1))
}
```

### 4.2. hooks/use-trip-weather.ts

4.2.1. 接口：

```typescript
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import type { Trip } from '../types/trip'
import type { TripPhase } from '../utils/trip-phase'

export interface DayForecast { date: string; temp: number; low: number; desc: string; icon: string }
export interface LiveWeather { temp: number; desc: string; icon: string }

interface WeatherResult {
  loading: boolean
  pre?: DayForecast[]
  liveToday?: LiveWeather
}

const TTL_MS = 60 * 60 * 1000  // 1 小时

export function useTripWeather(trip: Trip, phase: TripPhase): WeatherResult
```

4.2.2. 内部逻辑：

- post → 直接返回 `{ loading: false }`，不调云函数
- pre → 取 `trip.destinations[0].city` + trip.startDate/endDate；先查 Taro storage key `weather:<city>:pre:<startDate>`；命中（writtenAt 在 TTL 内）即用；否则调云函数 `amap-weather` 拿预报
- live → 取 `currentDay.city ?? trip.destinations[0].city` + 今日；同样 storage 命中策略

4.2.3. 失败处理：catch 后 console.warn，返回 `{ loading: false }`（无 pre/liveToday 字段）。组件层据此跳过渲染。

### 4.3. TripPhaseChip 组件

4.3.1. 文件：src/components/TripPhaseChip/index.tsx + index.scss

4.3.2. Props：

```typescript
interface Props {
  trip: Trip
  className?: string
}
```

4.3.3. 内部用 useMemo 派生 phase；live 时挂 60s interval 触发 forceUpdate。

4.3.4. 视觉（CSS 用主题 token）：

| phase | 文案 | 装饰 |
| --- | --- | --- |
| pre | "还有 X 天 · 目的地" | 左侧无图标，纯文字 |
| live | "LIVE · 当前 spot 名" | 左侧红点（CSS ::before 圆形 + pulse 动画） |
| post | "回顾 · X 天 / Y spots / ¥Z" | 左侧无图标 |

CSS 类前缀 `.tpc-`；颜色用 `var(--accent)` / `var(--ink)`。pre/post 用 `.tpc--pre/.tpc--post`，live 用 `.tpc--live`（独立深底色 + 高对比）。

4.3.5. status 边界处理（live 时）：

- before-first → "LIVE · 今日尚未开始"
- after-last + 有 nextSpot → "LIVE · 今日已收官 · 明日 {nextSpot.name}"
- after-last + 无 nextSpot → "LIVE · 今日已收官"
- rest-day → "LIVE · 今日休整日"
- no-day → "LIVE · 行程中"

### 4.4. TripPhaseHero 组件

4.4.1. 文件：src/components/TripPhaseHero/index.tsx + index.scss

4.4.2. Props：

```typescript
interface Props {
  trip: Trip
}
```

4.4.3. 内部根据 phase 渲染 3 个子区域，主组件做分发：

```tsx
const phase = useMemo(() => getTripPhase(trip.startDate, trip.endDate), [trip.startDate, trip.endDate])
return (
  <View className={`tph tph--${phase}`}>
    {phase === 'pre' && <PrePhaseBlock trip={trip} />}
    {phase === 'live' && <LivePhaseBlock trip={trip} />}
    {phase === 'post' && <PostPhaseBlock trip={trip} />}
  </View>
)
```

4.4.4. PrePhaseBlock 布局（DOM 草图）：

```
┌────────────────────────────────────┐
│  大数字「12」                        │
│  DAYS TO 北京                        │
│                                    │
│  [清单完成度环 12/24]                │
│                                    │
│  天气预告：[7 个 day forecast 横排]   │
└────────────────────────────────────┘
```

- 大数字 = `getDaysUntilStart()`
- 清单完成度 = `trip.packing.filter(p => p.checked).length / trip.packing.length`
- 天气来自 useTripWeather().pre

4.4.5. LivePhaseBlock 布局：

```
┌────────────────────────────────────┐
│  ● NOW · HH:mm                      │
│  {currentSpot.name}                 │
│  {currentSpot.city or currentDay.cityLabel} │
│                                    │
│  下一站 · {nextSpot.time} {nextSpot.name}   │
│  距离 ~{haversineKm} km · 今日 {liveToday.temp}° {liveToday.desc} │
└────────────────────────────────────┘
```

边界处理同 4.3.5（before-first / after-last / rest-day / no-day）：仅显示对应文案，省略下一站 / 距离段。

4.4.6. PostPhaseBlock 布局：

```
┌────────────────────────────────────┐
│  {trip.name} · 已收官                │
│                                    │
│  ┌──────┐  ┌──────┐  ┌──────┐    │
│  │ X 天 │  │ Y 个  │  │ ¥Z   │    │
│  │ DAYS │  │ SPOTS│  │ TOTAL│    │
│  └──────┘  └──────┘  └──────┘    │
└────────────────────────────────────┘
```

无封面图（脑暴中放弃了 canvas 分享，不需要单独封面）。

4.4.7. CSS 类前缀 `.tph-`；live 块用 `.tph__live` 等独立深底色。

### 4.5. home 主题接入

4.5.1. 4 个文件 HomeTegami / HomeMagazine / HomePostcard / HomeMinimal 在每张 trip 卡片内插入 `<TripPhaseChip trip={t} />`。

4.5.2. 嵌入位置：

| 主题 | 嵌入点 |
| --- | --- |
| HomeTegami | trip 标题行的下方、HomeCardAIRow 之上 |
| HomeMagazine | featured 卡：title 之下 deck 之上；rest 索引行：行末（紧贴 date） |
| HomePostcard | 印章下方独立一行（与 HomeCardAIRow 同级） |
| HomeMinimal | trip 行右侧第二行（紧贴 trip name） |

4.5.3. 实施期具体位置由当时 DOM 结构决定，本 spec 不锁死像素位置。

### 4.6. trip 页接入

4.6.1. src/pages/trip/index.tsx 在 TripHeader 渲染之后、4-tab 渲染之前插入：

```tsx
{t && <TripPhaseHero trip={t} />}
```

不分主题，统一渲染。

---

## 5. 文件清单

### 5.1. 修改

| 路径 | 改动 |
| --- | --- |
| src/pages/home/HomeTegami.tsx | 插入 TripPhaseChip |
| src/pages/home/HomeMagazine.tsx | 插入 TripPhaseChip（featured + rest 各一处）|
| src/pages/home/HomePostcard.tsx | 插入 TripPhaseChip |
| src/pages/home/HomeMinimal.tsx | 插入 TripPhaseChip |
| src/pages/trip/index.tsx | 插入 TripPhaseHero |

### 5.2. 新增

| 路径 | 责任 |
| --- | --- |
| src/utils/trip-phase.ts | phase 判定 / Live 上下文 / Post 统计 / haversine |
| src/hooks/use-trip-weather.ts | amap-weather 调用 + storage 缓存 |
| src/components/TripPhaseChip/index.tsx | 首页卡片用 chip |
| src/components/TripPhaseChip/index.scss | chip 样式（3 态 + 主题 token） |
| src/components/TripPhaseHero/index.tsx | trip 页 hero，内部分发 3 个 PhaseBlock |
| src/components/TripPhaseHero/index.scss | hero 样式（3 态布局） |

### 5.3. 删除

无。

---

## 6. 错误处理

| 场景 | 行为 |
| --- | --- |
| trip.days 为空 | pre：hero 显示「行程未规划」；live：hero 显示「今日休整日」（fallback rest-day 文案）；post：hero 显示「无可统计行程」 |
| amap-weather 调用失败 | useTripWeather 返回 `{ loading: false }`；hero PrePhaseBlock 跳过天气段；LivePhaseBlock 跳过今日温度段 |
| spot 缺 lat/lng | haversineKm 跳过；hero "下一站 距离" 段显示 "—" |
| spot 缺 time | 排序时按 '00:00' 当兜底；按 spec 4.1.3 不特殊处理跨日 |
| currentDay 缺 city | useTripWeather 退到 `trip.destinations[0].city`；都没有则不调云函数 |
| packing 字段不存在 | 完成度环显示 0/0（隐藏环 + 文字"暂无清单"） |
| Live 模式组件未挂载 | interval 不会启动；卸载时确保 clearInterval |

---

## 7. 验收冒烟（人工 · 微信开发者工具）

| # | 操作 | 期望 |
| --- | --- | --- |
| D1 | 创建 startDate 在 7 天后的 trip | 首页 chip "还有 7 天 · 目的地"；trip 页 hero 大数字 7 + 清单完成度环 + 天气预报横排 |
| D2 | 把 trip startDate 改为今天 | 首页 chip 切到 `● LIVE · spot 名`；hero 切到 currentSpot 卡 + 下一站 + 今日天气 |
| D3 | Live 状态下手动改设备时刻让 currentSpot 时刻过去 | 60s 内 hero 自动把 nextSpot 提升为 current（或刷新页面立刻生效） |
| D4 | 把 endDate 改为昨天 | 首页 chip 切到 "回顾 · X 天 / Y spots / ¥Z"；hero 显示 3 统计大卡 |
| D5 | Live 状态、currentDay 无 spots | hero 显示「今日休整日」 |
| D6 | trip.days 为空，三态都验证 | 三态不崩，显示对应占位文案 |
| D7 | mock amap-weather 失败 | hero 不渲染天气段；其它部分正常显示 |
| D8 | 4 主题切换 | chip / hero DOM 不变，CSS 跟主题 token 适配（颜色/字体不同） |
| D9 | 退出再进 trip 页 | weather storage 命中（开发者工具 Network 面板看不到 amap-weather 调用） |
| D10 | TripPhaseHero 不在 trip aiStatus = 'generating' 时影响内联 AI 状态条渲染 | AI 状态条仍在 4-tab 的 plan tab 内（子项目 A 已落地）；hero 与 AI 条共存不冲突 |

---

## 8. 自审检查清单

8.1. 新增 6 个文件 / 修改 5 个文件 ✓

8.2. utils/trip-phase 全纯函数 + Day/Spot 类型来自 types/trip，不引入新类型表面 ✓

8.3. weather 用现有 amap-weather 云函数，不新建云函数 ✓

8.4. 不开 GPS 权限、不引入 canvas、不引入 deeplink ✓

8.5. TripPhaseChip / TripPhaseHero DOM 同构，主题差异仅在 CSS token ✓

8.6. Live 自动刷新用 setInterval 60s，卸载 clearInterval，无 memory leak ✓

8.7. 与子项目 A 兼容：AI 状态条在 plan tab 内，TripPhaseHero 在 4-tab 之上，不冲突 ✓

8.8. 类型严格：TripPhase / LiveStatus / LiveContext / PostStats / DayForecast / LiveWeather 均显式定义 ✓

---

## 9. 后续 plan 入口

本 spec 完成 + 用户审查通过后调用 superpowers:writing-plans。预计 6 个 task：

9.1. Task 1：utils/trip-phase.ts 全部纯函数

9.2. Task 2：hooks/use-trip-weather.ts + 云函数调用 + storage 缓存

9.3. Task 3：TripPhaseChip 组件（含 60s 自动刷新）

9.4. Task 4：TripPhaseHero 组件（3 个 PhaseBlock）

9.5. Task 5：4 主题 home 接入 chip + trip 页接入 hero

9.6. Task 6：验收冒烟 D1–D10 + PR
