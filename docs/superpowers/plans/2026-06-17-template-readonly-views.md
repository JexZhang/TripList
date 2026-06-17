# 模板只读页复用真实视图 + 复制 Bug 修复 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 模板只读页复用真实四视图（ItineraryView / MapView / BudgetView / PackingView），并修复 clone-template / clone-trip 云函数 `_openid` 缺失导致复制后攻略消失的 bug。

**Architecture:** TripProvider 增加 `initialTrip` + `readonly` 可选参数；readonly 模式下跳过拉取/watch/保存，dispatch no-op，context 暴露 `readonly` 布尔值。四个视图读 `readonly` 条件渲染交互弹层 + `.is-ro` CSS 隐藏编辑按钮。模板页删除简化版组件，用 `<TripProvider initialTrip={templateAsTrip(tpl)} readonly>` 包裹真实视图。

**Tech Stack:** Taro + React + TypeScript + 微信云开发

**Spec:** `docs/superpowers/specs/2026-06-17-template-readonly-views-design.md`

---

### Task 1: TripProvider 增加 readonly 支持

**Files:**
- Modify: `src/store/trip-store.tsx`

- [ ] **Step 1: 修改 ContextValue 接口和 TripProvider 签名**

在 `src/store/trip-store.tsx` 中：

1. `ContextValue` 接口加 `readonly: boolean` 字段
2. `TripProvider` 参数从 `{ tripId, openid, children }` 改为 `{ tripId?, openid, children, initialTrip?, readonly? }`
3. `useReducer` 初始值：传 `initialTrip` 时 `{ trip: initialTrip, loading: false, error: null }`，否则 `{ trip: null, loading: true, error: null }`

```ts
interface ContextValue {
  state: State
  dispatch: React.Dispatch<Action>
  openid: string
  readonly: boolean
}
```

```ts
export function TripProvider({
  tripId, openid, children, initialTrip, readonly: ro = false,
}: {
  tripId?: string
  openid: string
  children: ReactNode
  initialTrip?: Trip
  readonly?: boolean
}) {
  const [state, rawDispatch] = useReducer(reducer, {
    trip: initialTrip ?? null,
    loading: !initialTrip,
    error: null,
  })
```

- [ ] **Step 2: 包裹 dispatch，readonly 时 no-op**

在 `useReducer` 之后添加：

```ts
  const dispatch: React.Dispatch<Action> = ro
    ? () => { /* readonly: no-op */ }
    : rawDispatch
```

- [ ] **Step 3: 条件化初次拉取 + watch effect**

将现有的「初次拉 + watch 订阅」effect（约 L150-185）用 `if (!ro && tripId)` 守卫：

```ts
  useEffect(() => {
    if (ro || !tripId) return
    let watcher: { close: () => void } | null = null
    // ... 原有 getTrip + watch 逻辑不变 ...
    return () => { watcher?.close() }
  }, [tripId, openid, ro])
```

- [ ] **Step 4: 条件化防抖保存 effect**

将现有的防抖保存 effect（约 L188-238）用 `if (ro)` 守卫：

```ts
  useEffect(() => {
    if (ro) return
    if (!state.trip || state.loading) return
    // ... 原有 debounce 保存逻辑不变 ...
  }, [state.trip, state.loading, openid, ro])
```

- [ ] **Step 5: 更新 context value**

```ts
  const value = useMemo(() => ({ state, dispatch, openid, readonly: ro }), [state, openid, ro])
```

- [ ] **Step 6: 编译验证**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 7: Commit**

```bash
git add src/store/trip-store.tsx
git commit -m "feat(trip-store): add initialTrip + readonly support to TripProvider"
```

---

### Task 2: ItineraryView 只读适配

**Files:**
- Modify: `src/views/ItineraryView/index.tsx`
- Modify: `src/views/ItineraryView/index.scss`

- [ ] **Step 1: index.tsx 加 readonly 条件渲染**

在 `ItineraryView` 组件中：

1. 从 `useTripStore()` 取 `readonly`
2. 根节点加 `is-ro` 类
3. 只读时不渲染 `SpotSearch` 和 `EditSpotSheet`
4. 只读时 `onAddSpot` 和 `onAddDay` 传 no-op
5. 只读时 `onSpotClick` 传 no-op（不弹编辑）
6. 只读时 `onLongPressDay` 传 no-op（不弹操作菜单）

```tsx
export default function ItineraryView() {
  const { state, dispatch, readonly: ro } = useTripStore()
  const trip = state.trip!
  const { theme } = useTheme()
  const [activeDayId, setActiveDayId] = useState<string>(trip.days[0]?.id || '')
  const [searchOpen, setSearchOpen] = useState(false)
  const [editSpot, setEditSpot] = useState<{ dayId: string; spot: Spot } | null>(null)

  // ... activeDayIdx, activeDay 不变 ...

  // addDay, longPressDay, handleAddSpot 不变

  const noop = () => {}

  const viewProps: ItinViewProps = {
    trip,
    activeDay,
    activeDayIdx,
    fallbackDestination: trip.destinations?.[0] || null,
    onSelectDay: setActiveDayId,
    onLongPressDay: ro ? noop : longPressDay,
    onAddDay: ro ? noop : addDay,
    onSpotClick: ro ? noop : (s) => setEditSpot({ dayId: activeDay.id, spot: s }),
    onAddSpot: ro ? noop : () => setSearchOpen(true),
    onWeatherUpdate: ro ? noop : (w) => dispatch({ type: 'UPDATE_DAY', dayId: activeDay.id, patch: { weather: w } }),
  }

  return (
    <View className={`itinerary${ro ? ' is-ro' : ''}`}>
      <DayTabs
        days={trip.days}
        activeId={activeDayId}
        onSelect={setActiveDayId}
        onLongPress={ro ? noop : longPressDay}
        onAdd={ro ? noop : addDay}
      />

      {theme === 'tegami'   && <ItinTegami   {...viewProps} />}
      {theme === 'magazine' && <ItinMagazine {...viewProps} />}
      {theme === 'postcard' && <ItinPostcard {...viewProps} />}
      {theme === 'minimal'  && <ItinMinimal  {...viewProps} />}

      {!ro && (
        <SpotSearch
          open={searchOpen}
          defaultCity={activeDay.spots[0]?.city || trip.destinations?.[0]?.name}
          onClose={() => setSearchOpen(false)}
          onSelect={handleAddSpot}
        />
      )}
      {!ro && (
        <EditSpotSheet
          open={!!editSpot}
          spot={editSpot?.spot || null}
          defaultCity={activeDay.spots[0]?.city || trip.destinations?.[0]?.name}
          onClose={() => setEditSpot(null)}
          onSave={(patch) => {
            if (!editSpot) return
            dispatch({ type: 'UPDATE_SPOT', dayId: editSpot.dayId, spotId: editSpot.spot.id, patch })
          }}
          onDelete={() => {
            if (!editSpot) return
            dispatch({ type: 'DELETE_SPOT', dayId: editSpot.dayId, spotId: editSpot.spot.id })
          }}
        />
      )}
    </View>
  )
}
```

- [ ] **Step 2: index.scss 末尾追加 `.is-ro` 规则**

```scss
/* ===== 只读模式 ===== */
.is-ro {
  .dt-add { display: none !important; }
  .itintg-add,
  .itinmg-add,
  .itinpp-add,
  .itinmin-add { display: none !important; }
}
```

- [ ] **Step 3: 编译验证**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add src/views/ItineraryView/index.tsx src/views/ItineraryView/index.scss
git commit -m "feat(itinerary): add readonly mode support"
```

---

### Task 3: MapView 只读适配

**Files:**
- Modify: `src/views/MapView/index.tsx`
- Modify: `src/views/MapView/index.scss`

- [ ] **Step 1: index.tsx 加 readonly 条件渲染**

在 `MapView` 组件中：

1. 从 `useTripStore()` 取 `readonly`
2. 根节点加 `is-ro` 类
3. 只读时不渲染 `SheetContainer`
4. 只读时不渲染「回到我的位置」按钮

```tsx
export default function MapView() {
  const { state, readonly: ro } = useTripStore()
  // ... 其余不变 ...

  return (
    <View className={`mv${ro ? ' is-ro' : ''}`}>
      <ModeBar
        days={trip.days}
        mode={mode}
        variant={variant}
        onChange={setMode}
      />
      <View className='mv-map-wrap'>
        <Map
          id={MAP_ID}
          className='mv-map'
          latitude={viewport.latitude}
          longitude={viewport.longitude}
          scale={viewport.scale}
          markers={markers as any}
          polyline={polyline as any}
          onMarkerTap={ro ? () => {} : handleTap}
          onCalloutTap={ro ? () => {} : handleTap}
          onRegionChange={handleRegionChange}
          onError={() => {}}
          showLocation={false}
          enableTraffic={false}
        />
        {!ro && (
          <View className='mv-locate-btn' onClick={handleLocateMe}>
            <View className='mv-locate-ring'>
              <View className='mv-locate-dot' />
            </View>
          </View>
        )}
      </View>
      {!ro && <SheetContainer ref={sheetRef} />}
    </View>
  )
}
```

注意：`showLocation` 在只读时改为 `false`（隐藏蓝色定位圆点）。

- [ ] **Step 2: index.scss 末尾追加 `.is-ro` 规则**

```scss
/* ===== 只读模式 ===== */
.is-ro {
  .mv-locate-btn { display: none !important; }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/MapView/index.tsx src/views/MapView/index.scss
git commit -m "feat(map): add readonly mode support"
```

---

### Task 4: BudgetView 只读适配

**Files:**
- Modify: `src/views/BudgetView/index.tsx`

- [ ] **Step 1: index.tsx 加 readonly 条件渲染**

在 `BudgetView` 组件中：

1. 从 `useTripStore()` 取 `readonly`
2. 只读时不渲染 `EditSpotSheet`
3. 只读时「最贵一笔」和分类明细行不绑定 `onClick`

```tsx
export default function BudgetView() {
  const { state, dispatch, readonly: ro } = useTripStore()
  const trip = state.trip!
  const [editSpot, setEditSpot] = useState<{ dayId: string; spot: Spot } | null>(null)

  const { buckets, total, perPax, daily, expensive } = aggregateBudget(trip)
  const conic = conicFromBuckets(buckets)
  const hotelPct = buckets.find((b) => b.type === 'hotel')?.pct || 0

  return (
    <ScrollView scrollY className='bv'>
      {/* 1-3 不变 */}

      {/* 4. 最贵一笔：只读时不响应点击 */}
      {expensive && (
        <View
          className='bv-expensive'
          onClick={ro ? undefined : () => setEditSpot({ dayId: expensive.dayId, spot: expensive.spot })}
        >
          {/* 内容不变 */}
        </View>
      )}

      {/* 5. 分类明细：只读时不响应点击 */}
      <View className='bv-details'>
        {buckets.map((b) => {
          // ... items 不变 ...
          return (
            <View key={b.type} className='bv-detail-group'>
              {/* head 不变 */}
              {items.map(({ dayId, spot }) => (
                <View
                  key={spot.id}
                  className='bv-detail-row'
                  onClick={ro ? undefined : () => setEditSpot({ dayId, spot })}
                >
                  <Text className='bv-detail-name'>{spot.name}</Text>
                  <Text className='bv-detail-price'>{fmtCurrency(spot.price || 0)}</Text>
                </View>
              ))}
            </View>
          )
        })}
      </View>

      {!ro && (
        <EditSpotSheet
          open={!!editSpot}
          spot={editSpot?.spot || null}
          defaultCity={editSpot?.spot.city || trip.destinations?.[0]?.name}
          onClose={() => setEditSpot(null)}
          onSave={(patch) => {
            if (!editSpot) return
            dispatch({ type: 'UPDATE_SPOT', dayId: editSpot.dayId, spotId: editSpot.spot.id, patch })
          }}
          onDelete={() => {
            if (!editSpot) return
            dispatch({ type: 'DELETE_SPOT', dayId: editSpot.dayId, spotId: editSpot.spot.id })
          }}
        />
      )}
    </ScrollView>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/BudgetView/index.tsx
git commit -m "feat(budget): add readonly mode support"
```

---

### Task 5: PackingView 只读适配

**Files:**
- Modify: `src/views/PackingView/index.tsx`
- Modify: `src/views/PackingView/index.scss`

- [ ] **Step 1: index.tsx 加 readonly 条件渲染**

在 `PackingView` 组件中：

1. 从 `useTripStore()` 取 `readonly`
2. 根节点加 `is-ro` 类
3. 只读时不渲染 `TemplateImport`
4. 只读时 props 中 `onAdd` / `onRemove` 传 no-op，`onDraftChange` 传 no-op

```tsx
export default function PackingView() {
  const { state, dispatch, readonly: ro } = useTripStore()
  const trip = state.trip!
  const { theme } = useTheme()
  const [draftByCat, setDraftByCat] = useState<Record<string, string>>({})
  const [tplOpen, setTplOpen] = useState(false)

  const setPacking = (next: PackingItem[]) =>
    dispatch({ type: 'UPDATE_TRIP', patch: { packing: next } })

  const noop = () => {}

  const toggle = ro ? noop : (id: string) => {
    setPacking(trip.packing.map((p) => p.id === id ? { ...p, checked: !p.checked } : p))
  }
  const remove = ro ? noop : async (id: string) => {
    const res = await Taro.showModal({ title: '删除该项？', confirmText: '删除', confirmColor: '#c43d3d' })
    if (res.confirm) setPacking(trip.packing.filter((p) => p.id !== id))
  }
  const add = ro ? noop : (catId: string) => {
    const label = (draftByCat[catId] || '').trim()
    if (!label) return
    setPacking([...trip.packing, { id: uid(), category: catId, label, checked: false }])
    setDraftByCat({ ...draftByCat, [catId]: '' })
  }
  const onImport = ro ? noop : (items: PackingItem[]) => {
    // ... 原有逻辑不变 ...
  }

  const checkedCount = trip.packing.filter((p) => p.checked).length

  const props: PackViewProps = {
    categories: PACKING_CATEGORIES,
    packing: trip.packing,
    draftByCat: ro ? {} : draftByCat,
    checkedCount,
    onDraftChange: ro ? noop : (catId, value) => setDraftByCat({ ...draftByCat, [catId]: value }),
    onAdd: add,
    onToggle: toggle,
    onRemove: remove,
    onOpenTemplate: ro ? noop : () => setTplOpen(true),
  }

  return (
    <View className={`packing${ro ? ' is-ro' : ''}`}>
      {theme === 'tegami'   && <PackTegami   {...props} />}
      {theme === 'magazine' && <PackMagazine {...props} />}
      {theme === 'postcard' && <PackPostcard {...props} />}
      {theme === 'minimal'  && <PackMinimal  {...props} />}

      {!ro && <TemplateImport open={tplOpen} onClose={() => setTplOpen(false)} onImport={onImport} />}
    </View>
  )
}
```

- [ ] **Step 2: index.scss 追加 `.is-ro` 规则**

```scss
/* ===== 只读模式 ===== */
.is-ro {
  .ptg-add-row,
  .ptg-add-btn,
  .pmg-add,
  .ppp-add,
  .ppp-add-btn,
  .pmin-add,
  .pmin-box--add { display: none !important; }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/PackingView/index.tsx src/views/PackingView/index.scss
git commit -m "feat(packing): add readonly mode support"
```

---

### Task 6: 模板页集成 — 用真实视图替换简化版

**Files:**
- Modify: `src/pages/template/index.tsx`
- Modify: `src/pages/template/index.scss`

- [ ] **Step 1: 重写 index.tsx imports 和 templateAsTrip 函数**

替换文件头部 imports：

```tsx
import { useEffect, useMemo, useState } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import dayjs from 'dayjs'
import type { Template } from '../../types/template'
import type { Trip } from '../../types/trip'
import { getTemplate, cloneTemplate } from '../../utils/templates'
import { TripProvider } from '../../store/trip-store'
import { useMe } from '../../store/me-store'
import { useThemeClass } from '../../utils/theme-class'
import Icon, { type IconName } from '../../components/Icon'
import ItineraryView from '../../views/ItineraryView'
import MapView from '../../views/MapView'
import BudgetView from '../../views/BudgetView'
import PackingView from '../../views/PackingView'
import './index.scss'

type Tab = 'itinerary' | 'map' | 'budget' | 'packing'
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'itinerary', label: '行程', icon: 'itinerary' },
  { key: 'map', label: '地图', icon: 'map' },
  { key: 'budget', label: '开销', icon: 'budget' },
  { key: 'packing', label: '清单', icon: 'packing' },
]

function nightsLabel(dayCount: number): string {
  const nights = Math.max(0, dayCount - 1)
  return `${dayCount}天${nights}晚`
}

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

- [ ] **Step 2: 重写 TemplatePage 组件**

保留现有壳（顶栏 + hero + tabs + CTA + 复制 sheet），tab 内容区换成真实视图：

```tsx
export default function TemplatePage() {
  const themeCls = useThemeClass()
  const router = useRouter()
  const id = router.params.id || ''
  const { me } = useMe()
  const openid = me?.openid || ''
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

  if (!openid) {
    return <View className={`${themeCls} tpl-state`}><Text>登录中…</Text></View>
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

  const tripData = templateAsTrip(tpl)

  return (
    <TripProvider initialTrip={tripData} readonly openid={openid}>
      <View className={`${themeCls} tpl`}>
        <View className='tpl-top'>
          <View className='tpl-back' onClick={() => Taro.navigateBack().catch(() => Taro.reLaunch({ url: '/pages/library/index' }))}>
            <Icon name='arrow-left' size={22} />
          </View>
          <View className='tpl-readonly'>
            <Icon name='lock' size={14} color='var(--accent)' />
            <Text className='tpl-readonly-t'>样板 · 只读</Text>
          </View>
        </View>

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

        <View className='tpl-tabs'>
          {TABS.map((tb) => (
            <View key={tb.key} className={`tpl-tab ${tab === tb.key ? 'on' : ''}`} onClick={() => setTab(tb.key)}>
              <Icon name={tb.icon} size={20} color={tab === tb.key ? 'var(--accent)' : 'var(--ink-3)'} />
              <Text className='tpl-tab-l'>{tb.label}</Text>
            </View>
          ))}
        </View>

        <View className='tpl-body'>
          {tab === 'itinerary' && <ItineraryView />}
          {tab === 'map' && <MapView />}
          {tab === 'budget' && <BudgetView />}
          {tab === 'packing' && <PackingView />}
        </View>

        <View className='tpl-cta'>
          <View className='tpl-cta-hint'><Icon name='lock' size={13} color='var(--ink-3)' /><Text>模板只读,复制后可自由编辑</Text></View>
          <View className='tpl-cta-btn' onClick={() => setCopyOpen(true)}>
            <Icon name='plus' size={18} color='#fff' /><Text>复制到我的行程</Text>
          </View>
        </View>

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
    </TripProvider>
  )
}
```

注意：删除了文件底部的 `TemplateMap`、`TemplateBudget`、`TemplatePacking` 三个内联函数。

- [ ] **Step 3: 清理 index.scss**

删除以下简化版样式（L26-L52）：
- `.tpl-day`, `.tpl-day-no`, `.tpl-day-empty`
- `.tpl-spot`, `.tpl-spot-time`, `.tpl-spot-name`, `.tpl-spot-price`
- `.tpl-map-wrap`, `.tpl-map`, `.tpl-map-empty`
- `.tpl-bud-head` 到 `.tpl-bud-v` 全部
- `.tpl-pack-group` 到 `.tpl-pack-label` 全部
- `.tpl-pack-empty`

修改 `.tpl-body`（L23）：

```scss
.tpl-body { flex: 1; overflow: hidden; }
```

删除 `.tpl-body-pad`（L24）。

保留的样式不动：`.tpl`, `.tpl-state*`, `.tpl-top`, `.tpl-readonly*`, `.tpl-hero`, `.tpl-name`, `.tpl-meta*`, `.tpl-tags`, `.tpl-tag`, `.tpl-tabs`, `.tpl-tab*`, `.tpl-cta*`, `.tpl-sheet*`

- [ ] **Step 4: 编译验证**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add src/pages/template/index.tsx src/pages/template/index.scss
git commit -m "feat(template): use real views with TripProvider readonly mode"
```

---

### Task 7: 云函数 Bug 修复 — clone-template / clone-trip 补 `_openid`

**Files:**
- Modify: `cloudfunctions/clone-template/index.js`
- Modify: `cloudfunctions/clone-trip/index.js`

- [ ] **Step 1: 修复 clone-template**

在 `cloudfunctions/clone-template/index.js` 的 `db.collection(TRIPS).add()` data 中添加 `_openid: OPENID`：

```js
  const created = await db.collection(TRIPS).add({
    data: {
      _openid: OPENID,
      ...rest,
      days,
      startDate: s,
      endDate,
      ownerOpenid: OPENID,
      ownerNickname: me.nickname || '行册旅人',
      ownerAvatarUrl: me.avatarUrl || '',
      collaborators: [],
      collaboratorOpenids: [],
      createdAt: now,
      updatedAt: now,
      updatedBy: OPENID,
    },
  })
```

- [ ] **Step 2: 修复 clone-trip**

在 `cloudfunctions/clone-trip/index.js` 的 `db.collection('trips').add()` data 中添加 `_openid: OPENID`：

```js
  const created = await db.collection('trips').add({
    data: {
      _openid: OPENID,
      ...rest,
      ownerOpenid: OPENID,
      ownerNickname: me.nickname || '行册旅人',
      ownerAvatarUrl: me.avatarUrl || '',
      collaborators: [],
      collaboratorOpenids: [],
      createdAt: now,
      updatedAt: now,
      updatedBy: OPENID,
    }
  })
```

- [ ] **Step 3: Commit**

```bash
git add cloudfunctions/clone-template/index.js cloudfunctions/clone-trip/index.js
git commit -m "fix: add _openid to clone-template and clone-trip cloud functions"
```

---

### Task 8: 全量编译验证

- [ ] **Step 1: TypeScript 编译检查**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 2: Taro 开发环境编译**

Run: `npm run dev:weapp`
Expected: 编译成功，无报错

- [ ] **Step 3: 手动验证清单**

1. 打开真实攻略页 → 功能不受影响（编辑、添加、删除正常）
2. 打开模板页 → 四个 tab 展示真实视图，无编辑入口
3. 模板页点「复制到我的行程」→ 攻略出现在首页列表
4. 模板页内容不超出屏幕宽度

- [ ] **Step 4: 最终 Commit（如有修复）**

```bash
git add -A
git commit -m "fix: address issues found during verification"
```
