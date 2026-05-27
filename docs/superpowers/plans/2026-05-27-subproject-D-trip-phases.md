# 子项目 D · 出行前/中/后差异化 · 实施计划

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: 根据 trip.startDate / endDate 自动判定 pre/live/post 三态，并在 4 主题首页卡片插入 TripPhaseChip、在 trip 详情页插入 TripPhaseHero。接入 amap-weather 云函数提供 PRE 预报与 LIVE 今日天气。

Architecture: 一个纯函数工具层 (utils/trip-phase.ts) + 一个数据 hook (hooks/use-trip-weather.ts) + 两个 DOM 同构主题适配的展示组件 (TripPhaseChip / TripPhaseHero)。Live 模式 60s 自动刷新当前/下一站。本计划已内嵌 /frontend-design 出的「Ephemeris · 天文历」视觉设计，执行阶段直接复制 SCSS 不需要再设计。

Tech Stack: Taro 4.2 + React 18 + TypeScript + SCSS + CloudBase 云函数。

Spec 来源：[2026-05-27-subproject-D-trip-phases.md](../specs/2026-05-27-subproject-D-trip-phases.md)

设计语言：Ephemeris 三态共享同一字体节奏（display + mono 双轴）与轴线对齐，但用色彩与密度形成对比。PRE 是空白与大数字的纸面感，LIVE 是反相的深色"广播"卡 + 1.6s 红点心跳，POST 是报纸归档感的三联统计 + FILED 注脚。

测试说明：项目无自动测试套件，验证步骤指在「微信开发者工具」中手动冒烟。

---

## 1. 文件结构

### 1.1. 新增

| 路径 | 责任 |
| --- | --- |
| src/utils/trip-phase.ts | getTripPhase / getDaysUntilStart / getLiveContext / getPostStats / haversineKm |
| src/hooks/use-trip-weather.ts | amap-weather 调用 + Taro storage TTL 缓存 |
| src/components/TripPhaseChip/index.tsx | 首页卡片用 chip（pre/live/post 三种渲染） |
| src/components/TripPhaseChip/index.scss | Ephemeris 风格 chip 样式 + 4 主题覆写 |
| src/components/TripPhaseHero/index.tsx | trip 页 hero（内部三态 block） |
| src/components/TripPhaseHero/index.scss | Ephemeris 风格 hero 样式 + 4 主题覆写 |

### 1.2. 修改

| 路径 | 改动 |
| --- | --- |
| src/pages/home/HomeTegami.tsx | 每张 trip 卡片插入 TripPhaseChip |
| src/pages/home/HomeMagazine.tsx | featured + rest 索引行各嵌入一个 chip |
| src/pages/home/HomePostcard.tsx | 印章下方插入 chip |
| src/pages/home/HomeMinimal.tsx | trip 行内插入 chip |
| src/pages/trip/index.tsx | TripHeader 之后、4-tab 之前插入 TripPhaseHero |

### 1.3. 删除

无。

---

## 2. 任务清单

### 2.1. Task 1：utils/trip-phase.ts 纯函数

Files:
- 新增：src/utils/trip-phase.ts

- [ ] 2.1.1. 创建 src/utils/trip-phase.ts

```typescript
import dayjs, { type Dayjs } from 'dayjs'
import type { Trip, Day, Spot } from '../types/trip'

export type TripPhase = 'pre' | 'live' | 'post'

export type LiveStatus =
  | 'before-first'
  | 'in-progress'
  | 'after-last'
  | 'rest-day'
  | 'no-day'

export interface LiveContext {
  currentDay: Day | null
  currentSpot: Spot | null
  nextSpot: Spot | null
  nextDay: Day | null
  status: LiveStatus
}

export interface PostStats {
  days: number
  spotsCount: number
  totalCost: number
}

export function getTripPhase(
  startDate: string,
  endDate: string,
  now: Dayjs = dayjs(),
): TripPhase {
  const today = now.startOf('day')
  const start = dayjs(startDate).startOf('day')
  const end = dayjs(endDate).startOf('day')
  if (today.isBefore(start)) return 'pre'
  if (today.isAfter(end)) return 'post'
  return 'live'
}

export function getDaysUntilStart(startDate: string, now: Dayjs = dayjs()): number {
  return Math.max(0, dayjs(startDate).startOf('day').diff(now.startOf('day'), 'day'))
}

export function getLiveContext(trip: Trip, now: Dayjs = dayjs()): LiveContext {
  const today = now.format('YYYY-MM-DD')
  const currentDay = trip.days.find((d) => d.date === today) ?? null
  if (!currentDay) {
    return { currentDay: null, currentSpot: null, nextSpot: null, nextDay: null, status: 'no-day' }
  }
  const spots = [...(currentDay.spots ?? [])].sort((a, b) =>
    (a.time || '').localeCompare(b.time || ''),
  )
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

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s1 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(s1))
}
```

- [ ] 2.1.2. 验证

`npm run dev:weapp` 编译通过；types/trip.ts 中 Day / Spot / Trip 字段全部能引用（如某字段缺失需先核对项目 Trip 类型，并补全引用）。

- [ ] 2.1.3. Commit

```bash
git add src/utils/trip-phase.ts
git commit -m "feat(trip-phase): pure utils for phase/live/post derivation"
```

---

### 2.2. Task 2：useTripWeather hook

Files:
- 新增：src/hooks/use-trip-weather.ts

- [ ] 2.2.1. 检查 amap-weather 云函数返回结构（参考 cloudfunctions/amap-weather/index.js 实际入参/出参）。本计划假设入参 `{ city: string; dateRange?: { start, end } }`，返回 `{ forecast: [{ date, temp, low, desc, icon }], today?: { temp, desc, icon } }`。如实际结构不同，调整 hook 内 mapper。

- [ ] 2.2.2. 创建 src/hooks/use-trip-weather.ts

```typescript
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import type { Trip } from '../types/trip'
import { getLiveContext, type TripPhase } from '../utils/trip-phase'

export interface DayForecast {
  date: string
  temp: number
  low: number
  desc: string
  icon: string
}

export interface LiveWeather {
  temp: number
  desc: string
  icon: string
}

interface WeatherResult {
  loading: boolean
  pre?: DayForecast[]
  liveToday?: LiveWeather
}

interface CacheEntry<T> {
  writtenAt: number
  data: T
}

const TTL_MS = 60 * 60 * 1000

function readCache<T>(key: string): T | null {
  try {
    const v = Taro.getStorageSync(key) as CacheEntry<T> | ''
    if (!v || typeof v !== 'object') return null
    if (Date.now() - v.writtenAt > TTL_MS) return null
    return v.data
  } catch {
    return null
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    Taro.setStorageSync(key, { writtenAt: Date.now(), data } satisfies CacheEntry<T>)
  } catch {
    /* ignore storage full */
  }
}

async function callWeather(payload: { city: string; dateRange?: { start: string; end: string } }): Promise<unknown> {
  // @ts-ignore Taro.cloud
  const res = await Taro.cloud.callFunction({ name: 'amap-weather', data: payload })
  return (res as { result?: unknown })?.result
}

export function useTripWeather(trip: Trip, phase: TripPhase): WeatherResult {
  const [result, setResult] = useState<WeatherResult>({ loading: phase !== 'post' })

  useEffect(() => {
    let cancelled = false

    if (phase === 'post') {
      setResult({ loading: false })
      return () => { cancelled = true }
    }

    const destCity = trip.destinations?.[0]?.city || trip.destinations?.[0]?.name
    if (!destCity) {
      setResult({ loading: false })
      return () => { cancelled = true }
    }

    if (phase === 'pre') {
      const key = `weather:${destCity}:pre:${trip.startDate}:${trip.endDate}`
      const cached = readCache<DayForecast[]>(key)
      if (cached) {
        setResult({ loading: false, pre: cached })
        return () => { cancelled = true }
      }
      setResult({ loading: true })
      callWeather({ city: destCity, dateRange: { start: trip.startDate, end: trip.endDate } })
        .then((raw) => {
          if (cancelled) return
          const r = raw as { forecast?: DayForecast[] } | null
          const list = Array.isArray(r?.forecast) ? r!.forecast : []
          writeCache(key, list)
          setResult({ loading: false, pre: list })
        })
        .catch((e) => {
          console.warn('[useTripWeather] pre failed', e)
          if (!cancelled) setResult({ loading: false })
        })
      return () => { cancelled = true }
    }

    // phase === 'live'
    const ctx = getLiveContext(trip)
    const city = ctx.currentDay?.cityLabel || destCity
    const today = new Date().toISOString().slice(0, 10)
    const key = `weather:${city}:live:${today}`
    const cached = readCache<LiveWeather>(key)
    if (cached) {
      setResult({ loading: false, liveToday: cached })
      return () => { cancelled = true }
    }
    setResult({ loading: true })
    callWeather({ city })
      .then((raw) => {
        if (cancelled) return
        const r = raw as { today?: LiveWeather } | null
        if (r?.today) {
          writeCache(key, r.today)
          setResult({ loading: false, liveToday: r.today })
        } else {
          setResult({ loading: false })
        }
      })
      .catch((e) => {
        console.warn('[useTripWeather] live failed', e)
        if (!cancelled) setResult({ loading: false })
      })
    return () => { cancelled = true }
  }, [trip._id, trip.startDate, trip.endDate, phase])

  return result
}
```

- [ ] 2.2.3. 验证

`npm run dev:weapp` 编译通过；hook 暂未被使用（Task 4 接入）。

- [ ] 2.2.4. Commit

```bash
git add src/hooks/use-trip-weather.ts
git commit -m "feat(use-trip-weather): hook with TTL cache + amap-weather integration"
```

---

### 2.3. Task 3：TripPhaseChip 组件

Files:
- 新增：src/components/TripPhaseChip/index.tsx
- 新增：src/components/TripPhaseChip/index.scss

- [ ] 2.3.1. 创建 src/components/TripPhaseChip/index.tsx

```tsx
import { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import type { Trip } from '../../types/trip'
import {
  getTripPhase,
  getDaysUntilStart,
  getLiveContext,
  getPostStats,
} from '../../utils/trip-phase'
import './index.scss'

interface Props {
  trip: Trip
  className?: string
}

export default function TripPhaseChip({ trip, className }: Props) {
  const [tick, setTick] = useState(0)
  const phase = useMemo(
    () => getTripPhase(trip.startDate, trip.endDate),
    [trip.startDate, trip.endDate, tick],
  )

  useEffect(() => {
    if (phase !== 'live') return
    const t = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [phase])

  if (phase === 'pre') return <PreChip trip={trip} className={className} />
  if (phase === 'live') return <LiveChip trip={trip} className={className} />
  return <PostChip trip={trip} className={className} />
}

function PreChip({ trip, className }: { trip: Trip; className?: string }) {
  const days = getDaysUntilStart(trip.startDate)
  const destLabel =
    trip.destinations?.[0]?.name || trip.destinations?.[0]?.city || '远方'
  return (
    <View className={`tpc tpc--pre ${className || ''}`}>
      <Text className='tpc-pre-d'>D</Text>
      <Text className='tpc-pre-num'>−{days}</Text>
      <Text className='tpc-pre-rule'>/</Text>
      <Text className='tpc-pre-dest'>{destLabel}</Text>
    </View>
  )
}

function LiveChip({ trip, className }: { trip: Trip; className?: string }) {
  const ctx = useMemo(() => getLiveContext(trip), [trip])
  const label = liveChipLabel(ctx)
  return (
    <View className={`tpc tpc--live ${className || ''}`}>
      <View className='tpc-live-dot' />
      <Text className='tpc-live-tag'>LIVE</Text>
      <Text className='tpc-live-sep'>·</Text>
      <Text className='tpc-live-name'>{label}</Text>
    </View>
  )
}

function liveChipLabel(ctx: ReturnType<typeof getLiveContext>): string {
  switch (ctx.status) {
    case 'before-first':
      return `今日 ${ctx.nextSpot?.time ?? ''} ${ctx.nextSpot?.name ?? ''}`.trim()
    case 'in-progress':
      return ctx.currentSpot?.name ?? '行程中'
    case 'after-last':
      return ctx.nextSpot ? `今日收官 · 明日 ${ctx.nextSpot.name}` : '今日收官'
    case 'rest-day':
      return '今日休整'
    case 'no-day':
      return '行程中'
  }
}

function PostChip({ trip, className }: { trip: Trip; className?: string }) {
  const { days, spotsCount, totalCost } = getPostStats(trip)
  return (
    <View className={`tpc tpc--post ${className || ''}`}>
      <View className='tpc-post-mark' />
      <Text className='tpc-post-tag'>FILED</Text>
      <Text className='tpc-post-sep'>·</Text>
      <Text className='tpc-post-v'>{days}</Text>
      <Text className='tpc-post-l'>d</Text>
      <Text className='tpc-post-sep'>·</Text>
      <Text className='tpc-post-v'>{spotsCount}</Text>
      <Text className='tpc-post-l'>spots</Text>
      <Text className='tpc-post-sep'>·</Text>
      <Text className='tpc-post-v'>¥{totalCost.toLocaleString()}</Text>
    </View>
  )
}
```

- [ ] 2.3.2. 创建 src/components/TripPhaseChip/index.scss

```scss
.tpc {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  max-width: 100%;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 22rpx;
  letter-spacing: 1.2rpx;
  line-height: 1;
  box-sizing: border-box;
}

/* PRE · 纸 */
.tpc--pre {
  padding: 10rpx 18rpx;
  background: var(--surface-2);
  border: 1rpx solid var(--line);
  border-radius: 999rpx;
  color: var(--ink-3);
}
.tpc-pre-d {
  font-size: 18rpx;
  letter-spacing: 2rpx;
  color: var(--ink-3);
  opacity: 0.7;
}
.tpc-pre-num {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 28rpx;
  color: var(--accent);
  letter-spacing: 0;
  margin-right: 4rpx;
}
.tpc-pre-rule { color: var(--line-2); margin: 0 2rpx; }
.tpc-pre-dest { color: var(--ink); font-weight: 600; letter-spacing: 1.5rpx; }

/* LIVE · 反 */
.tpc--live {
  padding: 10rpx 18rpx 10rpx 14rpx;
  background: var(--ink);
  color: var(--surface);
  border-radius: 999rpx;
  --phase-live-accent: #ff3b3b;
}
.tpc-live-dot {
  width: 10rpx; height: 10rpx;
  border-radius: 50%;
  background: var(--phase-live-accent);
  box-shadow: 0 0 0 0 rgba(255, 59, 59, 0.55);
  animation: tpc-pulse 1.6s ease-in-out infinite;
  flex: 0 0 auto;
}
.tpc-live-tag {
  font-weight: 800;
  letter-spacing: 3rpx;
  font-size: 20rpx;
  color: var(--phase-live-accent);
}
.tpc-live-sep { opacity: 0.4; }
.tpc-live-name {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 24rpx;
  letter-spacing: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280rpx;
}
@keyframes tpc-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 59, 59, 0.55); }
  50%      { box-shadow: 0 0 0 10rpx rgba(255, 59, 59, 0); }
}

/* POST · 归档 */
.tpc--post {
  padding: 10rpx 4rpx;
  border-top: 1rpx solid var(--line);
  border-bottom: 1rpx solid var(--line);
  color: var(--ink-3);
  gap: 10rpx;
}
.tpc-post-mark {
  width: 10rpx; height: 10rpx;
  border-radius: 50%;
  border: 1.5rpx solid var(--ink-3);
}
.tpc-post-tag { letter-spacing: 3rpx; font-weight: 700; font-size: 18rpx; }
.tpc-post-sep { opacity: 0.35; padding: 0 2rpx; }
.tpc-post-v {
  font-family: var(--font-display);
  font-weight: 800;
  color: var(--ink);
  font-size: 24rpx;
}
.tpc-post-l { font-size: 18rpx; letter-spacing: 1.5rpx; }

/* 4 主题局部覆写 */
.theme-postcard .tpc--pre {
  background: transparent;
  border-style: dashed;
}
.theme-postcard .tpc--post {
  border-style: dashed;
}
.theme-magazine .tpc--pre {
  border-radius: 0;
  border: 0;
  border-top: 2rpx solid var(--ink);
  border-bottom: 1rpx solid var(--ink-3);
  background: transparent;
  padding: 8rpx 0;
}
.theme-minimal .tpc--live {
  background: var(--ink-2);
}
```

- [ ] 2.3.3. 验证

`npm run dev:weapp` 编译通过；暂未接入页面。

- [ ] 2.3.4. Commit

```bash
git add src/components/TripPhaseChip/
git commit -m "feat(trip-phase-chip): ephemeris 3-state chip with theme overrides"
```

---

### 2.4. Task 4：TripPhaseHero 组件

Files:
- 新增：src/components/TripPhaseHero/index.tsx
- 新增：src/components/TripPhaseHero/index.scss

- [ ] 2.4.1. 创建 src/components/TripPhaseHero/index.tsx

```tsx
import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import dayjs from 'dayjs'
import type { Trip } from '../../types/trip'
import {
  getTripPhase,
  getDaysUntilStart,
  getLiveContext,
  getPostStats,
  haversineKm,
  type LiveContext,
} from '../../utils/trip-phase'
import { useTripWeather } from '../../hooks/use-trip-weather'
import './index.scss'

interface Props {
  trip: Trip
}

export default function TripPhaseHero({ trip }: Props) {
  const [tick, setTick] = useState(0)
  const phase = useMemo(
    () => getTripPhase(trip.startDate, trip.endDate),
    [trip.startDate, trip.endDate, tick],
  )
  const weather = useTripWeather(trip, phase)

  useEffect(() => {
    if (phase !== 'live') return
    const t = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [phase])

  return (
    <View className={`tph tph--${phase}`}>
      {phase === 'pre' && <PreBlock trip={trip} weather={weather.pre} />}
      {phase === 'live' && <LiveBlock trip={trip} weather={weather.liveToday} />}
      {phase === 'post' && <PostBlock trip={trip} />}
    </View>
  )
}

function PreBlock({
  trip,
  weather,
}: {
  trip: Trip
  weather?: { date: string; temp: number; low: number; desc: string; icon: string }[]
}) {
  const days = getDaysUntilStart(trip.startDate)
  const destLabel = trip.destinations?.[0]?.name || trip.destinations?.[0]?.city || '远方'
  const packingTotal = trip.packing?.length ?? 0
  const packingDone = trip.packing?.filter((p) => p.checked).length ?? 0
  const packingPct = packingTotal > 0 ? Math.round((packingDone / packingTotal) * 100) : 0
  const trickle = Math.min(100, packingPct)

  return (
    <View className='tph-pre'>
      <View className='tph-pre-head'>
        <Text className='tph-pre-head-l'>COUNTDOWN</Text>
        <Text className='tph-pre-head-r'>UNTIL TRIP</Text>
      </View>

      <View className='tph-pre-num-row'>
        <Text className='tph-pre-num'>{days}</Text>
        <View className='tph-pre-num-cap'>
          <Text className='tph-pre-num-unit'>days</Text>
          <Text className='tph-pre-num-dest'>to {destLabel}</Text>
        </View>
      </View>

      <View className='tph-pre-meta'>
        <Text>
          {dayjs(trip.startDate).format('M/D')} – {dayjs(trip.endDate).format('M/D')}
        </Text>
        <Text className='tph-pre-meta-sep'>·</Text>
        <Text>{trip.pax} 人</Text>
      </View>

      <View className='tph-rule' />

      {packingTotal > 0 && (
        <View className='tph-pre-pack'>
          <Text className='tph-pre-pack-l'>PACKING</Text>
          <View className='tph-pre-pack-bar'>
            <View
              className='tph-pre-pack-bar-fill'
              style={{ width: `${trickle}%` }}
            />
          </View>
          <Text className='tph-pre-pack-v'>
            {packingDone} <Text className='tph-pre-pack-v-sub'>/ {packingTotal}</Text>
          </Text>
        </View>
      )}

      {weather && weather.length > 0 && (
        <ScrollView scrollX className='tph-pre-wx'>
          {weather.map((w) => (
            <View key={w.date} className='tph-pre-wx-cell'>
              <Text className='tph-pre-wx-d'>{dayjs(w.date).format('ddd').toUpperCase()}</Text>
              <Text className='tph-pre-wx-t'>{w.temp}°</Text>
              <Text className='tph-pre-wx-l'>{w.low}°</Text>
              <Text className='tph-pre-wx-desc'>{w.desc}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

function LiveBlock({
  trip,
  weather,
}: {
  trip: Trip
  weather?: { temp: number; desc: string; icon: string }
}) {
  const ctx = useMemo(() => getLiveContext(trip), [trip])
  const now = dayjs()
  const headline = liveHeadline(ctx)
  const cityLabel = ctx.currentDay?.cityLabel || trip.destinations?.[0]?.name || ''

  let distanceKm: number | null = null
  if (
    ctx.currentSpot?.lat &&
    ctx.currentSpot?.lng &&
    ctx.nextSpot?.lat &&
    ctx.nextSpot?.lng
  ) {
    distanceKm =
      Math.round(
        haversineKm(
          { lat: ctx.currentSpot.lat, lng: ctx.currentSpot.lng },
          { lat: ctx.nextSpot.lat, lng: ctx.nextSpot.lng },
        ) * 10,
      ) / 10
  }

  return (
    <View className='tph-live'>
      <View className='tph-live-head'>
        <View className='tph-live-dot' />
        <Text className='tph-live-tag'>LIVE</Text>
        <Text className='tph-live-time'>{now.format('HH:mm')}</Text>
        <Text className='tph-live-day'>{now.format('ddd').toUpperCase()}</Text>
      </View>

      <Text className='tph-live-title'>{headline.title}</Text>
      {headline.sub && <Text className='tph-live-sub'>{headline.sub}</Text>}

      {cityLabel && (
        <View className='tph-live-city'>
          <Text className='tph-live-city-rule'>─</Text>
          <Text>{cityLabel}</Text>
          {weather && (
            <>
              <Text className='tph-live-city-sep'>·</Text>
              <Text>{weather.temp}° {weather.desc}</Text>
            </>
          )}
          <Text className='tph-live-city-rule'>─</Text>
        </View>
      )}

      {ctx.nextSpot && (
        <View className='tph-live-next'>
          <View className='tph-live-next-head'>
            <Text className='tph-live-next-tag'>NEXT</Text>
            <Text className='tph-live-next-time'>{ctx.nextSpot.time || '--:--'}</Text>
          </View>
          <Text className='tph-live-next-name'>{ctx.nextSpot.name}</Text>
          {(distanceKm !== null || ctx.nextDay) && (
            <Text className='tph-live-next-meta'>
              {ctx.nextDay && `明日 · `}
              {distanceKm !== null ? `~${distanceKm} km` : ctx.nextDay ? '' : '—'}
            </Text>
          )}
        </View>
      )}
    </View>
  )
}

function liveHeadline(ctx: LiveContext): { title: string; sub?: string } {
  switch (ctx.status) {
    case 'in-progress':
      return { title: ctx.currentSpot?.name ?? '行程中', sub: ctx.currentSpot?.time }
    case 'before-first':
      return { title: '今日尚未开始', sub: '稍后将开启首站' }
    case 'after-last':
      return { title: '今日已收官', sub: ctx.nextDay ? '明日继续' : undefined }
    case 'rest-day':
      return { title: '今日休整日', sub: '为后续蓄力' }
    case 'no-day':
      return { title: '行程进行中' }
  }
}

function PostBlock({ trip }: { trip: Trip }) {
  const { days, spotsCount, totalCost } = getPostStats(trip)
  const filedAt = dayjs(trip.endDate).format('YYYY.MM.DD')
  return (
    <View className='tph-post'>
      <View className='tph-post-head'>
        <Text className='tph-post-mark'>○</Text>
        <Text className='tph-post-tag'>ARCHIVED</Text>
        <Text className='tph-post-sep'>·</Text>
        <Text className='tph-post-title'>{trip.name}</Text>
      </View>

      <View className='tph-post-grid'>
        <PostStat v={`${days}`} l='DAYS' delay={0} />
        <PostStat v={`${spotsCount}`} l='SPOTS' delay={80} />
        <PostStat v={`¥${formatCost(totalCost)}`} l='TOTAL' delay={160} />
      </View>

      <View className='tph-rule' />
      <Text className='tph-post-filed'>FILED · {filedAt}</Text>
    </View>
  )
}

function PostStat({ v, l, delay }: { v: string; l: string; delay: number }) {
  return (
    <View className='tph-post-stat' style={{ animationDelay: `${delay}ms` }}>
      <Text className='tph-post-stat-v'>{v}</Text>
      <Text className='tph-post-stat-l'>{l}</Text>
    </View>
  )
}

function formatCost(n: number): string {
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}
```

- [ ] 2.4.2. 创建 src/components/TripPhaseHero/index.scss

```scss
.tph {
  margin: 24rpx 0;
  padding: 32rpx 32rpx 40rpx;
  border-radius: var(--r-lg);
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-body);
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
  animation: tph-in 0.5s var(--ease-out) both;
}
@keyframes tph-in {
  from { opacity: 0; transform: translateY(8rpx); }
  to   { opacity: 1; transform: translateY(0); }
}

.tph-rule {
  height: 1rpx;
  background: var(--line);
  margin: 24rpx 0;
}

/* ═════════════════════ PRE ═════════════════════ */
.tph-pre-head {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 20rpx;
  letter-spacing: 4rpx;
  color: var(--ink-3);
  text-transform: uppercase;
}
.tph-pre-num-row {
  display: flex;
  align-items: flex-end;
  gap: 24rpx;
  margin: 24rpx 0 8rpx;
}
.tph-pre-num {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 220rpx;
  line-height: 0.9;
  color: var(--accent);
  letter-spacing: -8rpx;
  font-variant-numeric: tabular-nums;
}
.tph-pre-num-cap {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding-bottom: 18rpx;
}
.tph-pre-num-unit {
  font-family: var(--font-mono);
  font-size: 26rpx;
  letter-spacing: 3rpx;
  color: var(--ink-3);
  text-transform: uppercase;
}
.tph-pre-num-dest {
  font-family: var(--font-display);
  font-size: 32rpx;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: 0;
}
.tph-pre-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-family: var(--font-mono);
  font-size: 22rpx;
  color: var(--ink-3);
  letter-spacing: 2rpx;
}
.tph-pre-meta-sep { opacity: 0.4; }

.tph-pre-pack {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.tph-pre-pack-l {
  font-family: var(--font-mono);
  font-size: 20rpx;
  letter-spacing: 3rpx;
  color: var(--ink-3);
  flex: 0 0 auto;
}
.tph-pre-pack-bar {
  flex: 1 1 auto;
  height: 6rpx;
  background: var(--line);
  border-radius: 999rpx;
  overflow: hidden;
}
.tph-pre-pack-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 999rpx;
  transition: width 0.6s var(--ease-out);
}
.tph-pre-pack-v {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 28rpx;
  color: var(--ink);
  flex: 0 0 auto;
}
.tph-pre-pack-v-sub {
  color: var(--ink-3);
  font-weight: 500;
  font-size: 22rpx;
}

.tph-pre-wx {
  margin-top: 28rpx;
  white-space: nowrap;
}
.tph-pre-wx-cell {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  padding: 16rpx 22rpx;
  margin-right: 12rpx;
  background: var(--surface-2);
  border-radius: var(--r-sm);
  min-width: 96rpx;
}
.tph-pre-wx-d {
  font-family: var(--font-mono);
  font-size: 18rpx;
  letter-spacing: 2rpx;
  color: var(--ink-3);
}
.tph-pre-wx-t {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 32rpx;
  color: var(--ink);
}
.tph-pre-wx-l {
  font-family: var(--font-mono);
  font-size: 18rpx;
  color: var(--ink-3);
}
.tph-pre-wx-desc {
  font-size: 20rpx;
  color: var(--ink-2);
  margin-top: 4rpx;
}

/* ═════════════════════ LIVE ═════════════════════ */
.tph--live {
  background: var(--ink);
  color: var(--surface);
  --phase-live-accent: #ff3b3b;
}
.tph-live-head {
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-family: var(--font-mono);
  letter-spacing: 3rpx;
  font-size: 22rpx;
}
.tph-live-dot {
  width: 12rpx; height: 12rpx;
  border-radius: 50%;
  background: var(--phase-live-accent);
  box-shadow: 0 0 0 0 rgba(255, 59, 59, 0.55);
  animation: tph-pulse 1.6s ease-in-out infinite;
}
.tph-live-tag { color: var(--phase-live-accent); font-weight: 800; }
.tph-live-time {
  margin-left: auto;
  font-feature-settings: 'tnum';
  font-size: 26rpx;
  color: var(--surface);
}
.tph-live-day { color: rgba(255,255,255,0.5); }
@keyframes tph-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 59, 59, 0.55); }
  50%      { box-shadow: 0 0 0 12rpx rgba(255, 59, 59, 0); }
}
.tph-live-title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 72rpx;
  line-height: 1.05;
  letter-spacing: -1rpx;
  color: var(--surface);
  margin: 32rpx 0 12rpx;
  display: block;
}
.tph-live-sub {
  font-family: var(--font-mono);
  font-size: 24rpx;
  letter-spacing: 2rpx;
  color: rgba(255,255,255,0.55);
}
.tph-live-city {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-family: var(--font-mono);
  font-size: 22rpx;
  letter-spacing: 1.5rpx;
  color: rgba(255,255,255,0.7);
  margin-top: 28rpx;
}
.tph-live-city-rule { color: rgba(255,255,255,0.25); }
.tph-live-city-sep { opacity: 0.5; }

.tph-live-next {
  margin-top: 32rpx;
  padding: 22rpx 24rpx;
  border: 1rpx dashed rgba(255,255,255,0.3);
  border-radius: var(--r-sm);
  background: rgba(255,255,255,0.04);
}
.tph-live-next-head {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-bottom: 8rpx;
}
.tph-live-next-tag {
  font-family: var(--font-mono);
  font-size: 18rpx;
  letter-spacing: 3rpx;
  color: rgba(255,255,255,0.5);
  font-weight: 700;
}
.tph-live-next-time {
  font-family: var(--font-mono);
  font-size: 22rpx;
  color: var(--surface);
  font-feature-settings: 'tnum';
}
.tph-live-next-name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 36rpx;
  color: var(--surface);
  letter-spacing: -0.5rpx;
}
.tph-live-next-meta {
  margin-top: 6rpx;
  font-family: var(--font-mono);
  font-size: 20rpx;
  letter-spacing: 1.5rpx;
  color: rgba(255,255,255,0.55);
}

/* ═════════════════════ POST ═════════════════════ */
.tph-post-head {
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-family: var(--font-mono);
  font-size: 22rpx;
  letter-spacing: 3rpx;
  color: var(--ink-3);
}
.tph-post-mark { font-size: 18rpx; color: var(--ink-3); }
.tph-post-tag { font-weight: 800; color: var(--ink-2); }
.tph-post-sep { opacity: 0.4; }
.tph-post-title {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--ink);
  font-size: 26rpx;
  letter-spacing: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tph-post-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20rpx;
  margin-top: 32rpx;
}
.tph-post-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 24rpx 20rpx;
  background: var(--surface-2);
  border-radius: var(--r-sm);
  animation: tph-stat-in 0.5s var(--ease-out) both;
}
@keyframes tph-stat-in {
  from { opacity: 0; transform: translateY(12rpx); }
  to   { opacity: 1; transform: translateY(0); }
}
.tph-post-stat-v {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 52rpx;
  line-height: 1;
  color: var(--ink);
  letter-spacing: -1rpx;
  font-feature-settings: 'tnum';
}
.tph-post-stat-l {
  font-family: var(--font-mono);
  font-size: 18rpx;
  letter-spacing: 3rpx;
  color: var(--ink-3);
  margin-top: 8rpx;
}

.tph-post-filed {
  font-family: var(--font-mono);
  font-size: 18rpx;
  letter-spacing: 4rpx;
  color: var(--ink-3);
  text-transform: uppercase;
  display: block;
}

/* ═════════════════════ 主题局部覆写 ═════════════════════ */
.theme-postcard .tph {
  border: 1rpx dashed var(--line-2);
}
.theme-postcard .tph-post-stat {
  background: transparent;
  border: 1rpx dashed var(--line-2);
}
.theme-postcard .tph-pre-wx-cell {
  background: transparent;
  border: 1rpx dashed var(--line-2);
}

.theme-magazine .tph {
  border-radius: 0;
  border-top: 3rpx solid var(--ink);
  border-bottom: 1rpx solid var(--ink-3);
  background: var(--surface);
}
.theme-magazine .tph-rule {
  background: var(--ink);
  height: 2rpx;
}
.theme-magazine .tph-post-stat {
  background: transparent;
  border-top: 2rpx solid var(--ink);
  border-radius: 0;
  padding-left: 0;
}

.theme-minimal .tph {
  background: transparent;
  box-shadow: none;
  padding-left: 0;
  padding-right: 0;
}
.theme-minimal .tph-post-stat {
  background: transparent;
  padding: 16rpx 0;
}
.theme-minimal .tph-pre-wx-cell {
  background: transparent;
  padding: 8rpx 18rpx;
  border-bottom: 1rpx solid var(--line);
}
```

- [ ] 2.4.3. 验证

`npm run dev:weapp` 编译通过；尚未接入 trip 页。

- [ ] 2.4.4. Commit

```bash
git add src/components/TripPhaseHero/
git commit -m "feat(trip-phase-hero): ephemeris 3-state hero with theme overrides"
```

---

### 2.5. Task 5：4 主题 home 接入 chip

Files:
- 修改：src/pages/home/HomeTegami.tsx
- 修改：src/pages/home/HomeMagazine.tsx
- 修改：src/pages/home/HomePostcard.tsx
- 修改：src/pages/home/HomeMinimal.tsx

- [ ] 2.5.1. HomeTegami：在每张 trip 卡片标题行之下、HomeCardAIRow 之上插入

```tsx
import TripPhaseChip from '../../components/TripPhaseChip'

// trip 卡片渲染段，在 title 之下、aiRow 之上：
<TripPhaseChip trip={t} className='ht-card-phase' />
```

具体插入位置：定位到 trip 卡片渲染段（map 内），找到 trip name / title 渲染后立刻插入。

- [ ] 2.5.2. HomeMagazine：featured 卡 + rest 索引行各加一个

featured 卡内（title 之下 deck 之上）：

```tsx
<Text className='hm-feature-title'>{featured.name}</Text>
<TripPhaseChip trip={featured} className='hm-feature-phase' />
<Text className='hm-feature-deck'>...</Text>
```

rest 索引行内（紧贴 date 行尾）：

```tsx
<View key={t._id} className='hm-index-row' ...>
  <Text className='hm-index-no'>P. {String(i + 2).padStart(2, '0')}</Text>
  <Text className='hm-index-name'>{t.name}</Text>
  <View className='hm-index-dots' />
  <TripPhaseChip trip={t} className='hm-index-phase' />
  <Text className='hm-index-date'>{t.startDate.slice(0, 7)}</Text>
</View>
```

- [ ] 2.5.3. HomePostcard：印章下方独立一行（与 HomeCardAIRow 同级，子项目 A 已落地 ai row）

定位到印章渲染段末尾，在 `</View>` 印章关闭之后追加：

```tsx
<TripPhaseChip trip={t} className='hpp-card-phase' />
```

- [ ] 2.5.4. HomeMinimal：trip 行内、name 右侧第二行

```tsx
<View className='hmin-row' ...>
  <Text className='hmin-name'>{t.name}</Text>
  <TripPhaseChip trip={t} className='hmin-phase' />
  ...
</View>
```

- [ ] 2.5.5. 验证

`npm run dev:weapp` 4 主题切换：每张 trip 卡片底部/侧边出现一个 chip，根据 trip 日期显示 pre/live/post 文案。视觉与主题协调（postcard 虚线、magazine 横线、minimal 干净）。

- [ ] 2.5.6. Commit

```bash
git add src/pages/home/HomeTegami.tsx src/pages/home/HomeMagazine.tsx src/pages/home/HomePostcard.tsx src/pages/home/HomeMinimal.tsx
git commit -m "feat(home): embed TripPhaseChip in 4 themes"
```

---

### 2.6. Task 6：trip 页接入 hero

Files:
- 修改：src/pages/trip/index.tsx

- [ ] 2.6.1. 顶部 import

```typescript
import TripPhaseHero from '../../components/TripPhaseHero'
```

- [ ] 2.6.2. 在 TripHeader 渲染段之后、tab 内容之前插入

定位现有的 TripHeader 渲染分发（4 主题某个 TripHeader 之后）和 4-tab nav 渲染段之间，插入：

```tsx
{t && <TripPhaseHero trip={t} />}
```

如 trip/index.tsx 里 TripHeader 分发为 if 链，hero 应放在所有分支之后，4-tab 之前，保证 4 主题都渲染 hero。

- [ ] 2.6.3. 验证

`npm run dev:weapp`：

1) PRE trip：trip 页顶部出现大数字倒计时 + 行李进度 + 7 天天气横排
2) LIVE trip：深色 hero 卡，红点 1.6s 心跳，当前 spot 名 + NEXT 卡片
3) POST trip：白底 hero 卡，3 统计大数字横排 + FILED 注脚
4) 4 主题切换 → hero 视觉差异：postcard 虚线边框，magazine 实线顶/底线 + 0 圆角，minimal 无背景无 shadow

- [ ] 2.6.4. Commit

```bash
git add src/pages/trip/index.tsx
git commit -m "feat(trip): mount TripPhaseHero between header and tabs"
```

---

### 2.7. Task 7：验收冒烟 + PR

Files: 仅人工验证。

- [ ] 2.7.1. D1：startDate 在 7 天后的 trip → chip "D−7 / 目的地"；hero 大数字 7 + 清单进度 + 天气

- [ ] 2.7.2. D2：startDate 改为今天 → chip 切到 `● LIVE · spot 名`；hero 切到深色卡 + currentSpot + NEXT

- [ ] 2.7.3. D3：等 1 分钟或手改设备时刻 → hero 自动把 nextSpot 提升为 current

- [ ] 2.7.4. D4：endDate 改为昨天 → chip 切到 `FILED · X d · Y spots · ¥Z`；hero 切 3 统计

- [ ] 2.7.5. D5：Live 状态 currentDay 无 spots → hero "今日休整日"

- [ ] 2.7.6. D6：trip.days 为空 → 三态都不崩

- [ ] 2.7.7. D7：mock amap-weather 失败 → hero 不渲染天气段，其它正常

- [ ] 2.7.8. D8：4 主题切换 → chip/hero DOM 不变，CSS 适配各主题

- [ ] 2.7.9. D9：退出再进 trip 页 → weather storage 命中（开发者工具 Network 看不到 amap-weather 调用）

- [ ] 2.7.10. D10：AI 状态条与 TripPhaseHero 在同一 trip 页共存不冲突（hero 在 4-tab 之上，AI 条在 plan tab 内）

- [ ] 2.7.11. 建 PR

```bash
git checkout -b feat/subproject-d-trip-phases
git push -u origin feat/subproject-d-trip-phases
gh pr create --title "feat(phases): subproject D · pre/live/post differentiation" --body "$(cat <<'EOF'
## Summary
- 新增 utils/trip-phase.ts：phase 判定 / Live 上下文 / Post 统计 / haversine
- 新增 hooks/use-trip-weather.ts：amap-weather + TTL 缓存
- 新增 TripPhaseChip + TripPhaseHero，Ephemeris 设计语言
- 4 主题首页接入 chip；trip 页接入 hero
- Live 60s 自动刷新当前/下一站

## Test plan
- [ ] D1-D10 人工冒烟（见 plan 2.7 节）
EOF
)"
```

---

## 3. 自审清单

3.1. Spec § 3 数据流 / 缓存策略 / 60s 刷新 → Task 1/2/3/4 ✓

3.2. Spec § 4.1 trip-phase 工具 → Task 1 ✓

3.3. Spec § 4.2 useTripWeather → Task 2 ✓

3.4. Spec § 4.3 TripPhaseChip + 4 主题覆写 → Task 3 ✓

3.5. Spec § 4.4 TripPhaseHero 三段 PhaseBlock → Task 4 ✓

3.6. Spec § 4.5 4 主题 home 接入 → Task 5 ✓

3.7. Spec § 4.6 trip 页接入 → Task 6 ✓

3.8. Spec § 7 验收 D1-D10 → Task 7 ✓

3.9. 无占位词；所有 TSX/SCSS 代码完整内嵌，执行阶段不需要再调 /frontend-design ✓

3.10. 类型一致性：TripPhase / LiveStatus / LiveContext / PostStats / DayForecast / LiveWeather 在 Task 1/2 定义后一致引用 ✓

3.11. 与子项目 A 兼容：hero 在 4-tab 之上，AI 内联条在 plan tab 内（D10 验收） ✓
