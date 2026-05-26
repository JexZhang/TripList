# Phase 4b · ItineraryView 四主题 + DayTabs 四 variant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ItineraryView 每日切换条（顶部 DayTabs）按四主题各做一套版式（ticket/spine/calendar/simple）；当日主体（DayHeader + spot list）按四主题各做一套版式。保留长按/前后加日期/spot CRUD 全部行为。

**Architecture:** 抽 `<DayTabs/>` 组件含 4 variant 子组件，由 `useTheme()` 自动选 variant。主体 `<ItineraryView/>` 拆 4 个子组件（`ItinTegami / Magazine / Postcard / Minimal`）共用 props，由 theme dispatch。

**Tech Stack:** Taro 4.x React + TypeScript + SCSS

**Spec:** [docs/superpowers/specs/2026-05-26-design-system-application-design.md](../specs/2026-05-26-design-system-application-design.md) § 7.3

**Prerequisite:** Phase 4a 合并；Phase 4e 建议先于 4b 完成（不强制依赖）

**Scope：**
- 改：ItineraryView 顶部 DayTabs + 主体每日卡片
- 不改：SpotSearch / EditSpotSheet / DayHeader 内部（city/weather 逻辑）；Trip header 已在 4a 完成

**Testing reality:** 微信开发者工具冒烟，不跑 H5。

---

## File Structure

### 新增

| 路径 | 责任 |
| --- | --- |
| `src/views/ItineraryView/DayTabs.tsx` | DayTabs dispatcher（按 theme 选 variant） |
| `src/views/ItineraryView/DayTabsTicket.tsx` | 票根撕口式（tegami） |
| `src/views/ItineraryView/DayTabsSpine.tsx` | 时间轴脊柱（magazine） |
| `src/views/ItineraryView/DayTabsCalendar.tsx` | 日历方块（postcard） |
| `src/views/ItineraryView/DayTabsSimple.tsx` | 极简文字（minimal） |
| `src/views/ItineraryView/variants.ts` | `DAYTAB_VARIANT: ThemeName → DayTabVariant` 映射 |
| `src/views/ItineraryView/ItinTegami.tsx` | 主体 · 手帖 |
| `src/views/ItineraryView/ItinMagazine.tsx` | 主体 · 刊物 |
| `src/views/ItineraryView/ItinPostcard.tsx` | 主体 · 护照 |
| `src/views/ItineraryView/ItinMinimal.tsx` | 主体 · 极简 |
| `src/views/ItineraryView/shared.ts` | 共用 props（trip / activeDay / spot CRUD 回调） |
| `src/views/ItineraryView/styles/daytabs.scss` | 4 variant 样式 |
| `src/views/ItineraryView/styles/body-tegami.scss` | 主体样式 4 套 |
| `src/views/ItineraryView/styles/body-magazine.scss` | … |
| `src/views/ItineraryView/styles/body-postcard.scss` | … |
| `src/views/ItineraryView/styles/body-minimal.scss` | … |

### 修改

| 路径 | 改动 |
| --- | --- |
| `src/views/ItineraryView/index.tsx` | 改为 thin dispatcher：保留 state + CRUD 逻辑，渲染按 theme 选子组件 |
| `src/views/ItineraryView/index.scss` | 减薄；删除 `.itin-tab*` / `.itin-spots / .itin-empty / .itin-add-spot` 等被子组件接管的选择器 |

---

## Task 0: 基线

- [ ] **Step 1: Phase 4a 已合并**
Run: `git status && git log --oneline -5`

- [ ] **Step 2: dev:weapp 启动**
进 trip 页 → itinerary tab → 正常显示

---

## Task 1: 共用类型 + variant 映射

**Files:**
- Create: `src/views/ItineraryView/shared.ts`
- Create: `src/views/ItineraryView/variants.ts`

- [ ] **Step 1: shared.ts**

```typescript
import type { Day, Spot, Trip, Destination } from '../../types/trip'

export interface ItinViewProps {
  trip: Trip
  activeDay: Day
  activeDayIdx: number
  fallbackDestination: Destination | null
  onSelectDay: (dayId: string) => void
  onLongPressDay: (dayId: string, dayIdx: number) => void
  onAddDay: (position: 'front' | 'back') => void
  onSpotClick: (spot: Spot) => void
  onAddSpot: () => void
  onWeatherUpdate: (w: Day['weather']) => void
}
```

- [ ] **Step 2: variants.ts**

```typescript
import type { ThemeName } from '../../store/theme-store'

export type DayTabVariant = 'ticket' | 'spine' | 'calendar' | 'simple'

export const DAYTAB_VARIANT: Record<ThemeName, DayTabVariant> = {
  tegami:   'ticket',
  magazine: 'spine',
  postcard: 'calendar',
  minimal:  'simple',
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/ItineraryView/shared.ts src/views/ItineraryView/variants.ts
git commit -m "feat(itin): 共用 props 类型 + DayTabs variant 映射"
```

---

## Task 2: DayTabsTicket（tegami · 票根撕口式）

**Files:**
- Create: `src/views/ItineraryView/DayTabsTicket.tsx`
- Create: `src/views/ItineraryView/styles/daytabs.scss`（含全部 4 variant 样式）

> 当前 itin-tab 在 index.tsx 已是这个形态；本 Task 把它独立成组件 + 抽 SCSS。

- [ ] **Step 1: 组件**

Create `src/views/ItineraryView/DayTabsTicket.tsx`：

```typescript
import { ScrollView, View, Text } from '@tarojs/components'
import dayjs from 'dayjs'
import type { Day } from '../../types/trip'

interface Props {
  days: Day[]
  activeId: string
  onSelect: (id: string) => void
  onLongPress: (id: string, idx: number) => void
  onAdd: (pos: 'front' | 'back') => void
}

export default function DayTabsTicket({ days, activeId, onSelect, onLongPress, onAdd }: Props) {
  return (
    <ScrollView scrollX className='dt dt--ticket'>
      <View className='dt-add dt-add--front' onClick={() => onAdd('front')}>
        <Text>+</Text>
      </View>
      {days.map((d, idx) => (
        <View
          key={d.id}
          className={`dt-item dt-item--ticket ${activeId === d.id ? 'on' : ''}`}
          onClick={() => onSelect(d.id)}
          onLongPress={() => onLongPress(d.id, idx)}
        >
          <Text className='dt-month'>{dayjs(d.date).format('MMM').toUpperCase()}</Text>
          <Text className='dt-bigday'>{dayjs(d.date).format('D')}</Text>
          <Text className='dt-no'>{String(idx + 1).padStart(2, '0')}</Text>
          <View className='dt-sep' />
          <Text className='dt-date'>{dayjs(d.date).format('M/D')}</Text>
          <Text className='dt-label'>Day {idx + 1}</Text>
          <View className='dt-notch dt-notch--t' />
          <View className='dt-notch dt-notch--b' />
        </View>
      ))}
      <View className='dt-add' onClick={() => onAdd('back')}>
        <Text>+</Text>
      </View>
    </ScrollView>
  )
}
```

- [ ] **Step 2: 创建 daytabs.scss（先填 ticket，其他 variant 在后续 Task 追加）**

Create `src/views/ItineraryView/styles/daytabs.scss`：

```scss
/* 通用容器 */
.dt {
  display: flex;
  gap: 12rpx;
  padding: 16rpx 24rpx;
  background: var(--surface);
  white-space: nowrap;
  border-bottom: 1rpx solid var(--line);
}
.dt-item {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.22s var(--ease-out);
}
.dt-item:active { transform: scale(0.96); }
.dt-add {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  border-radius: var(--r-sm);
  background: var(--accent-bg);
  color: var(--accent);
  font-size: 32rpx;
}

/* ============ A. ticket（票根撕口） ============ */
.dt--ticket .dt-item--ticket {
  flex-direction: column;
  padding: 12rpx 20rpx;
  min-width: 120rpx;
  background: var(--surface-2);
  border: 1rpx dashed var(--line-2);
  border-radius: var(--r-sm);
}
.dt--ticket .dt-item--ticket.on {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.dt-month {
  font-size: 18rpx;
  letter-spacing: 4rpx;
  font-family: var(--font-mono);
  opacity: 0.7;
}
.dt-bigday {
  font-size: 42rpx;
  font-weight: 800;
  font-family: var(--font-display);
  line-height: 1;
  margin: 2rpx 0;
}
.dt-no {
  font-size: 16rpx;
  font-family: var(--font-mono);
  opacity: 0.6;
}
.dt-sep, .dt-date, .dt-label { display: none; }
.dt-notch {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 12rpx;
  height: 8rpx;
  background: var(--surface);
  border-radius: 50%;
}
.dt-notch--t { top: -4rpx; }
.dt-notch--b { bottom: -4rpx; }
```

- [ ] **Step 3: Commit**

```bash
git add src/views/ItineraryView/DayTabsTicket.tsx src/views/ItineraryView/styles/daytabs.scss
git commit -m "feat(itin): DayTabsTicket 票根撕口"
```

---

## Task 3: DayTabsSpine（magazine · 时间轴脊柱）

**Files:**
- Create: `src/views/ItineraryView/DayTabsSpine.tsx`
- Modify: `src/views/ItineraryView/styles/daytabs.scss`（追加 spine）

- [ ] **Step 1: 组件**

Create `src/views/ItineraryView/DayTabsSpine.tsx`：

```typescript
import { ScrollView, View, Text } from '@tarojs/components'
import dayjs from 'dayjs'
import type { Day } from '../../types/trip'

interface Props {
  days: Day[]
  activeId: string
  onSelect: (id: string) => void
  onLongPress: (id: string, idx: number) => void
  onAdd: (pos: 'front' | 'back') => void
}

export default function DayTabsSpine({ days, activeId, onSelect, onLongPress, onAdd }: Props) {
  return (
    <View className='dt-spine-wrap'>
      <ScrollView scrollX className='dt dt--spine'>
        {days.map((d, idx) => (
          <View
            key={d.id}
            className={`dt-item dt-item--spine ${activeId === d.id ? 'on' : ''}`}
            onClick={() => onSelect(d.id)}
            onLongPress={() => onLongPress(d.id, idx)}
          >
            <View className='dt-spine-dot' />
            <Text className='dt-spine-no'>D{idx + 1}</Text>
            <Text className='dt-spine-date'>{dayjs(d.date).format('M/D')}</Text>
          </View>
        ))}
        <View className='dt-add' onClick={() => onAdd('back')}>
          <Text>+</Text>
        </View>
      </ScrollView>
      <View className='dt-spine-line' />
    </View>
  )
}
```

- [ ] **Step 2: 追加样式**

Edit `src/views/ItineraryView/styles/daytabs.scss`，文件末尾追加：

```scss
/* ============ B. spine（时间轴脊柱） ============ */
.dt-spine-wrap {
  position: relative;
  background: var(--surface);
  border-bottom: 2rpx solid var(--ink);
}
.dt--spine {
  padding: 24rpx 24rpx 16rpx;
  border-bottom: none;
  background: transparent;
}
.dt-item--spine {
  flex-direction: column;
  padding: 8rpx 18rpx 16rpx;
  position: relative;
}
.dt-spine-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: var(--ink);
  margin-bottom: 8rpx;
}
.dt-item--spine.on .dt-spine-dot {
  background: var(--accent);
  box-shadow: 0 0 0 6rpx var(--accent-soft);
}
.dt-spine-no {
  font-size: 24rpx;
  font-weight: 800;
  font-family: var(--font-display);
  color: var(--ink);
}
.dt-spine-date {
  font-size: 18rpx;
  font-family: var(--font-mono);
  color: var(--ink-3);
  letter-spacing: 1rpx;
}
.dt-item--spine.on .dt-spine-no { color: var(--accent); }
.dt-spine-line {
  position: absolute;
  bottom: -2rpx;
  left: 24rpx; right: 24rpx;
  height: 2rpx;
  background: var(--ink);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/ItineraryView/DayTabsSpine.tsx src/views/ItineraryView/styles/daytabs.scss
git commit -m "feat(itin): DayTabsSpine 时间轴脊柱"
```

---

## Task 4: DayTabsCalendar（postcard · 日历方块）

**Files:**
- Create: `src/views/ItineraryView/DayTabsCalendar.tsx`
- Modify: `src/views/ItineraryView/styles/daytabs.scss`

- [ ] **Step 1: 组件**

Create `src/views/ItineraryView/DayTabsCalendar.tsx`：

```typescript
import { ScrollView, View, Text } from '@tarojs/components'
import dayjs from 'dayjs'
import type { Day } from '../../types/trip'

interface Props {
  days: Day[]
  activeId: string
  onSelect: (id: string) => void
  onLongPress: (id: string, idx: number) => void
  onAdd: (pos: 'front' | 'back') => void
}

export default function DayTabsCalendar({ days, activeId, onSelect, onLongPress, onAdd }: Props) {
  return (
    <ScrollView scrollX className='dt dt--calendar'>
      {days.map((d, idx) => {
        const date = dayjs(d.date)
        return (
          <View
            key={d.id}
            className={`dt-item dt-item--calendar ${activeId === d.id ? 'on' : ''}`}
            onClick={() => onSelect(d.id)}
            onLongPress={() => onLongPress(d.id, idx)}
          >
            <Text className='dt-cal-month'>{date.format('M')} 月</Text>
            <Text className='dt-cal-bigday'>{date.format('D')}</Text>
            <Text className='dt-cal-label'>Day {idx + 1}</Text>
          </View>
        )
      })}
      <View className='dt-add dt-add--cal' onClick={() => onAdd('back')}>
        <Text>+</Text>
      </View>
    </ScrollView>
  )
}
```

- [ ] **Step 2: 追加样式**

```scss
/* ============ C. calendar（日历方块） ============ */
.dt--calendar { gap: 16rpx; }
.dt-item--calendar {
  flex-direction: column;
  width: 120rpx;
  height: 120rpx;
  padding: 12rpx 0;
  background: var(--surface-2);
  border: 2rpx solid var(--line-2);
  border-radius: var(--r-sm);
  align-items: center;
  justify-content: center;
}
.dt-item--calendar.on {
  background: var(--ink-2);
  color: var(--surface);
  border-color: var(--ink-2);
}
.dt-cal-month {
  font-size: 18rpx;
  font-family: var(--font-mono);
  letter-spacing: 2rpx;
  opacity: 0.7;
}
.dt-cal-bigday {
  font-size: 48rpx;
  font-weight: 900;
  font-family: var(--font-display);
  line-height: 1;
  margin: 4rpx 0;
}
.dt-cal-label {
  font-size: 18rpx;
  letter-spacing: 2rpx;
  font-family: var(--font-mono);
  opacity: 0.8;
}
.dt-add--cal {
  width: 120rpx;
  height: 120rpx;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/ItineraryView/DayTabsCalendar.tsx src/views/ItineraryView/styles/daytabs.scss
git commit -m "feat(itin): DayTabsCalendar 日历方块"
```

---

## Task 5: DayTabsSimple（minimal · 极简文字）

**Files:**
- Create: `src/views/ItineraryView/DayTabsSimple.tsx`
- Modify: `src/views/ItineraryView/styles/daytabs.scss`

- [ ] **Step 1: 组件**

Create `src/views/ItineraryView/DayTabsSimple.tsx`：

```typescript
import { ScrollView, View, Text } from '@tarojs/components'
import dayjs from 'dayjs'
import type { Day } from '../../types/trip'

interface Props {
  days: Day[]
  activeId: string
  onSelect: (id: string) => void
  onLongPress: (id: string, idx: number) => void
  onAdd: (pos: 'front' | 'back') => void
}

export default function DayTabsSimple({ days, activeId, onSelect, onLongPress, onAdd }: Props) {
  return (
    <ScrollView scrollX className='dt dt--simple'>
      {days.map((d, idx) => (
        <View
          key={d.id}
          className={`dt-item dt-item--simple ${activeId === d.id ? 'on' : ''}`}
          onClick={() => onSelect(d.id)}
          onLongPress={() => onLongPress(d.id, idx)}
        >
          <Text className='dt-simple-num'>{idx + 1}</Text>
          <Text className='dt-simple-date'>{dayjs(d.date).format('M.D')}</Text>
        </View>
      ))}
      <View className='dt-add dt-add--simple' onClick={() => onAdd('back')}>
        <Text>+</Text>
      </View>
    </ScrollView>
  )
}
```

- [ ] **Step 2: 追加样式**

```scss
/* ============ D. simple（极简文字） ============ */
.dt--simple { gap: 32rpx; padding: 24rpx; }
.dt-item--simple {
  flex-direction: column;
  align-items: center;
  padding: 4rpx 0;
  border-bottom: 2rpx solid transparent;
}
.dt-item--simple.on {
  border-bottom-color: var(--ink);
}
.dt-simple-num {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--ink-3);
  font-family: var(--font-mono);
}
.dt-item--simple.on .dt-simple-num {
  color: var(--ink);
  font-weight: 800;
}
.dt-simple-date {
  font-size: 18rpx;
  color: var(--ink-3);
  font-family: var(--font-mono);
  margin-top: 2rpx;
}
.dt-add--simple {
  background: transparent;
  color: var(--ink-3);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/ItineraryView/DayTabsSimple.tsx src/views/ItineraryView/styles/daytabs.scss
git commit -m "feat(itin): DayTabsSimple 极简文字"
```

---

## Task 6: DayTabs dispatcher

**Files:**
- Create: `src/views/ItineraryView/DayTabs.tsx`

- [ ] **Step 1: 创建 dispatcher**

```typescript
import { useTheme } from '../../store/theme-store'
import type { Day } from '../../types/trip'
import { DAYTAB_VARIANT } from './variants'
import DayTabsTicket from './DayTabsTicket'
import DayTabsSpine from './DayTabsSpine'
import DayTabsCalendar from './DayTabsCalendar'
import DayTabsSimple from './DayTabsSimple'
import './styles/daytabs.scss'

interface Props {
  days: Day[]
  activeId: string
  onSelect: (id: string) => void
  onLongPress: (id: string, idx: number) => void
  onAdd: (pos: 'front' | 'back') => void
}

export default function DayTabs(props: Props) {
  const { theme } = useTheme()
  const variant = DAYTAB_VARIANT[theme]
  if (variant === 'spine')    return <DayTabsSpine    {...props} />
  if (variant === 'calendar') return <DayTabsCalendar {...props} />
  if (variant === 'simple')   return <DayTabsSimple   {...props} />
  return <DayTabsTicket {...props} />
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/ItineraryView/DayTabs.tsx
git commit -m "feat(itin): DayTabs dispatcher"
```

---

## Task 7: 4 主题主体子组件 · Tegami

**Files:**
- Create: `src/views/ItineraryView/ItinTegami.tsx`
- Create: `src/views/ItineraryView/styles/body-tegami.scss`

> 主体 = DayHeader + spot 列表 + 添加按钮。手帖：圆角卡 + 暖橘 day no 圆章 + 时间线 dot。

- [ ] **Step 1: 组件**

```typescript
import { View, Text } from '@tarojs/components'
import DayHeader from './DayHeader'
import SpotCard from './SpotCard'
import type { ItinViewProps } from './shared'
import './styles/body-tegami.scss'

export default function ItinTegami({
  trip, activeDay, activeDayIdx, fallbackDestination,
  onSpotClick, onAddSpot, onWeatherUpdate,
}: ItinViewProps) {
  return (
    <View className='itintg'>
      <View className='itintg-dayhead'>
        <View className='itintg-day-stamp'>
          <Text className='itintg-day-no'>{String(activeDayIdx + 1).padStart(2, '0')}</Text>
        </View>
        <View className='itintg-day-info'>
          <DayHeader
            day={activeDay}
            fallbackDestination={fallbackDestination}
            onWeatherUpdate={onWeatherUpdate}
          />
        </View>
      </View>

      <View className='itintg-spots'>
        {activeDay.spots.map((s) => (
          <SpotCard key={s.id} spot={s} onClick={() => onSpotClick(s)} />
        ))}
        {activeDay.spots.length === 0 && (
          <View className='itintg-empty'>这一天还没有地点</View>
        )}
        <View className='itintg-add' onClick={onAddSpot}>+ 添加地点</View>
      </View>
    </View>
  )
}
```

- [ ] **Step 2: 样式**

Create `src/views/ItineraryView/styles/body-tegami.scss`：

```scss
.itintg {
  padding: 16rpx 24rpx 32rpx;
  animation: fade-in 0.28s var(--ease-out) both;
}

.itintg-dayhead {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 0 12rpx;
}
.itintg-day-stamp {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--shadow-md);
}
.itintg-day-no {
  font-size: 32rpx;
  font-weight: 800;
  font-family: var(--font-display);
}
.itintg-day-info { flex: 1; min-width: 0; }

.itintg-spots {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 16rpx;
}
.itintg-empty {
  text-align: center;
  padding: 80rpx 0;
  color: var(--ink-3);
  font-size: 24rpx;
}
.itintg-add {
  margin-top: 8rpx;
  padding: 24rpx;
  text-align: center;
  background: var(--accent-bg);
  color: var(--accent);
  border-radius: var(--r-md);
  font-size: 28rpx;
  font-weight: 600;
}
.itintg-add:active { transform: scale(0.98); }
```

- [ ] **Step 3: Commit**

```bash
git add src/views/ItineraryView/ItinTegami.tsx src/views/ItineraryView/styles/body-tegami.scss
git commit -m "feat(itin): ItinTegami 主体（暖橘圆章）"
```

---

## Task 8: 4 主题主体子组件 · Magazine

**Files:**
- Create: `src/views/ItineraryView/ItinMagazine.tsx`
- Create: `src/views/ItineraryView/styles/body-magazine.scss`

> 编辑栏：DAY 01 大粗体 + 红色 accent 数字 + 黑色 hairline 分割。

- [ ] **Step 1: 组件**

```typescript
import { View, Text } from '@tarojs/components'
import DayHeader from './DayHeader'
import SpotCard from './SpotCard'
import type { ItinViewProps } from './shared'
import './styles/body-magazine.scss'

export default function ItinMagazine({
  trip, activeDay, activeDayIdx, fallbackDestination,
  onSpotClick, onAddSpot, onWeatherUpdate,
}: ItinViewProps) {
  return (
    <View className='itinmg'>
      <View className='itinmg-dayhead'>
        <Text className='itinmg-day-label'>DAY</Text>
        <Text className='itinmg-day-no'>{String(activeDayIdx + 1).padStart(2, '0')}</Text>
        <View className='itinmg-day-info'>
          <DayHeader
            day={activeDay}
            fallbackDestination={fallbackDestination}
            onWeatherUpdate={onWeatherUpdate}
          />
        </View>
      </View>
      <View className='itinmg-rule' />

      <View className='itinmg-spots'>
        {activeDay.spots.map((s) => (
          <SpotCard key={s.id} spot={s} onClick={() => onSpotClick(s)} />
        ))}
        {activeDay.spots.length === 0 && (
          <View className='itinmg-empty'>NO ITEMS YET</View>
        )}
        <View className='itinmg-add' onClick={onAddSpot}>+ ADD SPOT</View>
      </View>
    </View>
  )
}
```

- [ ] **Step 2: 样式**

```scss
.itinmg {
  padding: 16rpx 24rpx 32rpx;
  animation: fade-in 0.28s var(--ease-out) both;
}

.itinmg-dayhead {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  padding: 24rpx 0 8rpx;
}
.itinmg-day-label {
  font-size: 22rpx;
  letter-spacing: 6rpx;
  font-family: var(--font-display);
  color: var(--ink);
}
.itinmg-day-no {
  font-size: 80rpx;
  font-weight: 900;
  font-family: var(--font-display);
  line-height: 0.9;
  color: var(--accent);
}
.itinmg-day-info { flex: 1; min-width: 0; align-self: center; }

.itinmg-rule {
  height: 2rpx;
  background: var(--ink);
  margin: 16rpx 0 24rpx;
}

.itinmg-spots {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.itinmg-spots > * {
  border-bottom: 1rpx solid var(--line);
}
.itinmg-empty {
  text-align: center;
  padding: 64rpx 0;
  color: var(--ink-3);
  font-size: 22rpx;
  letter-spacing: 6rpx;
  font-family: var(--font-display);
}
.itinmg-add {
  margin-top: 24rpx;
  padding: 20rpx 0;
  text-align: center;
  border: 2rpx solid var(--ink);
  background: transparent;
  color: var(--ink);
  font-size: 24rpx;
  letter-spacing: 6rpx;
  font-weight: 700;
  font-family: var(--font-display);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/ItineraryView/ItinMagazine.tsx src/views/ItineraryView/styles/body-magazine.scss
git commit -m "feat(itin): ItinMagazine 主体（编辑栏）"
```

---

## Task 9: 4 主题主体子组件 · Postcard

**Files:**
- Create: `src/views/ItineraryView/ItinPostcard.tsx`
- Create: `src/views/ItineraryView/styles/body-postcard.scss`

> 椭圆 day 戳 + 牛皮纸底。

- [ ] **Step 1: 组件**

```typescript
import { View, Text } from '@tarojs/components'
import DayHeader from './DayHeader'
import SpotCard from './SpotCard'
import type { ItinViewProps } from './shared'
import './styles/body-postcard.scss'

export default function ItinPostcard({
  trip, activeDay, activeDayIdx, fallbackDestination,
  onSpotClick, onAddSpot, onWeatherUpdate,
}: ItinViewProps) {
  return (
    <View className='itinpp'>
      <View className='itinpp-paper'>
        <View className='itinpp-paper-grain' />
        <View className='itinpp-dayhead'>
          <View className='itinpp-day-oval'>
            <Text className='itinpp-day-l1'>DAY</Text>
            <Text className='itinpp-day-l2'>{activeDayIdx + 1}</Text>
          </View>
          <View className='itinpp-day-info'>
            <DayHeader
              day={activeDay}
              fallbackDestination={fallbackDestination}
              onWeatherUpdate={onWeatherUpdate}
            />
          </View>
        </View>

        <View className='itinpp-spots'>
          {activeDay.spots.map((s) => (
            <SpotCard key={s.id} spot={s} onClick={() => onSpotClick(s)} />
          ))}
          {activeDay.spots.length === 0 && (
            <View className='itinpp-empty'>这一天还没有地点</View>
          )}
          <View className='itinpp-add' onClick={onAddSpot}>+ 添加地点</View>
        </View>
      </View>
    </View>
  )
}
```

- [ ] **Step 2: 样式**

```scss
.itinpp {
  padding: 16rpx 24rpx 32rpx;
  animation: fade-in 0.28s var(--ease-out) both;
}

.itinpp-paper {
  position: relative;
  padding: 24rpx;
  background: var(--surface);
  border: 2rpx solid var(--line-2);
  border-radius: var(--r-md);
  overflow: hidden;
}
.itinpp-paper-grain {
  position: absolute; inset: 0;
  background:
    repeating-linear-gradient(45deg, transparent 0 24rpx, rgba(43,31,14,0.02) 24rpx 26rpx);
  pointer-events: none;
}

.itinpp-dayhead {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 2rpx dashed var(--line-2);
  position: relative;
  z-index: 1;
}
.itinpp-day-oval {
  width: 120rpx;
  height: 88rpx;
  border-radius: 50%;
  border: 3rpx solid var(--accent);
  color: var(--accent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: rotate(-6deg);
  flex-shrink: 0;
}
.itinpp-day-l1 {
  font-size: 16rpx;
  letter-spacing: 3rpx;
  font-family: var(--font-mono);
}
.itinpp-day-l2 {
  font-size: 36rpx;
  font-weight: 800;
  font-family: var(--font-display);
  line-height: 1;
}
.itinpp-day-info { flex: 1; min-width: 0; }

.itinpp-spots {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 20rpx;
  position: relative;
  z-index: 1;
}
.itinpp-empty {
  text-align: center;
  padding: 60rpx 0;
  color: var(--ink-3);
}
.itinpp-add {
  margin-top: 8rpx;
  padding: 20rpx;
  text-align: center;
  border: 2rpx dashed var(--accent);
  color: var(--accent);
  border-radius: var(--r-sm);
  font-size: 26rpx;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/ItineraryView/ItinPostcard.tsx src/views/ItineraryView/styles/body-postcard.scss
git commit -m "feat(itin): ItinPostcard 主体（椭圆 day 戳）"
```

---

## Task 10: 4 主题主体子组件 · Minimal

**Files:**
- Create: `src/views/ItineraryView/ItinMinimal.tsx`
- Create: `src/views/ItineraryView/styles/body-minimal.scss`

> 行式：Day 01 small + spots 缩进 hairline。

- [ ] **Step 1: 组件**

```typescript
import { View, Text } from '@tarojs/components'
import DayHeader from './DayHeader'
import SpotCard from './SpotCard'
import type { ItinViewProps } from './shared'
import './styles/body-minimal.scss'

export default function ItinMinimal({
  trip, activeDay, activeDayIdx, fallbackDestination,
  onSpotClick, onAddSpot, onWeatherUpdate,
}: ItinViewProps) {
  return (
    <View className='itinmin'>
      <View className='itinmin-dayhead'>
        <Text className='itinmin-day-label'>Day {String(activeDayIdx + 1).padStart(2, '0')}</Text>
        <View className='itinmin-day-info'>
          <DayHeader
            day={activeDay}
            fallbackDestination={fallbackDestination}
            onWeatherUpdate={onWeatherUpdate}
          />
        </View>
      </View>

      <View className='itinmin-spots'>
        {activeDay.spots.map((s) => (
          <SpotCard key={s.id} spot={s} onClick={() => onSpotClick(s)} />
        ))}
        {activeDay.spots.length === 0 && (
          <View className='itinmin-empty'>—</View>
        )}
        <View className='itinmin-add' onClick={onAddSpot}>+ 添加</View>
      </View>
    </View>
  )
}
```

- [ ] **Step 2: 样式**

```scss
.itinmin {
  padding: 24rpx 32rpx 32rpx;
  animation: fade-in 0.28s var(--ease-out) both;
}

.itinmin-dayhead {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 16rpx 0 12rpx;
  border-bottom: 1rpx solid var(--line);
}
.itinmin-day-label {
  font-size: 24rpx;
  letter-spacing: 4rpx;
  color: var(--ink-3);
  font-family: var(--font-display);
}
.itinmin-day-info { font-size: 30rpx; color: var(--ink); }

.itinmin-spots {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 16rpx;
}
.itinmin-spots > * {
  border-bottom: 1rpx solid var(--line);
  padding-left: 12rpx;
}
.itinmin-empty {
  padding: 48rpx 0;
  text-align: center;
  color: var(--ink-3);
  font-size: 32rpx;
}
.itinmin-add {
  margin-top: 24rpx;
  padding: 16rpx 0;
  text-align: center;
  color: var(--ink-3);
  font-size: 26rpx;
  letter-spacing: 4rpx;
}
.itinmin-add:active { color: var(--ink); }
```

- [ ] **Step 3: Commit**

```bash
git add src/views/ItineraryView/ItinMinimal.tsx src/views/ItineraryView/styles/body-minimal.scss
git commit -m "feat(itin): ItinMinimal 主体（行式 hairline）"
```

---

## Task 11: index.tsx 改 dispatcher

**Files:**
- Modify: `src/views/ItineraryView/index.tsx`
- Modify: `src/views/ItineraryView/index.scss`

- [ ] **Step 1: 重构 index.tsx**

把 `src/views/ItineraryView/index.tsx` 改为：保留 state + addDay / longPressDay / handleAddSpot 逻辑；把 render 改为 dispatcher。

参考形态：

```typescript
import { useState } from 'react'
import { View } from '@tarojs/components'
import dayjs from 'dayjs'
import Taro from '@tarojs/taro'
import { useTripStore } from '../../store/trip-store'
import { useTheme } from '../../store/theme-store'
import { uid } from '../../utils/id'
import SpotSearch from '../../components/SpotSearch'
import EditSpotSheet from '../../components/EditSpotSheet'
import type { Spot, Day } from '../../types/trip'
import DayTabs from './DayTabs'
import ItinTegami from './ItinTegami'
import ItinMagazine from './ItinMagazine'
import ItinPostcard from './ItinPostcard'
import ItinMinimal from './ItinMinimal'
import type { ItinViewProps } from './shared'
import './index.scss'

export default function ItineraryView() {
  const { state, dispatch } = useTripStore()
  const trip = state.trip!
  const { theme } = useTheme()
  const [activeDayId, setActiveDayId] = useState<string>(trip.days[0]?.id || '')
  const [searchOpen, setSearchOpen] = useState(false)
  const [editSpot, setEditSpot] = useState<{ dayId: string; spot: Spot } | null>(null)

  const activeDayIdx = trip.days.findIndex((d) => d.id === activeDayId)
  const activeDay: Day | undefined = trip.days.find((d) => d.id === activeDayId) || trip.days[0]

  if (!activeDay) {
    return <View>暂无日期</View>
  }

  const addDay = (position: 'front' | 'back' = 'back') => {
    const last = trip.days[trip.days.length - 1]
    const newDate = position === 'front'
      ? dayjs(trip.days[0]?.date || trip.startDate).subtract(1, 'day').format('YYYY-MM-DD')
      : last
        ? dayjs(last.date).add(1, 'day').format('YYYY-MM-DD')
        : dayjs(trip.startDate).format('YYYY-MM-DD')
    const day: Day = { id: uid(), date: newDate, spots: [], weather: null }
    dispatch({ type: 'ADD_DAY', day, position })
    setActiveDayId(day.id)
  }

  const longPressDay = async (dayId: string, dayIdx: number) => {
    const total = trip.days.length
    const dayNo = dayIdx + 1
    const items: { label: string; action: () => void }[] = []
    if (dayIdx > 0) {
      items.push({ label: '← 前移一位', action: () => dispatch({ type: 'MOVE_DAY', dayId, targetIndex: dayIdx - 1 }) })
      items.push({ label: '⇤ 移到最前 (整体提前 1 天)', action: () => dispatch({ type: 'MOVE_DAY', dayId, targetIndex: 0 }) })
    }
    if (dayIdx < total - 1) {
      items.push({ label: '后移一位 →', action: () => dispatch({ type: 'MOVE_DAY', dayId, targetIndex: dayIdx + 1 }) })
      items.push({ label: '⇥ 移到最后 (整体延后 1 天)', action: () => dispatch({ type: 'MOVE_DAY', dayId, targetIndex: total - 1 }) })
    }
    items.push({
      label: `删除 Day ${dayNo}`,
      action: async () => {
        const res = await Taro.showModal({ title: `删除 Day ${dayNo}?`, confirmText: '删除', confirmColor: '#c43d3d' })
        if (res.confirm) {
          dispatch({ type: 'DELETE_DAY', dayId })
          if (activeDayId === dayId) {
            setActiveDayId(trip.days.find((d) => d.id !== dayId)?.id || '')
          }
        }
      },
    })
    const res = await Taro.showActionSheet({ itemList: items.map((i) => i.label) })
    items[res.tapIndex]?.action()
  }

  const handleAddSpot = (spot: Spot) => {
    if (!activeDay) return
    dispatch({ type: 'ADD_SPOT', dayId: activeDay.id, spot })
    setSearchOpen(false)
  }

  const viewProps: ItinViewProps = {
    trip,
    activeDay,
    activeDayIdx,
    fallbackDestination: trip.destinations?.[0] || null,
    onSelectDay: setActiveDayId,
    onLongPressDay: longPressDay,
    onAddDay: addDay,
    onSpotClick: (s) => setEditSpot({ dayId: activeDay.id, spot: s }),
    onAddSpot: () => setSearchOpen(true),
    onWeatherUpdate: (w) => dispatch({ type: 'UPDATE_DAY', dayId: activeDay.id, patch: { weather: w } }),
  }

  return (
    <View className='itin'>
      <DayTabs
        days={trip.days}
        activeId={activeDayId}
        onSelect={setActiveDayId}
        onLongPress={longPressDay}
        onAdd={addDay}
      />

      {theme === 'tegami'   && <ItinTegami   {...viewProps} />}
      {theme === 'magazine' && <ItinMagazine {...viewProps} />}
      {theme === 'postcard' && <ItinPostcard {...viewProps} />}
      {theme === 'minimal'  && <ItinMinimal  {...viewProps} />}

      <SpotSearch
        open={searchOpen}
        defaultCity={activeDay.spots[0]?.city || trip.destinations?.[0]?.name}
        onClose={() => setSearchOpen(false)}
        onSelect={handleAddSpot}
      />
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
    </View>
  )
}
```

- [ ] **Step 2: 精简 index.scss**

Edit `src/views/ItineraryView/index.scss`：

删除所有 `.itin-tab*` / `.itin-spots / .itin-empty / .itin-add-spot` 等选择器（已被子组件接管）。

保留：
- `.itin` 根
- `.day-header` 及其 children（DayHeader 组件用）
- `.spot-card` 及其 children（SpotCard 组件用）

如不确定，先全选所有 `.itin-tab*` 块删除，再用 `grep "itin-tab" src/` 确认无残留引用。

- [ ] **Step 3: 编译验证**

watch 重编 → 无类型错。

- [ ] **Step 4: Commit**

```bash
git add src/views/ItineraryView/index.tsx src/views/ItineraryView/index.scss
git commit -m "feat(itin): ItineraryView 重构为 dispatcher（DayTabs + 4 主题主体）"
```

---

## Task 12: 矩阵走查

**Files:** 仅验证

- [ ] **Step 1: 四主题 DayTabs**

进 trip → itinerary tab → 我的页切主题：

| 主题 | DayTabs 验证 |
| --- | --- |
| 手帖 | 票根撕口式：MMM/数字/序号；上下 notch 缺口；激活态橙底白字 |
| 刊物 | 时间轴脊柱：dot + D1 + M/D；底部贯穿 hairline；激活态 dot 带 6rpx 光环 |
| 护照 | 日历方块：120×120 方块；激活态深棕底白字 |
| 极简 | 极简文字：数字 + M.D 两行；激活态底部加粗 underline |

- [ ] **Step 2: 四主题主体**

每主题下当日列表：

| 主题 | 主体验证 |
| --- | --- |
| 手帖 | 88rpx 圆章 Day 01（暖橘渐变）+ DayHeader 在右；spot 卡 16rpx 间距 |
| 刊物 | DAY + 80rpx 红色大数字 + DayHeader；下方 2rpx 黑线；spot 卡之间 hairline 分割 |
| 护照 | 椭圆 oval Day 戳 rotate(-6deg)；牛皮纸 paper-grain；dashed 分隔；+ 添加 dashed |
| 极简 | Day 01 small 标签 + DayHeader 大字；spot 卡 hairline + 左缩进 |

- [ ] **Step 3: 共用行为**

每主题下：
- 长按 day tab → ActionSheet（前移 / 后移 / 移到最前/最后 / 删除）
- 短按 day tab → 切换当日
- + 加日期（前/后）→ 成功
- 当日 spots 列表 → 点击 → EditSpotSheet
- + 添加地点 → SpotSearch sheet → 选 → 成功添加

- [ ] **Step 4: 边界**

- 1 天 trip：DayTabs 显示单 tab；切到 calendar 不挤压
- 10+ 天 trip：DayTabs 横向滚动；4 variant 都流畅
- 空 trip（无 days）：fallback 显示「暂无日期」
- 协作权限：非 owner 切日期/查看正常；不破坏既有权限逻辑

---

## Task 13: 收尾

- [ ] **Step 1: codemap**

追加 ItineraryView 的 12 个新文件。

- [ ] **Step 2: Push**

```bash
git push
```

---

## Self-Review

- ✅ Spec § 7.3.1 4 主题主体 → Task 7, 8, 9, 10
- ✅ Spec § 7.3.2 DayTabs 4 variant → Task 2, 3, 4, 5
- ✅ Spec § 7.3.3 实现策略（抽 `<DayTabs/>` + variant 映射） → Task 1, 6
- ✅ 保留前后加日期 / 长按移动 / 删除日期 / spot CRUD → Task 11 dispatcher

**关键决策：**

1. **DayHeader / SpotCard 复用，不主题化**
   两个组件在 4 主题下被父布局影响（字号/颜色继承 token），自身 DOM 不变。
   理由：城市/天气/spot 详情结构稳定；主题影响视觉而不是结构。

2. **DayTabs `add` 按钮简化**
   设计稿 `+` 按钮在 calendar variant 是 icon，其他是 `+`。本 Phase 4 variant 一律用 `+` 字符，token 漂移即可视觉一致。

3. **`.itin` 根类无需 scoped 主题**
   主体子组件各自 `.itintg / .itinmg / .itinpp / .itinmin` 隔离样式；`.itin` 仅作根容器，无样式（或最小 padding）。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-26-phase4b-itinerary-four-themes.md`. Subagent-Driven or Inline?**
