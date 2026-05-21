# 行册 Phase 2 · 首页 + 新建攻略 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 拆出独立的首页和新建攻略页，实现 trips 集合的 CRUD（新建/列表/重命名/复制/删除），首页订阅 owner 自己的攻略列表。

**Architecture:** 用 Taro 多页路由替换原单页结构。首页订阅云数据库实时变化；新建页用 Taro `Picker mode="date"` 两段式取日期，用 Phase 1 的 `amap-poi-search` 云函数做目的地多选搜索；攻略 CRUD 全部在客户端经 `wx.cloud.database()` 直连，不走云函数。

**Tech Stack:** Taro 4.2 / React 18 / TypeScript · 微信云开发数据库 · `nanoid` · `dayjs` · Phase 1 已就绪的 `utils/cloud.ts`

---

## 0. 前置条件

- **0.1** Phase 1 已完成验收（[2026-05-22-行册-phase1-cloud-skeleton.md](./2026-05-22-行册-phase1-cloud-skeleton.md) §14 全 ✅）
- **0.2** 当前用户已在云开发 `users` 集合有一条记录（首次启动会 ensure-user）
- **0.3** 微信开发者工具能正常运行 dev:weapp watch

---

## 1. 文件结构

```
src/
├── app.config.ts                 ← 修改：用 home / new-trip 替换 index
├── pages/
│   ├── home/                     ← 新建
│   │   ├── index.tsx
│   │   ├── index.config.ts
│   │   └── index.scss
│   ├── new-trip/                 ← 新建
│   │   ├── index.tsx
│   │   ├── index.config.ts
│   │   └── index.scss
│   └── index/                    ← 删除
├── components/
│   ├── DatePicker/               ← 新建
│   │   ├── index.tsx
│   │   └── index.scss
│   ├── DestinationPicker/        ← 新建
│   │   ├── index.tsx
│   │   └── index.scss
│   └── TripActionSheet/          ← 新建
│       ├── index.tsx
│       └── index.scss
├── types/
│   └── trip.ts                   ← 重写（typed spot 模型）
├── utils/
│   ├── cloud.ts                  (Phase 1)
│   ├── id.ts                     ← 新建
│   ├── format.ts                 ← 新建
│   ├── trip-helpers.ts           ← 新建
│   └── db.ts                     ← 新建
└── data/
    └── packing.ts                (沿用)
```

---

## Task 1: 重写 `src/types/trip.ts`（typed spot 模型）

**Files:**
- Modify: `src/types/trip.ts`

- [ ] **Step 1.1:** 完整替换 `src/types/trip.ts` 内容

```ts
export type SpotType = 'spot' | 'hotel' | 'meal' | 'transport' | 'arrive'

export interface Spot {
  id: string
  type: SpotType
  time?: string          // 'HH:mm' 可选
  name: string
  city?: string
  adcode?: string
  lat?: number
  lng?: number
  price?: number
  note?: string

  // type='hotel'
  nights?: number

  // type='transport'
  mode?: string
  from?: string
  to?: string
}

export interface DayWeather {
  city: string
  cityAdcode: string
  temp: number
  low: number
  desc: string
  icon: string
  fetchedAt: number
}

export interface Day {
  id: string             // nanoid
  date: string           // 'YYYY-MM-DD'
  title?: string
  weather?: DayWeather | null
  spots: Spot[]
}

export interface Destination {
  name: string
  adcode: string
  lat: number
  lng: number
}

export interface Collaborator {
  openid: string
  nickname: string
  avatarUrl: string
  role: 'editor'
  joinedAt: number
}

export interface PackingItem {
  id: string
  category: string
  label: string
  checked: boolean
}

export interface Trip {
  _id: string
  _openid: string
  ownerOpenid: string

  name: string
  pax: number
  startDate: string      // 'YYYY-MM-DD'
  endDate: string
  destinations: Destination[]

  collaborators: Collaborator[]
  days: Day[]
  packing: PackingItem[]

  createdAt: number
  updatedAt: number
  updatedBy: string
}

// 新建 trip 时未落库前的形状
export type NewTripInput = Omit<Trip, '_id' | '_openid' | 'createdAt' | 'updatedAt' | 'updatedBy'>
```

- [ ] **Step 1.2:** TypeScript 类型检查
```bash
cd /Users/jinchi/Documents/行册
npx tsc --noEmit
```

预期：跟新 trip 类型相关的错可能会涌出（原 `pages/index/index.tsx` 用旧字段），先记下来；Task 12 会删那个文件。如果是其他无关 error，分开处理。

- [ ] **Step 1.3:** 提交
```bash
git add src/types/trip.ts
git commit -m "refactor(types): rewrite Trip to typed spot model"
```

---

## Task 2: 创建 `utils/id.ts` 和 `utils/format.ts`

**Files:**
- Create: `src/utils/id.ts`
- Create: `src/utils/format.ts`

- [ ] **Step 2.1:** `src/utils/id.ts`
```ts
import { nanoid } from 'nanoid/non-secure'

export function uid(): string {
  return nanoid(12)
}
```

> 用 `nanoid/non-secure` 因为小程序环境无 `crypto.getRandomValues` 的标准实现，non-secure 在客户端足够。

- [ ] **Step 2.2:** `src/utils/format.ts`
```ts
import dayjs from 'dayjs'

export function fmtDate(date: string | number | Date, pattern = 'YYYY-MM-DD'): string {
  return dayjs(date).format(pattern)
}

export function fmtDateShort(date: string | Date): string {
  return dayjs(date).format('MM.DD')
}

export function fmtCurrency(n: number, currency = '¥'): string {
  const s = (n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${currency}${s}`
}

export function daysBetween(start: string, end: string): number {
  return dayjs(end).diff(dayjs(start), 'day') + 1
}
```

- [ ] **Step 2.3:** 类型检查
```bash
npx tsc --noEmit
```

预期：上述两个新文件无 error。

- [ ] **Step 2.4:** 提交
```bash
git add src/utils/id.ts src/utils/format.ts
git commit -m "feat(utils): add id and format helpers"
```

---

## Task 3: 创建 `utils/trip-helpers.ts`

**Files:**
- Create: `src/utils/trip-helpers.ts`

- [ ] **Step 3.1:** 创建文件
```ts
import dayjs from 'dayjs'
import { uid } from './id'
import type { Day, NewTripInput, Destination } from '../types/trip'

/**
 * 按日期范围生成空的 day 数组（每天一条，无 spot）
 */
export function seedDays(startDate: string, endDate: string): Day[] {
  const days: Day[] = []
  let cursor = dayjs(startDate)
  const end = dayjs(endDate)
  while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
    days.push({
      id: uid(),
      date: cursor.format('YYYY-MM-DD'),
      spots: [],
      weather: null,
    })
    cursor = cursor.add(1, 'day')
  }
  return days
}

/**
 * 构造新 trip 的初始数据（未落库版本）
 */
export function buildNewTrip(input: {
  name: string
  pax: number
  startDate: string
  endDate: string
  destinations: Destination[]
}): NewTripInput {
  return {
    name: input.name.trim(),
    pax: input.pax,
    startDate: input.startDate,
    endDate: input.endDate,
    destinations: input.destinations,
    collaborators: [],
    ownerOpenid: '',  // 由调用方写入（来自 wx.cloud 上下文）
    days: seedDays(input.startDate, input.endDate),
    packing: [],
  }
}

/**
 * 攻略卡片摘要的目的地标签：南京 / 大兴安岭
 */
export function destinationLabel(destinations: Destination[]): string {
  if (!destinations || destinations.length === 0) return '未定'
  return destinations.map(d => d.name).join(' · ')
}

/**
 * 攻略卡片摘要的"4 天 · 4 人"
 */
export function tripSummary(startDate: string, endDate: string, pax: number): string {
  const days = dayjs(endDate).diff(dayjs(startDate), 'day') + 1
  return `${days} 天 · ${pax} 人`
}
```

- [ ] **Step 3.2:** 类型检查
```bash
npx tsc --noEmit
```

- [ ] **Step 3.3:** 提交
```bash
git add src/utils/trip-helpers.ts
git commit -m "feat(utils): add trip-helpers (seed days, summary)"
```

---

## Task 4: 创建 `utils/db.ts`（trips 集合 CRUD 封装）

**Files:**
- Create: `src/utils/db.ts`

- [ ] **Step 4.1:** 创建文件
```ts
import Taro from '@tarojs/taro'
import type { Trip, NewTripInput } from '../types/trip'

// @ts-ignore Taro.cloud 在 weapp 端可用
const db = () => Taro.cloud.database()

const TRIPS = 'trips'

export interface ListTripsResult {
  trips: Trip[]
}

/**
 * 获取当前用户拥有的所有 trips（按 updatedAt 倒序）
 * Phase 5 起会扩展为 owner ∪ collaborator
 */
export async function listMyTrips(openid: string): Promise<Trip[]> {
  const res = await db()
    .collection(TRIPS)
    .where({ _openid: openid })
    .orderBy('updatedAt', 'desc')
    .get()
  return (res.data || []) as Trip[]
}

/**
 * 获取一条 trip
 */
export async function getTrip(tripId: string): Promise<Trip | null> {
  const res = await db().collection(TRIPS).doc(tripId).get().catch(() => null)
  if (!res || !res.data) return null
  return res.data as Trip
}

/**
 * 新建 trip
 */
export async function createTrip(input: NewTripInput): Promise<string> {
  const now = Date.now()
  const res = await db().collection(TRIPS).add({
    data: {
      ...input,
      createdAt: now,
      updatedAt: now,
      updatedBy: input.ownerOpenid,
    }
  })
  return res._id as string
}

/**
 * 全量替换更新一条 trip（用于编辑保存）
 */
export async function updateTrip(tripId: string, patch: Partial<Trip>, openid: string): Promise<void> {
  await db().collection(TRIPS).doc(tripId).update({
    data: {
      ...patch,
      updatedAt: Date.now(),
      updatedBy: openid,
    }
  })
}

/**
 * 重命名（薄封装）
 */
export async function renameTrip(tripId: string, newName: string, openid: string): Promise<void> {
  return updateTrip(tripId, { name: newName }, openid)
}

/**
 * 删除一条 trip（仅 owner 调用，权限规则会兜底）
 */
export async function deleteTrip(tripId: string): Promise<void> {
  await db().collection(TRIPS).doc(tripId).remove()
}

/**
 * 客户端复制：取源 trip，剥离身份/时间戳，作为新 doc 写入
 * 注意：此方法用于"用户在自己攻略册里复制一份"（不是分享接收）。
 *      分享接收复制由云函数 clone-trip 处理。
 */
export async function copyTripLocally(sourceTripId: string, openid: string): Promise<string> {
  const src = await getTrip(sourceTripId)
  if (!src) throw new Error('source trip not found')

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, _openid, ownerOpenid, collaborators, createdAt, updatedAt, updatedBy, name, ...rest } = src
  const cloned: NewTripInput = {
    ...rest,
    name: `${name} · 副本`,
    ownerOpenid: openid,
    collaborators: [],
  }
  return createTrip(cloned)
}

/**
 * 监听当前用户的 trips 列表实时变化
 * 返回一个 watcher，调用 .close() 取消监听
 */
export function watchMyTrips(openid: string, onChange: (trips: Trip[]) => void) {
  // @ts-ignore Taro.cloud.database watch 在 weapp 可用
  return db()
    .collection(TRIPS)
    .where({ _openid: openid })
    .orderBy('updatedAt', 'desc')
    .watch({
      onChange: (snapshot: { docs: Trip[] }) => {
        onChange(snapshot.docs || [])
      },
      onError: (err: unknown) => {
        console.error('[watchMyTrips]', err)
      }
    })
}
```

- [ ] **Step 4.2:** 类型检查
```bash
npx tsc --noEmit
```

- [ ] **Step 4.3:** 提交
```bash
git add src/utils/db.ts
git commit -m "feat(utils): add db facade for trips CRUD + watch"
```

---

## Task 5: 创建 `<DatePicker />` 组件

> v1 采用 Taro 内置 `Picker mode="date"`（年月日 wheel）。"日历视图"留到 v1.1 升级。

**Files:**
- Create: `src/components/DatePicker/index.tsx`
- Create: `src/components/DatePicker/index.scss`

- [ ] **Step 5.1:** `src/components/DatePicker/index.tsx`
```tsx
import { View, Text, Picker } from '@tarojs/components'
import { fmtDate } from '../../utils/format'
import './index.scss'

interface DateRange {
  start: string  // 'YYYY-MM-DD'
  end: string
}

interface Props {
  value: DateRange
  onChange: (v: DateRange) => void
}

export default function DatePicker({ value, onChange }: Props) {
  return (
    <View className='date-picker'>
      <Picker
        mode='date'
        value={value.start}
        onChange={e => onChange({ ...value, start: String(e.detail.value) })}
      >
        <View className='dp-field'>
          <Text className='dp-label'>起</Text>
          <Text className='dp-value'>{fmtDate(value.start)}</Text>
        </View>
      </Picker>

      <Text className='dp-arrow'>→</Text>

      <Picker
        mode='date'
        value={value.end}
        start={value.start}
        onChange={e => onChange({ ...value, end: String(e.detail.value) })}
      >
        <View className='dp-field'>
          <Text className='dp-label'>止</Text>
          <Text className='dp-value'>{fmtDate(value.end)}</Text>
        </View>
      </Picker>
    </View>
  )
}
```

- [ ] **Step 5.2:** `src/components/DatePicker/index.scss`
```scss
.date-picker {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.dp-field {
  display: flex;
  flex-direction: column;
  padding: 16rpx 20rpx;
  border: 2rpx solid currentColor;
  border-radius: 12rpx;
  min-width: 200rpx;
}

.dp-label {
  font-size: 20rpx;
  letter-spacing: 4rpx;
  opacity: 0.55;
}

.dp-value {
  margin-top: 6rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.dp-arrow {
  font-size: 32rpx;
  opacity: 0.45;
}
```

- [ ] **Step 5.3:** 类型检查
```bash
npx tsc --noEmit
```

- [ ] **Step 5.4:** 提交
```bash
git add src/components/DatePicker/
git commit -m "feat(component): add DatePicker (wheel picker for date range)"
```

---

## Task 6: 创建 `<DestinationPicker />` 组件

**Files:**
- Create: `src/components/DestinationPicker/index.tsx`
- Create: `src/components/DestinationPicker/index.scss`

- [ ] **Step 6.1:** `src/components/DestinationPicker/index.tsx`
```tsx
import { useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import { cloud, type PoiResult } from '../../utils/cloud'
import type { Destination } from '../../types/trip'
import './index.scss'

interface Props {
  value: Destination[]
  onChange: (v: Destination[]) => void
}

export default function DestinationPicker({ value, onChange }: Props) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<PoiResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const search = async (kw: string) => {
    if (!kw.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await cloud.searchPoi({ keyword: kw })
      // 只保留城市级 POI（adcode 末 4 位为 0000 通常是省/市级），简单粗筛
      const cities = res.results.filter(r => r.adcode && r.adcode.endsWith('00'))
      setResults(cities.length > 0 ? cities.slice(0, 10) : res.results.slice(0, 10))
    } catch (e) {
      console.error('searchPoi failed', e)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const add = (poi: PoiResult) => {
    if (value.find(v => v.adcode === poi.adcode)) return  // 去重
    onChange([
      ...value,
      { name: poi.name, adcode: poi.adcode, lat: poi.lat, lng: poi.lng }
    ])
    setKeyword('')
    setResults([])
    setOpen(false)
  }

  const remove = (adcode: string) => {
    onChange(value.filter(v => v.adcode !== adcode))
  }

  return (
    <View className='dest-picker'>
      <View className='dp-chips'>
        {value.map(d => (
          <View key={d.adcode} className='dp-chip' onClick={() => remove(d.adcode)}>
            <Text className='dp-chip-text'>{d.name}</Text>
            <Text className='dp-chip-x'>×</Text>
          </View>
        ))}
        <View className='dp-add' onClick={() => setOpen(true)}>+ 添加</View>
      </View>

      {open && (
        <View className='dp-modal-mask' onClick={() => setOpen(false)}>
          <View className='dp-modal' onClick={e => e.stopPropagation()}>
            <View className='dp-modal-head'>
              <Text className='dp-modal-title'>添加目的地</Text>
              <Text className='dp-modal-close' onClick={() => setOpen(false)}>×</Text>
            </View>
            <Input
              className='dp-search'
              placeholder='搜索城市，例：南京 / 苏州'
              value={keyword}
              onInput={e => {
                setKeyword(e.detail.value)
                search(e.detail.value)
              }}
              focus
            />
            <ScrollView className='dp-results' scrollY>
              {loading && <View className='dp-hint'>搜索中...</View>}
              {!loading && results.length === 0 && keyword && (
                <View className='dp-hint'>未找到，换个关键词</View>
              )}
              {results.map(r => (
                <View key={r.adcode || r.name} className='dp-result' onClick={() => add(r)}>
                  <Text className='dp-result-name'>{r.name}</Text>
                  <Text className='dp-result-addr'>{r.city || r.address}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  )
}
```

- [ ] **Step 6.2:** `src/components/DestinationPicker/index.scss`
```scss
.dest-picker {
  width: 100%;
}

.dp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.dp-chip {
  display: inline-flex;
  align-items: center;
  padding: 8rpx 18rpx;
  border: 2rpx solid currentColor;
  border-radius: 999rpx;
  font-size: 24rpx;
}

.dp-chip-text { margin-right: 6rpx; }
.dp-chip-x { opacity: 0.55; }

.dp-add {
  padding: 8rpx 18rpx;
  border: 2rpx dashed currentColor;
  border-radius: 999rpx;
  font-size: 24rpx;
  opacity: 0.7;
}

.dp-modal-mask {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: flex-end;
  z-index: 100;
}

.dp-modal {
  width: 100%; max-height: 70vh;
  background: var(--bg, #f7f1e3);
  color: var(--ink, #2a2522);
  padding: 24rpx;
  border-radius: 24rpx 24rpx 0 0;
  display: flex; flex-direction: column;
}

.dp-modal-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16rpx;
}
.dp-modal-title { font-size: 30rpx; font-weight: 600; }
.dp-modal-close { font-size: 40rpx; opacity: 0.55; padding: 0 12rpx; }

.dp-search {
  padding: 16rpx 20rpx;
  border: 2rpx solid currentColor;
  border-radius: 12rpx;
  font-size: 28rpx;
  margin-bottom: 16rpx;
}

.dp-results { flex: 1; }

.dp-hint {
  padding: 24rpx;
  text-align: center;
  opacity: 0.5;
  font-size: 24rpx;
}

.dp-result {
  padding: 20rpx 12rpx;
  border-bottom: 1rpx solid rgba(0,0,0,0.08);
}
.dp-result-name { display: block; font-size: 28rpx; font-weight: 500; }
.dp-result-addr { display: block; margin-top: 4rpx; font-size: 22rpx; opacity: 0.6; }
```

- [ ] **Step 6.3:** 提交
```bash
git add src/components/DestinationPicker/
git commit -m "feat(component): add DestinationPicker (amap city search + chips)"
```

---

## Task 7: 创建 `<TripActionSheet />` 组件

**Files:**
- Create: `src/components/TripActionSheet/index.tsx`
- Create: `src/components/TripActionSheet/index.scss`

- [ ] **Step 7.1:** `src/components/TripActionSheet/index.tsx`
```tsx
import { View, Text } from '@tarojs/components'
import './index.scss'

export type TripAction = 'copy' | 'rename' | 'delete' | 'share'

interface Props {
  open: boolean
  tripName: string
  onSelect: (action: TripAction) => void
  onClose: () => void
}

const ITEMS: { key: TripAction; label: string; danger?: boolean }[] = [
  { key: 'copy', label: '复制攻略' },
  { key: 'rename', label: '重命名' },
  { key: 'share', label: '分享' },
  { key: 'delete', label: '删除', danger: true },
]

export default function TripActionSheet({ open, tripName, onSelect, onClose }: Props) {
  if (!open) return null
  return (
    <View className='trip-action-mask' onClick={onClose}>
      <View className='trip-action-sheet' onClick={e => e.stopPropagation()}>
        <View className='tas-head'>
          <Text className='tas-title'>{tripName}</Text>
        </View>
        <View className='tas-items'>
          {ITEMS.map(it => (
            <View
              key={it.key}
              className={`tas-item ${it.danger ? 'danger' : ''}`}
              onClick={() => { onSelect(it.key); onClose() }}
            >
              <Text>{it.label}</Text>
            </View>
          ))}
        </View>
        <View className='tas-cancel' onClick={onClose}>
          <Text>取消</Text>
        </View>
      </View>
    </View>
  )
}
```

- [ ] **Step 7.2:** `src/components/TripActionSheet/index.scss`
```scss
.trip-action-mask {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: flex-end;
  z-index: 100;
}

.trip-action-sheet {
  width: 100%;
  background: var(--bg, #f7f1e3);
  color: var(--ink, #2a2522);
  border-radius: 24rpx 24rpx 0 0;
  padding: 16rpx 0 32rpx;
}

.tas-head {
  padding: 24rpx 32rpx 16rpx;
  border-bottom: 2rpx solid rgba(0,0,0,0.06);
}
.tas-title {
  font-size: 24rpx;
  opacity: 0.6;
  letter-spacing: 1rpx;
}

.tas-items {}

.tas-item {
  padding: 28rpx 32rpx;
  font-size: 30rpx;
  border-bottom: 1rpx solid rgba(0,0,0,0.06);
}
.tas-item.danger { color: #c43d3d; }

.tas-cancel {
  margin-top: 16rpx;
  padding: 28rpx 0;
  text-align: center;
  font-size: 30rpx;
  font-weight: 500;
  border-top: 12rpx solid rgba(0,0,0,0.04);
}
```

- [ ] **Step 7.3:** 提交
```bash
git add src/components/TripActionSheet/
git commit -m "feat(component): add TripActionSheet (long-press menu)"
```

---

## Task 8: 创建 `pages/home/index`（攻略册首页）

**Files:**
- Create: `src/pages/home/index.tsx`
- Create: `src/pages/home/index.config.ts`
- Create: `src/pages/home/index.scss`

- [ ] **Step 8.1:** `src/pages/home/index.config.ts`
```ts
export default definePageConfig({
  navigationBarTitleText: '行册',
  navigationBarBackgroundColor: '#f7f1e3',
  navigationBarTextStyle: 'black',
})
```

- [ ] **Step 8.2:** `src/pages/home/index.tsx`
```tsx
import { useEffect, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import type { Trip } from '../../types/trip'
import { listMyTrips, watchMyTrips, renameTrip, deleteTrip, copyTripLocally } from '../../utils/db'
import { fmtDateShort, fmtCurrency } from '../../utils/format'
import { destinationLabel, tripSummary } from '../../utils/trip-helpers'
import TripActionSheet, { type TripAction } from '../../components/TripActionSheet'
import './index.scss'

export default function Home() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [actionTrip, setActionTrip] = useState<Trip | null>(null)
  const [openid, setOpenid] = useState<string>('')

  // 获取当前用户 openid（通过 ensure-user 同步）
  useEffect(() => {
    // 调用 ensure-user 拿 openid
    // @ts-ignore Taro.cloud
    Taro.cloud.callFunction({
      name: 'ensure-user',
      data: { nickname: '行册旅人', avatarUrl: '' }
    }).then((r: { result: { openid: string } }) => {
      setOpenid(r.result.openid)
    }).catch(e => {
      console.error('ensure-user failed', e)
    })
  }, [])

  // 初次拉 + watch
  useEffect(() => {
    if (!openid) return
    let watcher: { close: () => void } | null = null
    listMyTrips(openid).then(list => {
      setTrips(list)
      setLoading(false)
    })
    watcher = watchMyTrips(openid, list => {
      setTrips(list)
      setLoading(false)
    })
    return () => { watcher?.close() }
  }, [openid])

  // 从 new-trip 返回时刷新一次
  useDidShow(() => {
    if (openid) listMyTrips(openid).then(setTrips)
  })

  const handleAction = async (action: TripAction) => {
    if (!actionTrip) return
    const t = actionTrip
    setActionTrip(null)

    if (action === 'copy') {
      await copyTripLocally(t._id, openid)
      Taro.showToast({ title: '已复制', icon: 'success' })
      return
    }

    if (action === 'rename') {
      const res = await Taro.showModal({
        title: '重命名',
        editable: true,
        placeholderText: '攻略名',
        content: t.name,
      })
      if (res.confirm && res.content && res.content.trim()) {
        await renameTrip(t._id, res.content.trim(), openid)
      }
      return
    }

    if (action === 'delete') {
      const res = await Taro.showModal({
        title: '删除攻略？',
        content: `「${t.name}」将被永久删除，无法恢复`,
        confirmText: '删除',
        confirmColor: '#c43d3d',
      })
      if (res.confirm) {
        await deleteTrip(t._id)
        Taro.showToast({ title: '已删除', icon: 'success' })
      }
      return
    }

    if (action === 'share') {
      Taro.showToast({ title: '分享待 Phase 5', icon: 'none' })
      return
    }
  }

  return (
    <View className='home theme-tegami'>
      <View className='home-head'>
        <Text className='home-brand'>行册</Text>
        <Text className='home-sub'>旅行攻略 · 清单 · 地图</Text>
      </View>

      {loading && <View className='home-empty'>加载中...</View>}

      {!loading && trips.length === 0 && (
        <View className='home-empty'>
          <Text className='home-empty-text'>还没有攻略</Text>
          <Text className='home-empty-hint'>点下面"新建攻略"开启第一段旅程</Text>
        </View>
      )}

      <View className='home-list'>
        {trips.map(t => (
          <View
            key={t._id}
            className='trip-card'
            onClick={() => Taro.showToast({ title: '详情页待 Phase 3', icon: 'none' })}
            onLongPress={() => setActionTrip(t)}
          >
            <Text className='tc-name'>{t.name}</Text>
            <Text className='tc-meta'>
              {fmtDateShort(t.startDate)} → {fmtDateShort(t.endDate)} · {tripSummary(t.startDate, t.endDate, t.pax)}
            </Text>
            <View className='tc-dest'>
              {t.destinations.map(d => (
                <Text key={d.adcode} className='tc-dest-chip'>{d.name}</Text>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View className='home-foot'>
        <Button
          className='home-new-btn'
          onClick={() => Taro.navigateTo({ url: '/pages/new-trip/index' })}
        >
          + 新建攻略
        </Button>
      </View>

      <TripActionSheet
        open={!!actionTrip}
        tripName={actionTrip?.name || ''}
        onSelect={handleAction}
        onClose={() => setActionTrip(null)}
      />
    </View>
  )
}
```

- [ ] **Step 8.3:** `src/pages/home/index.scss`
```scss
.home {
  min-height: 100vh;
  padding: 32rpx 32rpx 200rpx;
  box-sizing: border-box;
}

.home.theme-tegami {
  --bg: #f7f1e3;
  --ink: #2a2522;
  background: var(--bg);
  color: var(--ink);
}

.home-head {
  padding: 24rpx 0 40rpx;
}
.home-brand {
  font-size: 64rpx;
  font-weight: 700;
  letter-spacing: 8rpx;
}
.home-sub {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  opacity: 0.55;
  letter-spacing: 2rpx;
}

.home-empty {
  margin: 80rpx 0;
  text-align: center;
}
.home-empty-text {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
}
.home-empty-hint {
  display: block;
  font-size: 24rpx;
  opacity: 0.55;
}

.home-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.trip-card {
  padding: 32rpx 0;
  border-bottom: 2rpx solid rgba(0,0,0,0.08);
}

.tc-name {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
}
.tc-meta {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  opacity: 0.6;
}
.tc-dest {
  display: flex;
  gap: 12rpx;
  margin-top: 14rpx;
  flex-wrap: wrap;
}
.tc-dest-chip {
  padding: 4rpx 14rpx;
  border: 2rpx solid currentColor;
  border-radius: 999rpx;
  font-size: 20rpx;
  letter-spacing: 1rpx;
  opacity: 0.75;
}

.home-foot {
  position: fixed;
  left: 32rpx; right: 32rpx;
  bottom: 40rpx;
}
.home-new-btn {
  width: 100%;
  background: var(--ink);
  color: var(--bg);
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 500;
  padding: 24rpx 0;
}
```

- [ ] **Step 8.4:** 类型检查
```bash
npx tsc --noEmit
```

- [ ] **Step 8.5:** 提交
```bash
git add src/pages/home/
git commit -m "feat(home): add home page with trip list + actions"
```

---

## Task 9: 创建 `pages/new-trip/index`（新建攻略表单）

**Files:**
- Create: `src/pages/new-trip/index.tsx`
- Create: `src/pages/new-trip/index.config.ts`
- Create: `src/pages/new-trip/index.scss`

- [ ] **Step 9.1:** `src/pages/new-trip/index.config.ts`
```ts
export default definePageConfig({
  navigationBarTitleText: '新建攻略',
  navigationBarBackgroundColor: '#f7f1e3',
  navigationBarTextStyle: 'black',
})
```

- [ ] **Step 9.2:** `src/pages/new-trip/index.tsx`
```tsx
import { useState, useEffect } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import dayjs from 'dayjs'
import DatePicker from '../../components/DatePicker'
import DestinationPicker from '../../components/DestinationPicker'
import type { Destination } from '../../types/trip'
import { buildNewTrip } from '../../utils/trip-helpers'
import { createTrip } from '../../utils/db'
import './index.scss'

export default function NewTrip() {
  const [name, setName] = useState('')
  const [pax, setPax] = useState(2)
  const [dates, setDates] = useState({
    start: dayjs().format('YYYY-MM-DD'),
    end: dayjs().add(2, 'day').format('YYYY-MM-DD'),
  })
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [openid, setOpenid] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // @ts-ignore Taro.cloud
    Taro.cloud.callFunction({
      name: 'ensure-user',
      data: { nickname: '行册旅人', avatarUrl: '' }
    }).then((r: { result: { openid: string } }) => setOpenid(r.result.openid))
  }, [])

  const canSubmit = !!name.trim() && !!openid && pax >= 1 && dayjs(dates.end).isAfter(dayjs(dates.start).subtract(1, 'day'))

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      const input = buildNewTrip({
        name,
        pax,
        startDate: dates.start,
        endDate: dates.end,
        destinations,
      })
      input.ownerOpenid = openid
      await createTrip(input)
      Taro.showToast({ title: '已创建', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch (e) {
      console.error('createTrip failed', e)
      Taro.showToast({ title: '创建失败', icon: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='new-trip theme-tegami'>
      <View className='nt-field'>
        <Text className='nt-label'>攻略名</Text>
        <Input
          className='nt-input'
          placeholder='例：南京 · 金陵四日'
          value={name}
          onInput={e => setName(e.detail.value)}
        />
      </View>

      <View className='nt-field'>
        <Text className='nt-label'>日期</Text>
        <DatePicker value={dates} onChange={setDates} />
      </View>

      <View className='nt-field'>
        <Text className='nt-label'>目的地</Text>
        <DestinationPicker value={destinations} onChange={setDestinations} />
      </View>

      <View className='nt-field'>
        <Text className='nt-label'>人数</Text>
        <View className='nt-pax'>
          <View
            className='nt-pax-btn'
            onClick={() => setPax(Math.max(1, pax - 1))}
          >−</View>
          <Text className='nt-pax-value'>{pax}</Text>
          <View
            className='nt-pax-btn'
            onClick={() => setPax(pax + 1)}
          >+</View>
        </View>
      </View>

      <View className='nt-foot'>
        <Button
          className='nt-cancel'
          onClick={() => Taro.navigateBack()}
        >取消</Button>
        <Button
          className='nt-submit'
          disabled={!canSubmit || submitting}
          onClick={submit}
        >{submitting ? '创建中...' : '创建'}</Button>
      </View>
    </View>
  )
}
```

- [ ] **Step 9.3:** `src/pages/new-trip/index.scss`
```scss
.new-trip {
  min-height: 100vh;
  padding: 32rpx 32rpx 200rpx;
  box-sizing: border-box;
}

.new-trip.theme-tegami {
  --bg: #f7f1e3;
  --ink: #2a2522;
  background: var(--bg);
  color: var(--ink);
}

.nt-field {
  margin-bottom: 36rpx;
}

.nt-label {
  display: block;
  margin-bottom: 14rpx;
  font-size: 22rpx;
  letter-spacing: 4rpx;
  font-weight: 700;
  opacity: 0.55;
  text-transform: uppercase;
}

.nt-input {
  padding: 16rpx 20rpx;
  border: 2rpx solid currentColor;
  border-radius: 12rpx;
  font-size: 28rpx;
}

.nt-pax {
  display: flex;
  align-items: center;
  gap: 32rpx;
}
.nt-pax-btn {
  width: 64rpx; height: 64rpx;
  border: 2rpx solid currentColor;
  border-radius: 999rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 36rpx;
  font-weight: 500;
}
.nt-pax-value {
  font-size: 36rpx;
  font-weight: 600;
  min-width: 48rpx;
  text-align: center;
}

.nt-foot {
  position: fixed;
  left: 32rpx; right: 32rpx;
  bottom: 40rpx;
  display: flex;
  gap: 16rpx;
}

.nt-cancel, .nt-submit {
  flex: 1;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 500;
  padding: 24rpx 0;
}

.nt-cancel {
  background: transparent;
  border: 2rpx solid currentColor;
  color: var(--ink);
}

.nt-submit {
  background: var(--ink);
  color: var(--bg);
}

.nt-submit[disabled] {
  opacity: 0.5;
}
```

- [ ] **Step 9.4:** 类型检查
```bash
npx tsc --noEmit
```

- [ ] **Step 9.5:** 提交
```bash
git add src/pages/new-trip/
git commit -m "feat(new-trip): add new trip form page"
```

---

## Task 10: 更新 `app.config.ts` + 删除旧 index 页

**Files:**
- Modify: `src/app.config.ts`
- Delete: `src/pages/index/`

- [ ] **Step 10.1:** 完整替换 `src/app.config.ts`
```ts
export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/new-trip/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f7f1e3',
    navigationBarTitleText: '行册',
    navigationBarTextStyle: 'black',
  },
  lazyCodeLoading: 'requiredComponents',
})
```

- [ ] **Step 10.2:** 删除旧的 index 页
```bash
rm -rf /Users/jinchi/Documents/行册/src/pages/index
```

- [ ] **Step 10.3:** 类型检查（确认没有残留 import）
```bash
npx tsc --noEmit
```

预期：0 error。如还有报错（比如 utils/override.ts 残留），把它一并删（override.ts 在 Phase 4 删除，本期暂保留即可，但要确认它没被任何 page import）。

- [ ] **Step 10.4:** dev build 验证
```bash
# watch 已运行；微信开发者工具点"编译"
```

预期：home 页加载、点 + 新建攻略跳转到 new-trip 页。

- [ ] **Step 10.5:** 提交
```bash
git add src/app.config.ts
git rm -r src/pages/index
git commit -m "refactor(routes): replace single index page with home + new-trip"
```

---

## Task 11: 端到端验证

**Files:** 无；纯手动操作。

- [ ] **Step 11.1:** 打开微信开发者工具，编译最新代码

- [ ] **Step 11.2:** 首屏看到 home 页：标题"行册" + 副标 + 空态文案 + 底部 [+ 新建攻略] 按钮

- [ ] **Step 11.3:** 点 [+ 新建攻略] → 跳到 new-trip 页

- [ ] **Step 11.4:** 在 new-trip 页填：
- 攻略名：测试攻略
- 日期：默认值（今天 → 3 天后）
- 目的地：点 [+ 添加] → 弹窗里搜"南京" → 选第一条
- 人数：点 + 加到 3

- [ ] **Step 11.5:** 点 [创建] → toast "已创建" → 返回 home 页 → 看到新攻略卡片

- [ ] **Step 11.6:** 长按攻略卡片 → ActionSheet 弹出 → 点 [重命名] → 弹 modal 输入"新名字" → 确认 → 卡片名字立刻变（watch 推送）

- [ ] **Step 11.7:** 再长按 → [复制攻略] → toast"已复制" → 列表出现两条

- [ ] **Step 11.8:** 长按副本卡片 → [删除] → 弹 modal 确认 → toast"已删除" → 列表少一条

- [ ] **Step 11.9:** 长按攻略卡片 → [分享] → toast "分享待 Phase 5"

- [ ] **Step 11.10:** 复制小程序链接 → 在另一个开发者工具实例（或微信小程序 PC 端模拟）登录相同账号 → 编辑 home 列表里某一项的名字 → 第一个实例几秒内看到名字自动变（watch 实时性验证）

> 如无第二实例可跳过 11.10；后续 Phase 3 会跨真机验证同步。

- [ ] **Step 11.11:** 全部通过后提交（如有 .gitignore 或杂项变动）
```bash
git status
git add -A
git diff --cached
# 如改动合理：
git commit -m "chore(phase2): verification passed"
```

---

## 12. Phase 2 验收

- 12.1 ✅ home 页能看到自己的攻略列表，按 updatedAt 倒序
- 12.2 ✅ new-trip 页能填表 + 用日期 picker + 高德搜城市 + 多选目的地
- 12.3 ✅ 创建后自动 seed N 个空 day（看云数据库 trips 文档里 `days[]` 长度对得上）
- 12.4 ✅ 长按 ActionSheet 4 项功能：复制 / 重命名 / 删除 / 分享（最后一个先占位）
- 12.5 ✅ 删除有确认 modal；重命名有 input modal
- 12.6 ✅ db.watch 实时推送：另一端编辑，本端 < 3s 内看到变化
- 12.7 ✅ 旧 `src/pages/index/` 已删，`app.config.ts` 只剩两个页面
- 12.8 ✅ TypeScript `tsc --noEmit` 无 error

全部 ✅ 后，本 plan 结束。下一份 plan 处理 Phase 3（攻略详情页 + spot 编辑 + 同步）。
