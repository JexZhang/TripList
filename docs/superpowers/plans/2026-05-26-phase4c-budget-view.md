# Phase 4c · BudgetView 设计稿重构 + 四主题 token 漂移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 BudgetView 按 `triplist-design/project/budget.jsx` 的单一结构重写：环形 donut + 分类图例 + 每日折线卡 + 最贵一笔高亮 + 分类明细。**4 主题不做版式分支**，仅靠 token 漂移呈现差异。

**Architecture:** 单一 `BudgetView` 组件，DOM 结构固定。颜色/圆角/字体全部用 `var(--*)`，不硬编码 hex。conic-gradient 角度由分类聚合实时计算；SVG 折线 path 在 React 内即时生成。

**Tech Stack:** Taro 4.x React + TypeScript + SCSS（conic-gradient / SVG / aspect-ratio）

**Spec:** [docs/superpowers/specs/2026-05-26-design-system-application-design.md](../specs/2026-05-26-design-system-application-design.md) § 7.4

**Prerequisite:** Phase 4a 合并

**Scope：**
- 改：BudgetView 完全重写
- 不改：EditSpotSheet（仍用于点击 spot 编辑价格）；store/dispatch；价格聚合逻辑（沿用现 totals[type] 思路）

**Testing reality:** 微信开发者工具冒烟。

---

## File Structure

### 修改

| 路径 | 改动 |
| --- | --- |
| `src/views/BudgetView/index.tsx` | 整体重写为设计稿结构 |
| `src/views/BudgetView/index.scss` | 整体重写 |

### 新增

| 路径 | 责任 |
| --- | --- |
| `src/views/BudgetView/helpers.ts` | 价格聚合 / donut 角度 / 折线点计算 |
| `src/views/BudgetView/DailyChart.tsx` | 每日花销折线 SVG 卡 |

---

## Task 0: 基线

- [ ] **Step 1: Phase 4a 合并**
- [ ] **Step 2: dev:weapp 启动 + 进 trip → budget tab 查看当前形态**（4 类总览 + 列表）

---

## Task 1: 价格聚合工具

**Files:**
- Create: `src/views/BudgetView/helpers.ts`

- [ ] **Step 1: 工具函数**

Create `src/views/BudgetView/helpers.ts`：

```typescript
import type { Spot, SpotType, Trip } from '../../types/trip'

export interface BudgetBucket {
  type: SpotType
  label: string
  /** 用于 conic-gradient 的 CSS color（指向 token） */
  color: string
  total: number
  pct: number
  /** conic 起止角度 */
  start: number
  end: number
}

export interface DailyTotal {
  dayId: string
  date: string
  v: number
}

export interface ExpensiveSpot {
  dayId: string
  spot: Spot
  pctOfTotal: number
}

const CATEGORY_LABEL: Record<SpotType, string> = {
  hotel: '住宿',
  transport: '交通',
  meal: '餐饮',
  spot: '景点/杂项',
}

const CATEGORY_COLOR: Record<SpotType, string> = {
  hotel:     'var(--plum)',
  transport: 'var(--leaf)',
  meal:      'var(--accent)',
  spot:      'var(--sun)',
}

export function aggregateBudget(trip: Trip): {
  buckets: BudgetBucket[]
  total: number
  perPax: number
  daily: DailyTotal[]
  expensive: ExpensiveSpot | null
} {
  const totals: Record<SpotType, number> = { hotel: 0, transport: 0, meal: 0, spot: 0 }
  let total = 0
  let maxSpot: ExpensiveSpot | null = null
  const daily: DailyTotal[] = []

  for (const d of trip.days) {
    let dayV = 0
    for (const s of d.spots) {
      const p = s.price || 0
      totals[s.type] = (totals[s.type] || 0) + p
      total += p
      dayV += p
      if (!maxSpot || p > maxSpot.spot.price! /* eslint-disable-line @typescript-eslint/no-non-null-assertion */) {
        if (p > 0) maxSpot = { dayId: d.id, spot: s, pctOfTotal: 0 }
      }
    }
    daily.push({ dayId: d.id, date: d.date, v: dayV })
  }

  if (maxSpot && total > 0) {
    maxSpot.pctOfTotal = (maxSpot.spot.price || 0) / total * 100
  }

  const order: SpotType[] = ['hotel', 'transport', 'meal', 'spot']
  let acc = 0
  const buckets: BudgetBucket[] = order.map((type) => {
    const v = totals[type] || 0
    const pct = total > 0 ? (v / total) * 100 : 0
    const angle = total > 0 ? (v / total) * 360 : 0
    const start = acc
    acc += angle
    return {
      type,
      label: CATEGORY_LABEL[type],
      color: CATEGORY_COLOR[type],
      total: v,
      pct,
      start,
      end: acc,
    }
  })

  const perPax = trip.pax > 0 ? Math.round(total / trip.pax) : total
  return { buckets, total, perPax, daily, expensive: maxSpot }
}

/** conic-gradient CSS 字符串（var(--*) 颜色作为 stop） */
export function conicFromBuckets(buckets: BudgetBucket[]): string {
  const usable = buckets.filter((b) => b.total > 0)
  if (usable.length === 0) return 'var(--line)'
  return usable.map((b) => `${b.color} ${b.start}deg ${b.end}deg`).join(', ')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/BudgetView/helpers.ts
git commit -m "feat(budget): 价格聚合 + donut 角度工具"
```

---

## Task 2: DailyChart 组件

**Files:**
- Create: `src/views/BudgetView/DailyChart.tsx`

- [ ] **Step 1: 组件**

Create `src/views/BudgetView/DailyChart.tsx`：

```typescript
import { View, Text } from '@tarojs/components'
import dayjs from 'dayjs'
import type { DailyTotal } from './helpers'

interface Props {
  daily: DailyTotal[]
}

export default function DailyChart({ daily }: Props) {
  if (daily.length === 0) {
    return <View className='bv-chart-empty'>暂无数据</View>
  }

  // 视口尺寸（rpx 与 SVG viewBox 无关；SVG 用相对单位即可）
  const W = 268
  const H = 64
  const PAD = 6
  const maxV = Math.max(1, ...daily.map((d) => d.v))
  const points = daily.map((d, i) => {
    const x = PAD + (i / Math.max(1, daily.length - 1)) * (W - PAD * 2)
    const y = H - PAD - (d.v / maxV) * (H - PAD * 2)
    return { x, y, d }
  })
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${path} L${points[points.length - 1].x.toFixed(1)},${H} L${points[0].x.toFixed(1)},${H} Z`
  const maxIdx = daily.findIndex((d) => d.v === maxV)

  return (
    <View className='bv-chart'>
      <View className='bv-chart-svg-wrap'>
        {/* 用 inline SVG via dangerously：小程序不直接支持 SVG 元素，用 base64 data URI */}
        <View
          className='bv-chart-svg'
          style={{
            backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svgString({ W, H, path, areaPath, points, maxIdx }))}")`,
          }}
        />
      </View>
      <View className='bv-chart-axis'>
        {daily.map((d, i) => (
          <Text key={d.dayId} className={`bv-chart-axis-l ${i === maxIdx ? 'on' : ''}`}>
            {dayjs(d.date).format('M/D')}
          </Text>
        ))}
      </View>
    </View>
  )
}

function svgString({
  W, H, path, areaPath, points, maxIdx,
}: {
  W: number; H: number
  path: string
  areaPath: string
  points: { x: number; y: number; d: DailyTotal }[]
  maxIdx: number
}): string {
  const max = points[maxIdx]
  return `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H + 8}' preserveAspectRatio='none'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='currentColor' stop-opacity='0.28'/>
      <stop offset='100%' stop-color='currentColor' stop-opacity='0'/>
    </linearGradient>
  </defs>
  <path d='${areaPath}' fill='url(#g)'/>
  <path d='${path}' stroke='currentColor' stroke-width='2' fill='none' stroke-linejoin='round'/>
  ${points.map((p, i) => `<circle cx='${p.x}' cy='${p.y}' r='${i === maxIdx ? 3.2 : 2}' fill='currentColor'/>`).join('')}
  ${max ? `<text x='${max.x}' y='${max.y - 4}' fill='currentColor' font-size='8' text-anchor='middle' font-weight='700'>¥${max.d.v}</text>` : ''}
</svg>`.trim()
}
```

> 说明：小程序对内联 SVG 元素支持有限，但 SVG 作为 background-image data URI 完全可用且性能好。`currentColor` 由 CSS `color: var(--accent)` 决定，主题自动漂移。

- [ ] **Step 2: Commit**

```bash
git add src/views/BudgetView/DailyChart.tsx
git commit -m "feat(budget): DailyChart 每日折线（SVG via data URI）"
```

---

## Task 3: BudgetView 主体重写

**Files:**
- Modify: `src/views/BudgetView/index.tsx`

- [ ] **Step 1: 重写 index.tsx**

替换 `src/views/BudgetView/index.tsx` 整体：

```typescript
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { useTripStore } from '../../store/trip-store'
import { fmtCurrency } from '../../utils/format'
import EditSpotSheet from '../../components/EditSpotSheet'
import type { Spot } from '../../types/trip'
import { aggregateBudget, conicFromBuckets } from './helpers'
import DailyChart from './DailyChart'
import './index.scss'

export default function BudgetView() {
  const { state, dispatch } = useTripStore()
  const trip = state.trip!
  const [editSpot, setEditSpot] = useState<{ dayId: string; spot: Spot } | null>(null)

  const { buckets, total, perPax, daily, expensive } = aggregateBudget(trip)
  const conic = conicFromBuckets(buckets)
  const hotelPct = buckets.find((b) => b.type === 'hotel')?.pct || 0

  return (
    <ScrollView scrollY className='bv'>
      {/* 1. 顶部总览 */}
      <View className='bv-head'>
        <View className='bv-head-l'>
          <Text className='bv-total-label'>本次总开销</Text>
          <Text className='bv-total-value'>¥{total.toLocaleString()}</Text>
          <Text className='bv-perpax'>
            人均 <Text className='bv-perpax-v'>¥{perPax.toLocaleString()}</Text>
          </Text>
        </View>
        <View className='bv-donut-wrap'>
          <View className='bv-donut' style={{ background: `conic-gradient(${conic})` }}>
            <View className='bv-donut-hole' />
          </View>
          <View className='bv-donut-center'>
            <Text className='bv-donut-pct'>{Math.round(hotelPct)}%</Text>
            <Text className='bv-donut-cap'>住宿占比</Text>
          </View>
        </View>
      </View>

      {/* 2. 图例 */}
      <View className='bv-legend'>
        {buckets.map((b) => (
          <View key={b.type} className='bv-legend-row'>
            <View className='bv-legend-sw' style={{ background: b.color }} />
            <Text className='bv-legend-label'>{b.label}</Text>
            <Text className='bv-legend-pct'>{Math.round(b.pct)}%</Text>
            <Text className='bv-legend-v'>¥{b.total.toLocaleString()}</Text>
          </View>
        ))}
      </View>

      {/* 3. 每日折线 */}
      <View className='bv-card'>
        <View className='bv-card-head'>
          <Text className='bv-card-title'>每日花销</Text>
          <Text className='bv-card-cap'>{daily.length} 天 · 走势</Text>
        </View>
        <DailyChart daily={daily} />
      </View>

      {/* 4. 最贵一笔 */}
      {expensive && (
        <View
          className='bv-expensive'
          onClick={() => setEditSpot({ dayId: expensive.dayId, spot: expensive.spot })}
        >
          <Text className='bv-exp-kicker'>本次最贵一笔</Text>
          <Text className='bv-exp-name'>{expensive.spot.name}</Text>
          <View className='bv-exp-meta'>
            <Text className='bv-exp-price'>¥{(expensive.spot.price || 0).toLocaleString()}</Text>
            <Text className='bv-exp-pct'>占总开销 {Math.round(expensive.pctOfTotal)}%</Text>
          </View>
        </View>
      )}

      {/* 5. 分类明细：每类下展开该类所有 spot */}
      <View className='bv-details'>
        {buckets.map((b) => {
          const items = trip.days.flatMap((d) =>
            d.spots.filter((s) => s.type === b.type && (s.price || 0) > 0)
              .map((s) => ({ dayId: d.id, spot: s })),
          )
          if (items.length === 0) return null
          return (
            <View key={b.type} className='bv-detail-group'>
              <View className='bv-detail-head'>
                <View className='bv-detail-sw' style={{ background: b.color }} />
                <Text className='bv-detail-label'>{b.label}</Text>
                <Text className='bv-detail-total'>¥{b.total.toLocaleString()}</Text>
              </View>
              {items.map(({ dayId, spot }) => (
                <View
                  key={spot.id}
                  className='bv-detail-row'
                  onClick={() => setEditSpot({ dayId, spot })}
                >
                  <Text className='bv-detail-name'>{spot.name}</Text>
                  <Text className='bv-detail-price'>{fmtCurrency(spot.price || 0)}</Text>
                </View>
              ))}
            </View>
          )
        })}
      </View>

      <EditSpotSheet
        open={!!editSpot}
        spot={editSpot?.spot || null}
        defaultCity={editSpot?.spot.city || trip.destinations?.[0]?.name}
        onClose={() => setEditSpot(null)}
        onSave={(patch) => {
          if (!editSpot) return
          dispatch({ type: 'UPDATE_SPOT', dayId: editSpot.dayId, spotId: editSpot.spot.id, patch })
        }}
      />
    </ScrollView>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/BudgetView/index.tsx
git commit -m "feat(budget): BudgetView 按设计稿结构重写"
```

---

## Task 4: BudgetView 样式

**Files:**
- Modify: `src/views/BudgetView/index.scss`

- [ ] **Step 1: 重写样式**

替换 `src/views/BudgetView/index.scss` 整体：

```scss
.bv {
  padding: 24rpx 24rpx 80rpx;
  background: var(--bg);
  min-height: 100vh;
  box-sizing: border-box;
  animation: fade-in 0.32s var(--ease-out) both;
  color: var(--accent); /* DailyChart 用 currentColor 取主题 accent */
}

/* ============ 1. 总览 ============ */
.bv-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24rpx;
  padding: 24rpx;
  background: var(--surface);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
  margin-bottom: 24rpx;
}
.bv-head-l { flex: 1; min-width: 0; color: var(--ink); }
.bv-total-label {
  display: block;
  font-size: 22rpx;
  color: var(--ink-3);
  letter-spacing: 2rpx;
  margin-bottom: 8rpx;
}
.bv-total-value {
  display: block;
  font-size: 56rpx;
  font-weight: 800;
  font-family: var(--font-mono);
  color: var(--ink);
  margin-bottom: 8rpx;
}
.bv-perpax {
  font-size: 22rpx;
  color: var(--ink-2);
}
.bv-perpax-v {
  color: var(--accent);
  font-weight: 700;
  font-family: var(--font-mono);
}

/* donut */
.bv-donut-wrap {
  position: relative;
  width: 180rpx;
  height: 180rpx;
  flex-shrink: 0;
}
.bv-donut {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  position: relative;
}
.bv-donut-hole {
  position: absolute;
  inset: 22%;
  border-radius: 50%;
  background: var(--surface);
}
.bv-donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--ink);
}
.bv-donut-pct {
  font-size: 30rpx;
  font-weight: 800;
  font-family: var(--font-mono);
  line-height: 1;
}
.bv-donut-cap {
  font-size: 18rpx;
  color: var(--ink-3);
  margin-top: 4rpx;
  letter-spacing: 2rpx;
}

/* ============ 2. 图例 ============ */
.bv-legend {
  padding: 24rpx;
  background: var(--surface);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
  margin-bottom: 24rpx;
}
.bv-legend-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 0;
  border-bottom: 1rpx solid var(--line);
  font-size: 24rpx;
  color: var(--ink);
}
.bv-legend-row:last-child { border-bottom: none; }
.bv-legend-sw {
  width: 24rpx;
  height: 24rpx;
  border-radius: var(--r-xs);
  flex-shrink: 0;
}
.bv-legend-label { flex: 1; color: var(--ink-2); }
.bv-legend-pct {
  font-family: var(--font-mono);
  color: var(--ink-3);
  width: 80rpx;
  text-align: right;
}
.bv-legend-v {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--ink);
  min-width: 140rpx;
  text-align: right;
}

/* ============ 3. 折线卡 ============ */
.bv-card {
  padding: 24rpx;
  background: var(--surface);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
  margin-bottom: 24rpx;
}
.bv-card-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 16rpx;
}
.bv-card-title {
  font-size: 28rpx;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--ink);
}
.bv-card-cap {
  font-size: 20rpx;
  color: var(--ink-3);
  font-family: var(--font-mono);
  letter-spacing: 2rpx;
}
.bv-chart {
  width: 100%;
}
.bv-chart-svg-wrap { width: 100%; }
.bv-chart-svg {
  width: 100%;
  aspect-ratio: 268 / 72;
  background-repeat: no-repeat;
  background-size: 100% 100%;
}
.bv-chart-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 8rpx;
  font-size: 18rpx;
  font-family: var(--font-mono);
  color: var(--ink-3);
}
.bv-chart-axis-l.on {
  color: var(--accent);
  font-weight: 700;
}
.bv-chart-empty {
  padding: 48rpx 0;
  text-align: center;
  color: var(--ink-3);
  font-size: 22rpx;
}

/* ============ 4. 最贵一笔 ============ */
.bv-expensive {
  padding: 24rpx;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-md);
  margin-bottom: 24rpx;
}
.bv-expensive:active { transform: scale(0.98); }
.bv-exp-kicker {
  display: block;
  font-size: 20rpx;
  letter-spacing: 4rpx;
  opacity: 0.85;
  font-family: var(--font-display);
  margin-bottom: 8rpx;
}
.bv-exp-name {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  font-family: var(--font-display);
  margin-bottom: 12rpx;
}
.bv-exp-meta {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.bv-exp-price {
  font-size: 40rpx;
  font-weight: 800;
  font-family: var(--font-mono);
}
.bv-exp-pct {
  font-size: 22rpx;
  font-family: var(--font-mono);
  opacity: 0.85;
}

/* ============ 5. 分类明细 ============ */
.bv-details {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.bv-detail-group {
  padding: 16rpx 20rpx;
  background: var(--surface);
  border-radius: var(--r-md);
}
.bv-detail-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding-bottom: 12rpx;
  border-bottom: 1rpx solid var(--line);
}
.bv-detail-sw {
  width: 16rpx; height: 16rpx;
  border-radius: var(--r-xs);
}
.bv-detail-label {
  flex: 1;
  font-size: 24rpx;
  font-weight: 600;
  color: var(--ink);
}
.bv-detail-total {
  font-size: 24rpx;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--ink);
}
.bv-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 12rpx 0;
  border-bottom: 1rpx solid var(--line);
  font-size: 24rpx;
}
.bv-detail-row:last-child { border-bottom: none; }
.bv-detail-row:active { background: var(--accent-bg); }
.bv-detail-name {
  flex: 1;
  color: var(--ink-2);
}
.bv-detail-price {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--ink);
}
```

- [ ] **Step 2: 编译验证**

watch 重编。Expected: 无 SCSS 错误

- [ ] **Step 3: Commit**

```bash
git add src/views/BudgetView/index.scss
git commit -m "feat(budget): BudgetView 样式（设计稿结构 + token 漂移）"
```

---

## Task 5: 矩阵走查

**Files:** 仅验证

- [ ] **Step 1: 微信开发者工具 → trip → budget tab**

切换四主题：

| 主题 | 视觉差异 |
| --- | --- |
| 手帖 | donut 含暖橘段（meal）；卡片大圆角 32rpx；阴影柔和 |
| 刊物 | donut 各段被 magazine 红/灰系替代；卡片几乎直角；阴影变成 box-shadow offset 黑硬阴影 |
| 护照 | donut 偏褐橙；卡片中等圆角；阴影深 |
| 极简 | donut 仍可见但低饱和；几乎无阴影；mono 数字主导 |

- [ ] **Step 2: 数据矩阵**

- 空 trip（无 spot 价格）：total = 0；donut 显示一段 var(--line)；图例 4 行全 0%；折线显示「暂无数据」；最贵一笔不显示；明细 5 区都空
- 单类（仅 hotel 有价）：donut 1 段满圆；其余 0%
- 跨类多日：donut 4 段；折线高低不一；maxIdx 在曲线上标注 ¥X

- [ ] **Step 3: 交互**

- 点最贵一笔 → 弹 EditSpotSheet 编辑该 spot
- 点明细行任意 spot → 弹 EditSpotSheet
- 修改价格 → 关闭 → BudgetView 数据立即重算（state 触发重渲）

- [ ] **Step 4: 滚动**

整页 ScrollView scrollY；长 trip 多 spot 时滚动顺畅，不被吸顶截断

---

## Task 6: 收尾

- [ ] **Step 1: codemap**

追加：
- `src/views/BudgetView/helpers.ts`
- `src/views/BudgetView/DailyChart.tsx`

- [ ] **Step 2: Push**

```bash
git push
```

---

## Self-Review

- ✅ Spec § 7.4.1 5 个结构块（总览 / 图例 / 折线 / 最贵 / 明细）→ Task 3
- ✅ Spec § 7.4.2 4 主题 token 漂移 → 颜色/圆角/字体全部 var(--*) → Task 4
- ✅ Spec § 7.4.3 单一组件 + 颜色用 token → Task 1 (CATEGORY_COLOR 用 var(--plum/leaf/accent/sun))

**关键决策：**

1. **SVG via data URI**
   小程序对 `<svg>` 元素支持有限；用 `background-image: url("data:image/svg+xml;utf8,...")` 是稳妥方案。`currentColor` 由父元素 `color: var(--accent)` 决定 → 主题自动漂移。

2. **conic-gradient 颜色用 var(--*)**
   背景 `conic-gradient(var(--plum) 0deg 80deg, ...)` 微信小程序 ≥ 基础库 2.20 支持。若发现 conic-gradient 在某老版本不生效，降级方案：用 SVG donut（4 segment path）。

3. **EditSpotSheet 复用**
   不重新实现编辑能力；点击触发既有 sheet。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-26-phase4c-budget-view.md`. Subagent-Driven or Inline?**
