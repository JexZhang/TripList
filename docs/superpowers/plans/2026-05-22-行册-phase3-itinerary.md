# 行迹 Phase 3 · 攻略详情页 + Spot 编辑 + L1 同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现攻略详情页的完整时间线交互——按天浏览/加删天、加删改 spot、地点搜索、天气展示，并通过 db.watch + 500ms debounce 实现 L1 last-write-wins 协作同步。

**Architecture:** 用 React Context + useReducer 管理当前 trip 状态；任何编辑动作走 reducer 立即更新 UI，同时触发 500ms debounce 写回云数据库。db.watch 监听远端变化，本地无 pending 时应用更新。SpotSearch / EditSpotSheet 是半屏弹层组件，状态由 Context 提供。

**Tech Stack:** Taro 4.2 / React 18 / TypeScript · 微信云开发 db.watch · Phase 1 高德云函数（POI + 天气）· Phase 2 完成的 home / new-trip

---

## 0. 前置条件

- **0.1** Phase 2 已完成验收
- **0.2** 当前可以从 home 跳到 new-trip、能创建/重命名/复制/删除攻略
- **0.3** types/trip.ts 已升级为 typed-spot 模型（Phase 2 Task 1）

---

## 1. 文件结构

```
src/
├── app.config.ts                  ← 修改：添加 pages/trip/index
├── pages/
│   ├── home/                      （沿用，仅修改卡片点击跳转）
│   ├── new-trip/                  （沿用）
│   └── trip/                      ← 新建
│       ├── index.tsx
│       ├── index.config.ts
│       └── index.scss
├── store/
│   └── trip-store.tsx             ← 新建（含 Context + reducer + watch + debounce）
├── views/
│   └── ItineraryView/             ← 新建
│       ├── index.tsx
│       ├── DayHeader.tsx
│       ├── SpotCard.tsx
│       └── index.scss
├── components/
│   ├── SpotSearch/                ← 新建
│   │   ├── index.tsx
│   │   └── index.scss
│   └── EditSpotSheet/             ← 新建
│       ├── index.tsx
│       └── index.scss
└── utils/
    └── weather.ts                 ← 新建（拉天气 + 缓存）
```

---

## Task 1: 创建 `store/trip-store.tsx`（Context + reducer + 同步）

**Files:**
- Create: `src/store/trip-store.tsx`

- [ ] **Step 1.1:** 创建文件
```tsx
import { createContext, useContext, useEffect, useReducer, useRef, ReactNode } from 'react'
import Taro from '@tarojs/taro'
import type { Trip, Day, Spot } from '../types/trip'
import { getTrip, updateTrip } from '../utils/db'

type Action =
  | { type: 'SET_TRIP'; trip: Trip }
  | { type: 'UPDATE_TRIP'; patch: Partial<Trip> }
  | { type: 'UPDATE_DAY'; dayId: string; patch: Partial<Day> }
  | { type: 'ADD_DAY'; day: Day }
  | { type: 'DELETE_DAY'; dayId: string }
  | { type: 'ADD_SPOT'; dayId: string; spot: Spot }
  | { type: 'UPDATE_SPOT'; dayId: string; spotId: string; patch: Partial<Spot> }
  | { type: 'DELETE_SPOT'; dayId: string; spotId: string }
  | { type: 'ERROR'; error: string }

interface State {
  trip: Trip | null
  loading: boolean
  error: string | null
}

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case 'SET_TRIP':
      return { trip: a.trip, loading: false, error: null }
    case 'ERROR':
      return { ...state, error: a.error, loading: false }
  }
  if (!state.trip) return state
  const trip = state.trip
  switch (a.type) {
    case 'UPDATE_TRIP':
      return { ...state, trip: { ...trip, ...a.patch } }
    case 'UPDATE_DAY':
      return {
        ...state,
        trip: { ...trip, days: trip.days.map(d => d.id === a.dayId ? { ...d, ...a.patch } : d) }
      }
    case 'ADD_DAY':
      return { ...state, trip: { ...trip, days: [...trip.days, a.day] } }
    case 'DELETE_DAY':
      return { ...state, trip: { ...trip, days: trip.days.filter(d => d.id !== a.dayId) } }
    case 'ADD_SPOT':
      return {
        ...state,
        trip: {
          ...trip,
          days: trip.days.map(d =>
            d.id === a.dayId ? { ...d, spots: [...d.spots, a.spot] } : d
          )
        }
      }
    case 'UPDATE_SPOT':
      return {
        ...state,
        trip: {
          ...trip,
          days: trip.days.map(d => {
            if (d.id !== a.dayId) return d
            return { ...d, spots: d.spots.map(s => s.id === a.spotId ? { ...s, ...a.patch } : s) }
          })
        }
      }
    case 'DELETE_SPOT':
      return {
        ...state,
        trip: {
          ...trip,
          days: trip.days.map(d => {
            if (d.id !== a.dayId) return d
            return { ...d, spots: d.spots.filter(s => s.id !== a.spotId) }
          })
        }
      }
  }
  return state
}

interface ContextValue {
  state: State
  dispatch: React.Dispatch<Action>
  openid: string
}

const Ctx = createContext<ContextValue | null>(null)

export function TripProvider({
  tripId, openid, children,
}: { tripId: string; openid: string; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { trip: null, loading: true, error: null })
  const lastSavedRef = useRef<string>('')  // JSON 字串作为版本指纹
  const pendingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 初次拉 + watch 订阅
  useEffect(() => {
    let watcher: { close: () => void } | null = null
    getTrip(tripId).then(trip => {
      if (!trip) {
        dispatch({ type: 'ERROR', error: 'Trip not found' })
        return
      }
      dispatch({ type: 'SET_TRIP', trip })
      lastSavedRef.current = JSON.stringify(trip)
    })

    // @ts-ignore Taro.cloud.database watch
    watcher = Taro.cloud.database().collection('trips').doc(tripId).watch({
      onChange: (snapshot: { docs: Trip[] }) => {
        const doc = snapshot.docs && snapshot.docs[0]
        if (!doc) return
        if (pendingRef.current) return  // 本地有未保存编辑，忽略远端推送
        if (doc.updatedBy === openid) return  // 自己刚保存的，避免循环
        dispatch({ type: 'SET_TRIP', trip: doc })
        lastSavedRef.current = JSON.stringify(doc)
        Taro.showToast({ title: '已同步协作者改动', icon: 'none', duration: 1500 })
      },
      onError: (e: unknown) => console.error('[trip watch]', e),
    })

    return () => { watcher?.close() }
  }, [tripId, openid])

  // 编辑 → 500ms debounce 保存
  useEffect(() => {
    if (!state.trip || state.loading) return
    const snapshot = JSON.stringify(state.trip)
    if (snapshot === lastSavedRef.current) return  // 没有真实变化

    pendingRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const trip = state.trip!
      try {
        await updateTrip(trip._id, {
          name: trip.name,
          pax: trip.pax,
          startDate: trip.startDate,
          endDate: trip.endDate,
          destinations: trip.destinations,
          days: trip.days,
          packing: trip.packing,
        }, openid)
        lastSavedRef.current = snapshot
      } catch (e) {
        console.error('[trip save]', e)
        Taro.showToast({ title: '保存失败', icon: 'error' })
      } finally {
        pendingRef.current = false
      }
    }, 500)
  }, [state.trip, state.loading, openid])

  return (
    <Ctx.Provider value={{ state, dispatch, openid }}>
      {children}
    </Ctx.Provider>
  )
}

export function useTripStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTripStore must be used within TripProvider')
  return ctx
}
```

- [ ] **Step 1.2:** 类型检查
```bash
cd /Users/jinchi/Documents/行迹
npx tsc --noEmit
```

- [ ] **Step 1.3:** 提交
```bash
git add src/store/trip-store.tsx
git commit -m "feat(store): add TripProvider with L1 sync (watch + debounce)"
```

---

## Task 2: 创建 `utils/weather.ts`（拉取 + 缓存）

**Files:**
- Create: `src/utils/weather.ts`

- [ ] **Step 2.1:** 创建文件
```ts
import { cloud, type WeatherInfo } from './cloud'

const CACHE_TTL = 30 * 60 * 1000  // 30 min

interface CacheEntry {
  data: WeatherInfo
  ts: number
}

const cache = new Map<string, CacheEntry>()

export async function loadWeather(adcode: string, force = false): Promise<WeatherInfo | null> {
  const now = Date.now()
  const cached = cache.get(adcode)
  if (!force && cached && (now - cached.ts) < CACHE_TTL) {
    return cached.data
  }
  try {
    const res = await cloud.getWeather({ adcode })
    if (res.weather) {
      cache.set(adcode, { data: res.weather, ts: now })
      return res.weather
    }
  } catch (e) {
    console.error('[weather]', e)
  }
  return null
}
```

- [ ] **Step 2.2:** 提交
```bash
git add src/utils/weather.ts
git commit -m "feat(utils): add weather loader with 30-min cache"
```

---

## Task 3: 创建 `components/SpotSearch`

**Files:**
- Create: `src/components/SpotSearch/index.tsx`
- Create: `src/components/SpotSearch/index.scss`

- [ ] **Step 3.1:** `src/components/SpotSearch/index.tsx`
```tsx
import { useState, useEffect } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import { cloud, type PoiResult } from '../../utils/cloud'
import './index.scss'

export interface SelectedSpotInfo {
  name: string
  city?: string
  adcode?: string
  lat?: number
  lng?: number
}

interface Props {
  open: boolean
  defaultCity?: string
  onClose: () => void
  onSelect: (info: SelectedSpotInfo) => void
}

export default function SpotSearch({ open, defaultCity, onClose, onSelect }: Props) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<PoiResult[]>([])
  const [loading, setLoading] = useState(false)
  const [debouncedKw, setDebouncedKw] = useState('')

  // debounce 输入
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => setDebouncedKw(keyword), 300)
    return () => clearTimeout(t)
  }, [keyword, open])

  // 触发搜索
  useEffect(() => {
    if (!debouncedKw.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    cloud.searchPoi({ keyword: debouncedKw, city: defaultCity })
      .then(r => setResults(r.results))
      .catch(e => {
        console.error('[poi search]', e)
        setResults([])
      })
      .finally(() => setLoading(false))
  }, [debouncedKw, defaultCity])

  // 关闭时清状态
  useEffect(() => {
    if (!open) {
      setKeyword('')
      setResults([])
    }
  }, [open])

  if (!open) return null

  const useManual = () => {
    if (!keyword.trim()) return
    onSelect({ name: keyword.trim() })
    onClose()
  }

  const useResult = (r: PoiResult) => {
    onSelect({
      name: r.name,
      city: r.city || undefined,
      adcode: r.adcode || undefined,
      lat: r.lat || undefined,
      lng: r.lng || undefined,
    })
    onClose()
  }

  return (
    <View className='spot-search-mask' onClick={onClose}>
      <View className='spot-search-sheet' onClick={e => e.stopPropagation()}>
        <View className='ss-head'>
          <Text className='ss-title'>添加地点</Text>
          <Text className='ss-close' onClick={onClose}>×</Text>
        </View>
        <Input
          className='ss-input'
          placeholder='搜索地点，例：德基广场 / 玄武湖'
          value={keyword}
          onInput={e => setKeyword(e.detail.value)}
          focus
        />
        <ScrollView className='ss-results' scrollY>
          {loading && <View className='ss-hint'>搜索中...</View>}
          {!loading && results.map((r, i) => (
            <View key={`${r.adcode}-${i}`} className='ss-result' onClick={() => useResult(r)}>
              <Text className='ss-result-name'>{r.name}</Text>
              <Text className='ss-result-addr'>{r.city ? `${r.city} · ` : ''}{r.address || ''}</Text>
            </View>
          ))}
          {!loading && results.length === 0 && keyword.trim() && (
            <View className='ss-hint'>未搜到。点下面"手动添加"用"{keyword}"作为名字。</View>
          )}
        </ScrollView>
        {keyword.trim() && (
          <View className='ss-manual' onClick={useManual}>
            <Text>+ 手动添加 "{keyword.trim()}"</Text>
          </View>
        )}
      </View>
    </View>
  )
}
```

- [ ] **Step 3.2:** `src/components/SpotSearch/index.scss`
```scss
.spot-search-mask {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: flex-end;
  z-index: 100;
}

.spot-search-sheet {
  width: 100%; height: 80vh;
  background: var(--bg, #f7f1e3);
  color: var(--ink, #2a2522);
  border-radius: 24rpx 24rpx 0 0;
  display: flex; flex-direction: column;
  padding: 24rpx;
  box-sizing: border-box;
}

.ss-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16rpx;
}
.ss-title { font-size: 30rpx; font-weight: 600; }
.ss-close { font-size: 40rpx; opacity: 0.55; padding: 0 12rpx; }

.ss-input {
  padding: 16rpx 20rpx;
  border: 2rpx solid currentColor;
  border-radius: 12rpx;
  font-size: 28rpx;
  margin-bottom: 16rpx;
}

.ss-results { flex: 1; }

.ss-hint {
  padding: 32rpx;
  text-align: center;
  font-size: 24rpx;
  opacity: 0.55;
}

.ss-result {
  padding: 20rpx 12rpx;
  border-bottom: 1rpx solid rgba(0,0,0,0.08);
}
.ss-result-name { display: block; font-size: 28rpx; }
.ss-result-addr { display: block; margin-top: 4rpx; font-size: 22rpx; opacity: 0.55; }

.ss-manual {
  margin-top: 16rpx;
  padding: 20rpx;
  border: 2rpx dashed currentColor;
  border-radius: 12rpx;
  text-align: center;
  font-size: 26rpx;
  opacity: 0.85;
}
```

- [ ] **Step 3.3:** 提交
```bash
git add src/components/SpotSearch/
git commit -m "feat(component): add SpotSearch (amap POI + manual fallback)"
```

---

## Task 4: 创建 `components/EditSpotSheet`

**Files:**
- Create: `src/components/EditSpotSheet/index.tsx`
- Create: `src/components/EditSpotSheet/index.scss`

- [ ] **Step 4.1:** `src/components/EditSpotSheet/index.tsx`
```tsx
import { useState, useEffect } from 'react'
import { View, Text, Input, Textarea, Picker, ScrollView } from '@tarojs/components'
import type { Spot, SpotType } from '../../types/trip'
import SpotSearch, { type SelectedSpotInfo } from '../SpotSearch'
import './index.scss'

const TYPES: { key: SpotType; label: string }[] = [
  { key: 'spot', label: '景点 / 其它' },
  { key: 'hotel', label: '住宿' },
  { key: 'meal', label: '餐饮' },
  { key: 'transport', label: '交通' },
  { key: 'arrive', label: '抵达 / 出发' },
]

interface Props {
  open: boolean
  spot: Spot | null
  defaultCity?: string
  onClose: () => void
  onSave: (patch: Partial<Spot>) => void
  onDelete: () => void
}

export default function EditSpotSheet({ open, spot, defaultCity, onClose, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<Partial<Spot>>({})
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    if (open && spot) {
      setDraft({ ...spot })
    }
  }, [open, spot])

  if (!open || !spot) return null

  const set = <K extends keyof Spot>(k: K, v: Spot[K]) => setDraft(d => ({ ...d, [k]: v }))

  const replaceLocation = (info: SelectedSpotInfo) => {
    setDraft(d => ({
      ...d,
      name: info.name,
      city: info.city,
      adcode: info.adcode,
      lat: info.lat,
      lng: info.lng,
    }))
  }

  const save = () => {
    onSave(draft)
    onClose()
  }

  const type = draft.type || 'spot'

  return (
    <View className='edit-spot-mask' onClick={onClose}>
      <View className='edit-spot-sheet' onClick={e => e.stopPropagation()}>
        <View className='es-head'>
          <Text className='es-title'>编辑地点</Text>
          <Text className='es-close' onClick={onClose}>×</Text>
        </View>

        <ScrollView className='es-body' scrollY>
          {/* 名字（点击重开搜索） */}
          <View className='es-field'>
            <Text className='es-label'>地点</Text>
            <View className='es-name-row' onClick={() => setSearchOpen(true)}>
              <Text className='es-name'>{draft.name || '(未填)'}</Text>
              <Text className='es-name-edit'>改…</Text>
            </View>
            {draft.city && <Text className='es-name-city'>{draft.city}</Text>}
          </View>

          {/* 时间 */}
          <View className='es-field'>
            <Text className='es-label'>时间（可空）</Text>
            <Picker
              mode='time'
              value={draft.time || '12:00'}
              onChange={e => set('time', String(e.detail.value))}
            >
              <View className='es-picker'>{draft.time || '点此选时间'}</View>
            </Picker>
          </View>

          {/* 类型 */}
          <View className='es-field'>
            <Text className='es-label'>类型</Text>
            <View className='es-types'>
              {TYPES.map(t => (
                <View
                  key={t.key}
                  className={`es-type ${type === t.key ? 'on' : ''}`}
                  onClick={() => set('type', t.key)}
                >{t.label}</View>
              ))}
            </View>
          </View>

          {/* 价格 */}
          <View className='es-field'>
            <Text className='es-label'>价格（可空）</Text>
            <Input
              className='es-input'
              type='digit'
              placeholder='0'
              value={draft.price != null ? String(draft.price) : ''}
              onInput={e => {
                const v = e.detail.value
                set('price', v ? parseInt(v, 10) || 0 : undefined)
              }}
            />
          </View>

          {/* 备注 */}
          <View className='es-field'>
            <Text className='es-label'>备注（可空）</Text>
            <Textarea
              className='es-textarea'
              placeholder='交通方式 / 注意事项 / 等等...'
              value={draft.note || ''}
              onInput={e => set('note', e.detail.value)}
              maxlength={500}
            />
          </View>

          {/* type=hotel 专属 */}
          {type === 'hotel' && (
            <View className='es-field'>
              <Text className='es-label'>住几晚</Text>
              <Input
                className='es-input'
                type='number'
                placeholder='1'
                value={draft.nights != null ? String(draft.nights) : ''}
                onInput={e => set('nights', parseInt(e.detail.value, 10) || undefined)}
              />
            </View>
          )}

          {/* type=transport 专属 */}
          {type === 'transport' && (
            <>
              <View className='es-field'>
                <Text className='es-label'>方式</Text>
                <Input
                  className='es-input'
                  placeholder='高铁 / 飞机 / 自驾...'
                  value={draft.mode || ''}
                  onInput={e => set('mode', e.detail.value)}
                />
              </View>
              <View className='es-field'>
                <Text className='es-label'>从</Text>
                <Input
                  className='es-input'
                  placeholder='起点'
                  value={draft.from || ''}
                  onInput={e => set('from', e.detail.value)}
                />
              </View>
              <View className='es-field'>
                <Text className='es-label'>到</Text>
                <Input
                  className='es-input'
                  placeholder='终点'
                  value={draft.to || ''}
                  onInput={e => set('to', e.detail.value)}
                />
              </View>
            </>
          )}

          <View
            className='es-delete'
            onClick={() => { onDelete(); onClose() }}
          >删除地点</View>
        </ScrollView>

        <View className='es-foot'>
          <View className='es-cancel' onClick={onClose}>取消</View>
          <View className='es-save' onClick={save}>保存</View>
        </View>

        <SpotSearch
          open={searchOpen}
          defaultCity={defaultCity}
          onClose={() => setSearchOpen(false)}
          onSelect={replaceLocation}
        />
      </View>
    </View>
  )
}
```

- [ ] **Step 4.2:** `src/components/EditSpotSheet/index.scss`
```scss
.edit-spot-mask {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: flex-end;
  z-index: 90;
}

.edit-spot-sheet {
  width: 100%; height: 88vh;
  background: var(--bg, #f7f1e3);
  color: var(--ink, #2a2522);
  border-radius: 24rpx 24rpx 0 0;
  display: flex; flex-direction: column;
  box-sizing: border-box;
}

.es-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 24rpx 32rpx 16rpx;
  border-bottom: 2rpx solid rgba(0,0,0,0.06);
}
.es-title { font-size: 30rpx; font-weight: 600; }
.es-close { font-size: 40rpx; opacity: 0.55; padding: 0 12rpx; }

.es-body {
  flex: 1;
  padding: 24rpx 32rpx;
}

.es-field {
  margin-bottom: 28rpx;
}

.es-label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 20rpx;
  letter-spacing: 4rpx;
  opacity: 0.55;
  font-weight: 700;
  text-transform: uppercase;
}

.es-input, .es-picker {
  padding: 16rpx 20rpx;
  border: 2rpx solid currentColor;
  border-radius: 12rpx;
  font-size: 28rpx;
  min-height: 44rpx;
}

.es-textarea {
  padding: 16rpx 20rpx;
  border: 2rpx solid currentColor;
  border-radius: 12rpx;
  font-size: 26rpx;
  min-height: 140rpx;
  width: 100%;
  box-sizing: border-box;
}

.es-name-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20rpx;
  border: 2rpx solid currentColor;
  border-radius: 12rpx;
}
.es-name { font-size: 28rpx; font-weight: 500; flex: 1; }
.es-name-edit { font-size: 22rpx; opacity: 0.6; padding-left: 16rpx; }
.es-name-city {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  opacity: 0.55;
}

.es-types {
  display: flex; flex-wrap: wrap; gap: 12rpx;
}
.es-type {
  padding: 10rpx 20rpx;
  border: 2rpx solid currentColor;
  border-radius: 999rpx;
  font-size: 22rpx;
  opacity: 0.55;
}
.es-type.on { opacity: 1; background: var(--ink); color: var(--bg); }

.es-delete {
  margin-top: 40rpx;
  padding: 24rpx;
  text-align: center;
  color: #c43d3d;
  border: 2rpx solid #c43d3d;
  border-radius: 12rpx;
  font-size: 26rpx;
}

.es-foot {
  display: flex;
  border-top: 2rpx solid rgba(0,0,0,0.06);
  padding: 16rpx 32rpx 32rpx;
  gap: 16rpx;
}
.es-cancel, .es-save {
  flex: 1; text-align: center;
  padding: 24rpx 0;
  border-radius: 16rpx;
  font-size: 30rpx;
}
.es-cancel { border: 2rpx solid currentColor; }
.es-save { background: var(--ink); color: var(--bg); font-weight: 500; }
```

- [ ] **Step 4.3:** 提交
```bash
git add src/components/EditSpotSheet/
git commit -m "feat(component): add EditSpotSheet"
```

---

## Task 5: 创建 `views/ItineraryView`

**Files:**
- Create: `src/views/ItineraryView/index.tsx`
- Create: `src/views/ItineraryView/DayHeader.tsx`
- Create: `src/views/ItineraryView/SpotCard.tsx`
- Create: `src/views/ItineraryView/index.scss`

- [ ] **Step 5.1:** `src/views/ItineraryView/SpotCard.tsx`
```tsx
import { View, Text } from '@tarojs/components'
import type { Spot } from '../../types/trip'
import { fmtCurrency } from '../../utils/format'

const ICON: Record<string, string> = {
  spot: '◉',
  hotel: '🛏',
  meal: '🍜',
  transport: '🚄',
  arrive: '✈',
}

interface Props {
  spot: Spot
  onClick: () => void
}

export default function SpotCard({ spot, onClick }: Props) {
  return (
    <View className='spot-card' onClick={onClick}>
      <View className='sc-head'>
        <Text className='sc-icon'>{ICON[spot.type] || '◉'}</Text>
        <Text className='sc-time'>{spot.time || '—'}</Text>
        <Text className='sc-name'>{spot.name}</Text>
      </View>
      {(spot.note || spot.price) && (
        <View className='sc-foot'>
          {spot.note ? <Text className='sc-note'>{spot.note}</Text> : null}
          {spot.price ? <Text className='sc-price'>{fmtCurrency(spot.price)}</Text> : null}
        </View>
      )}
    </View>
  )
}
```

- [ ] **Step 5.2:** `src/views/ItineraryView/DayHeader.tsx`
```tsx
import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import type { Day } from '../../types/trip'
import { loadWeather } from '../../utils/weather'

interface Props {
  day: Day
  onWeatherUpdate: (w: Day['weather']) => void
}

export default function DayHeader({ day, onWeatherUpdate }: Props) {
  const [showCityPicker, setShowCityPicker] = useState(false)

  // 取当日所有城市去重
  const cities = Array.from(
    new Set(day.spots.map(s => s.city).filter(Boolean))
  ) as string[]
  const mainCityAdcode = day.weather?.cityAdcode
    || day.spots.find(s => s.adcode)?.adcode
    || ''

  // 首次进入时拉天气
  useEffect(() => {
    if (!mainCityAdcode) return
    const cached = day.weather
    const stale = !cached || (Date.now() - cached.fetchedAt) > 30 * 60 * 1000
    if (!stale) return
    loadWeather(mainCityAdcode).then(w => {
      if (w) onWeatherUpdate(w)
    })
  }, [mainCityAdcode])

  return (
    <View className='day-header'>
      <View className='dh-cities' onClick={() => cities.length > 1 && setShowCityPicker(v => !v)}>
        {cities.length > 0 ? cities.join(' → ') : '未定城市'}
        {cities.length > 1 && <Text className='dh-arrow'>▾</Text>}
      </View>
      {day.weather && (
        <Text className='dh-weather'>
          {day.weather.desc} {day.weather.low}°-{day.weather.temp}°
        </Text>
      )}
      {showCityPicker && (
        <View className='dh-city-picker'>
          {cities.map(c => {
            const spot = day.spots.find(s => s.city === c && s.adcode)
            const adcode = spot?.adcode
            if (!adcode) return null
            return (
              <View
                key={c}
                className='dh-city-item'
                onClick={async () => {
                  const w = await loadWeather(adcode, true)
                  if (w) onWeatherUpdate(w)
                  setShowCityPicker(false)
                }}
              >{c}</View>
            )
          })}
        </View>
      )}
    </View>
  )
}
```

- [ ] **Step 5.3:** `src/views/ItineraryView/index.tsx`
```tsx
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import dayjs from 'dayjs'
import { useTripStore } from '../../store/trip-store'
import { uid } from '../../utils/id'
import type { Spot, Day } from '../../types/trip'
import DayHeader from './DayHeader'
import SpotCard from './SpotCard'
import SpotSearch, { type SelectedSpotInfo } from '../../components/SpotSearch'
import EditSpotSheet from '../../components/EditSpotSheet'
import './index.scss'

export default function ItineraryView() {
  const { state, dispatch } = useTripStore()
  const trip = state.trip!
  const [activeDayId, setActiveDayId] = useState<string>(trip.days[0]?.id || '')
  const [searchOpen, setSearchOpen] = useState(false)
  const [editSpot, setEditSpot] = useState<{ dayId: string; spot: Spot } | null>(null)

  const activeDay: Day | undefined = trip.days.find(d => d.id === activeDayId) || trip.days[0]

  const addDay = () => {
    const last = trip.days[trip.days.length - 1]
    const newDate = last
      ? dayjs(last.date).add(1, 'day').format('YYYY-MM-DD')
      : dayjs(trip.startDate).format('YYYY-MM-DD')
    const day: Day = { id: uid(), date: newDate, spots: [], weather: null }
    dispatch({ type: 'ADD_DAY', day })
    setActiveDayId(day.id)
  }

  const longPressDay = async (dayId: string, dayNo: number) => {
    const res = await Taro.showModal({
      title: `删除 Day ${dayNo}？`,
      content: '该日的所有 spots 一并删除',
      confirmText: '删除',
      confirmColor: '#c43d3d',
    })
    if (res.confirm) {
      dispatch({ type: 'DELETE_DAY', dayId })
      if (activeDayId === dayId) {
        setActiveDayId(trip.days.find(d => d.id !== dayId)?.id || '')
      }
    }
  }

  const handleAddSpot = (info: SelectedSpotInfo) => {
    if (!activeDay) return
    const spot: Spot = {
      id: uid(),
      type: 'spot',
      name: info.name,
      city: info.city,
      adcode: info.adcode,
      lat: info.lat,
      lng: info.lng,
    }
    dispatch({ type: 'ADD_SPOT', dayId: activeDay.id, spot })
  }

  if (!activeDay) return <View className='itinerary-empty'>没有日程，点 [+] 加一天</View>

  return (
    <View className='itinerary'>
      {/* day tabs */}
      <ScrollView className='itin-tabs' scrollX enableFlex>
        {trip.days.map((d, idx) => (
          <View
            key={d.id}
            className={`itin-tab ${activeDayId === d.id ? 'on' : ''}`}
            onClick={() => setActiveDayId(d.id)}
            onLongPress={() => longPressDay(d.id, idx + 1)}
          >
            <Text className='itin-tab-no'>DAY {String(idx + 1).padStart(2, '0')}</Text>
            <Text className='itin-tab-date'>{dayjs(d.date).format('MM.DD')}</Text>
          </View>
        ))}
        <View className='itin-tab-add' onClick={addDay}>
          <Text className='itin-tab-no'>+</Text>
        </View>
      </ScrollView>

      {/* 当日 */}
      <DayHeader
        day={activeDay}
        onWeatherUpdate={w => dispatch({ type: 'UPDATE_DAY', dayId: activeDay.id, patch: { weather: w } })}
      />

      <View className='itin-spots'>
        {activeDay.spots.map(s => (
          <SpotCard key={s.id} spot={s} onClick={() => setEditSpot({ dayId: activeDay.id, spot: s })} />
        ))}
        {activeDay.spots.length === 0 && (
          <View className='itin-empty'>这一天还没有地点</View>
        )}
        <View className='itin-add-spot' onClick={() => setSearchOpen(true)}>
          + 添加地点
        </View>
      </View>

      <SpotSearch
        open={searchOpen}
        defaultCity={activeDay.spots[0]?.city}
        onClose={() => setSearchOpen(false)}
        onSelect={handleAddSpot}
      />

      <EditSpotSheet
        open={!!editSpot}
        spot={editSpot?.spot || null}
        defaultCity={activeDay.spots[0]?.city}
        onClose={() => setEditSpot(null)}
        onSave={patch => {
          if (!editSpot) return
          dispatch({ type: 'UPDATE_SPOT', dayId: editSpot.dayId, spotId: editSpot.spot.id, patch })
        }}
        onDelete={() => {
          if (!editSpot) return
          dispatch({ type: 'DELETE_SPOT', dayId: editSpot.dayId, spotId: editSpot.spot.id })
        }}
      />
    </View>
  )
}
```

- [ ] **Step 5.4:** `src/views/ItineraryView/index.scss`
```scss
.itinerary { padding: 16rpx 0 32rpx; }

.itin-tabs {
  display: flex; padding: 0 24rpx;
  white-space: nowrap;
  margin-bottom: 16rpx;
}
.itin-tab, .itin-tab-add {
  display: inline-flex; flex-direction: column;
  margin-right: 16rpx;
  padding: 12rpx 20rpx;
  border: 2rpx solid currentColor;
  border-radius: 12rpx;
  opacity: 0.55;
}
.itin-tab.on { opacity: 1; background: var(--ink); color: var(--bg); }
.itin-tab-no { font-size: 20rpx; letter-spacing: 4rpx; font-weight: 700; }
.itin-tab-date { font-size: 22rpx; margin-top: 4rpx; }

.itin-tab-add {
  align-items: center; justify-content: center;
  min-width: 64rpx;
}

.day-header {
  padding: 16rpx 32rpx 24rpx;
  border-bottom: 1rpx dashed rgba(0,0,0,0.1);
  position: relative;
}
.dh-cities {
  font-size: 28rpx;
  font-weight: 600;
}
.dh-arrow { font-size: 22rpx; opacity: 0.55; margin-left: 6rpx; }
.dh-weather {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  opacity: 0.6;
}
.dh-city-picker {
  position: absolute;
  background: var(--bg);
  border: 2rpx solid currentColor;
  border-radius: 12rpx;
  margin-top: 8rpx;
  padding: 12rpx 0;
  z-index: 10;
}
.dh-city-item {
  padding: 12rpx 24rpx;
  font-size: 26rpx;
}

.itin-spots {
  padding: 16rpx 32rpx 32rpx;
  display: flex; flex-direction: column;
  gap: 14rpx;
}

.spot-card {
  padding: 20rpx;
  border-left: 4rpx solid currentColor;
  background: rgba(255,255,255,0.3);
}
.sc-head { display: flex; align-items: center; }
.sc-icon { font-size: 28rpx; margin-right: 12rpx; }
.sc-time {
  font-size: 24rpx; font-weight: 600;
  margin-right: 16rpx; opacity: 0.75;
  min-width: 80rpx;
}
.sc-name { font-size: 28rpx; font-weight: 500; flex: 1; }
.sc-foot { margin-top: 8rpx; display: flex; justify-content: space-between; align-items: baseline; }
.sc-note { font-size: 24rpx; opacity: 0.7; flex: 1; }
.sc-price { font-size: 26rpx; font-weight: 600; }

.itin-empty {
  text-align: center;
  padding: 32rpx;
  opacity: 0.5;
  font-size: 24rpx;
}

.itin-add-spot {
  padding: 24rpx;
  text-align: center;
  border: 2rpx dashed currentColor;
  border-radius: 12rpx;
  font-size: 26rpx;
  opacity: 0.75;
}
```

- [ ] **Step 5.5:** 提交
```bash
git add src/views/ItineraryView/
git commit -m "feat(view): add ItineraryView with day tabs and spot timeline"
```

---

## Task 6: 创建 `pages/trip/index`（详情页 + 顶部 segmented tab 骨架）

**Files:**
- Create: `src/pages/trip/index.tsx`
- Create: `src/pages/trip/index.config.ts`
- Create: `src/pages/trip/index.scss`

- [ ] **Step 6.1:** `src/pages/trip/index.config.ts`
```ts
export default definePageConfig({
  navigationBarTitleText: '攻略',
  navigationBarBackgroundColor: '#f7f1e3',
  navigationBarTextStyle: 'black',
})
```

- [ ] **Step 6.2:** `src/pages/trip/index.tsx`
```tsx
import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { TripProvider, useTripStore } from '../../store/trip-store'
import ItineraryView from '../../views/ItineraryView'
import './index.scss'

type ViewKey = 'itinerary' | 'budget' | 'packing'

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'itinerary', label: '攻略' },
  { key: 'budget', label: '开销' },
  { key: 'packing', label: '清单' },
]

function TripBody() {
  const { state } = useTripStore()
  const [view, setView] = useState<ViewKey>('itinerary')

  if (state.loading) return <View className='trip-empty'>加载中...</View>
  if (state.error) return <View className='trip-empty'>{state.error}</View>
  if (!state.trip) return <View className='trip-empty'>未找到攻略</View>

  const t = state.trip
  return (
    <View className='trip theme-tegami'>
      <View className='trip-head'>
        <Text className='th-name'>{t.name}</Text>
        <Text className='th-meta'>
          {t.startDate} → {t.endDate} · {t.pax} 人
        </Text>
      </View>

      <View className='trip-tabs'>
        {VIEWS.map(v => (
          <View
            key={v.key}
            className={`tt-item ${view === v.key ? 'on' : ''}`}
            onClick={() => setView(v.key)}
          >{v.label}</View>
        ))}
      </View>

      <View className='trip-content'>
        {view === 'itinerary' && <ItineraryView />}
        {view === 'budget' && <View className='trip-empty'>开销 view 待 Phase 4</View>}
        {view === 'packing' && <View className='trip-empty'>清单 view 待 Phase 4</View>}
      </View>
    </View>
  )
}

export default function TripPage() {
  const router = useRouter()
  const tripId = router.params.id || ''
  const [openid, setOpenid] = useState('')

  useEffect(() => {
    // @ts-ignore Taro.cloud
    Taro.cloud.callFunction({
      name: 'ensure-user',
      data: { nickname: '行迹旅人', avatarUrl: '' }
    }).then((r: { result: { openid: string } }) => setOpenid(r.result.openid))
  }, [])

  if (!tripId) return <View className='trip-empty'>缺少 trip id</View>
  if (!openid) return <View className='trip-empty'>登录中...</View>

  return (
    <TripProvider tripId={tripId} openid={openid}>
      <TripBody />
    </TripProvider>
  )
}
```

- [ ] **Step 6.3:** `src/pages/trip/index.scss`
```scss
.trip {
  min-height: 100vh;
  padding: 0 0 32rpx;
  box-sizing: border-box;
}

.trip.theme-tegami {
  --bg: #f7f1e3;
  --ink: #2a2522;
  background: var(--bg);
  color: var(--ink);
}

.trip-empty {
  padding: 80rpx 32rpx;
  text-align: center;
  opacity: 0.55;
  font-size: 26rpx;
}

.trip-head {
  padding: 24rpx 32rpx 16rpx;
}
.th-name {
  font-size: 40rpx;
  font-weight: 600;
}
.th-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  opacity: 0.6;
}

.trip-tabs {
  display: flex;
  padding: 0 32rpx;
  margin: 16rpx 0 8rpx;
  border-bottom: 2rpx solid rgba(0,0,0,0.1);
}
.tt-item {
  padding: 16rpx 24rpx;
  font-size: 28rpx;
  opacity: 0.55;
  position: relative;
}
.tt-item.on {
  opacity: 1; font-weight: 600;
}
.tt-item.on::after {
  content: '';
  position: absolute;
  left: 24rpx; right: 24rpx; bottom: -2rpx;
  height: 4rpx;
  background: currentColor;
}

.trip-content {}
```

- [ ] **Step 6.4:** 提交
```bash
git add src/pages/trip/
git commit -m "feat(trip): add trip detail page with segmented tabs"
```

---

## Task 7: 注册 trip 页 + home 跳转

**Files:**
- Modify: `src/app.config.ts`
- Modify: `src/pages/home/index.tsx`

- [ ] **Step 7.1:** 更新 `src/app.config.ts`
```ts
export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/new-trip/index',
    'pages/trip/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f7f1e3',
    navigationBarTitleText: '行迹',
    navigationBarTextStyle: 'black',
  },
  lazyCodeLoading: 'requiredComponents',
})
```

- [ ] **Step 7.2:** 修改 `src/pages/home/index.tsx`，把卡片点击 toast 改成 navigateTo

找到这段：
```tsx
onClick={() => Taro.showToast({ title: '详情页待 Phase 3', icon: 'none' })}
```

替换为：
```tsx
onClick={() => Taro.navigateTo({ url: `/pages/trip/index?id=${t._id}` })}
```

也修改新建攻略成功后的跳转（new-trip 页 submit 函数末尾）：

找到：
```tsx
Taro.showToast({ title: '已创建', icon: 'success' })
setTimeout(() => Taro.navigateBack(), 600)
```

替换为：
```tsx
const tripId = await createTrip(input)
Taro.showToast({ title: '已创建', icon: 'success' })
setTimeout(() => Taro.redirectTo({ url: `/pages/trip/index?id=${tripId}` }), 600)
```

（注意 `createTrip` 已返回 newId，但变量名在你 Phase 2 实现里也许叫别的——按实际改）

- [ ] **Step 7.3:** 类型检查
```bash
npx tsc --noEmit
```

- [ ] **Step 7.4:** 提交
```bash
git add src/app.config.ts src/pages/home/index.tsx src/pages/new-trip/index.tsx
git commit -m "feat: wire home and new-trip to trip detail page"
```

---

## Task 8: 端到端验证

**Files:** 无；纯手动。

- [ ] **Step 8.1:** 编译，从 home 点新建攻略 → 输入名/日期/目的地（南京）/人数 → 创建

- [ ] **Step 8.2:** 自动跳到 trip?id=xxx 详情页。看到：
- 标题 + 日期范围
- 顶部三段 tab（攻略 当前选中 / 开销 / 清单 后两个显示占位）
- day tabs（按日期数生成的）+ 末尾 [+] 加天
- 当日 city 标签（首次空，因为还没加 spot）
- "这一天还没有地点" 提示
- 底部 [+ 添加地点]

- [ ] **Step 8.3:** 点 [+ 添加地点] → SpotSearch 半屏弹起 → 搜"南京南站" → 点结果 → spot 落到列表

- [ ] **Step 8.4:** 点 spot 卡片 → EditSpotSheet 弹起 → 改时间为 14:30 → 改类型为 transport → 填备注"G23 高铁" → 保存

- [ ] **Step 8.5:** 看到 spot 卡片左边图标变了（🚄），时间和备注显示

- [ ] **Step 8.6:** 加更多 spot，包括跨城市的（搜"苏州博物馆"）→ DayHeader 城市变成 "南京 → 苏州"

- [ ] **Step 8.7:** 点 city 标签 → 下拉切换显示哪个城市的天气

- [ ] **Step 8.8:** 长按 day tab → modal 确认 → 删除一天

- [ ] **Step 8.9:** 点 [+] → 末尾追加一天，date 自动 +1

- [ ] **Step 8.10:** **L1 同步测试**：用两个微信开发者工具实例打开同一个 trip（手动复制 URL `/pages/trip/index?id=xxx`），在 A 改 spot 名 → B 几秒内看到改动 + toast "已同步协作者改动"

- [ ] **Step 8.11:** 编辑 spot 后立刻关掉微信开发者工具，重启再开 → 修改已持久化（debounce 写云成功）

- [ ] **Step 8.12:** 提交
```bash
git status
# 如有杂项 chore 改动：
git add -A && git commit -m "chore(phase3): verification passed"
```

---

## 9. Phase 3 验收

- 9.1 ✅ 详情页路由 `/pages/trip/index?id=xxx` 能正常加载并显示 trip 内容
- 9.2 ✅ 顶部 segmented 3 段切换正常（其它 2 段是占位）
- 9.3 ✅ day tabs 能加（[+]）能删（长按）
- 9.4 ✅ 添加 spot：搜得到 → 落到列表；搜不到 → 手动添加也落到列表
- 9.5 ✅ 编辑 spot：所有字段可改，type 切换正确显示额外字段，价格/备注空白可保存
- 9.6 ✅ 删除 spot：EditSpotSheet 底部红色删除按钮可用
- 9.7 ✅ 天气：默认显示第一个 city，下拉可切换其它 city
- 9.8 ✅ 数据保存：500ms 内自动写云数据库；刷新页面数据未丢失
- 9.9 ✅ db.watch 协作同步：两个实例编辑能互相看到改动（< 3 秒）
- 9.10 ✅ TypeScript 无 error

全部 ✅ 后进入 Phase 4。
