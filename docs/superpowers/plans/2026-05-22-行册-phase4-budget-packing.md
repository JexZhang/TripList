# 行册 Phase 4 · 开销 + 清单 view Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 trip 详情页中的"开销"和"清单"两个 view —— 开销从 `days[].spots[]` 按 `type` 聚合（住宿/餐饮/门票/交通 4 类），清单沿用 6 大类 + 内置 6 模板。

**Architecture:** 两个 view 都从 `useTripStore()` 拿数据。开销 view 为纯派生计算 + 点 spot 跳 EditSpotSheet 编辑。清单 view 把 packing 数据从 `trip.packing[]` 读写（移除原 utils/override.ts 本地覆盖逻辑）。

**Tech Stack:** Taro 4.2 / React 18 / TypeScript · 沿用 Phase 3 的 store + EditSpotSheet

---

## 0. 前置条件

- **0.1** Phase 3 已完成验收
- **0.2** trip 详情页能加载、ItineraryView 工作正常
- **0.3** EditSpotSheet 组件可复用

---

## 1. 文件结构

```
src/
├── views/
│   ├── ItineraryView/             (Phase 3)
│   ├── BudgetView/                ← 新建
│   │   ├── index.tsx
│   │   └── index.scss
│   └── PackingView/               ← 新建
│       ├── index.tsx
│       └── index.scss
├── components/
│   ├── SpotSearch/                (Phase 3)
│   ├── EditSpotSheet/             (Phase 3)
│   └── TemplateImport/            ← 新建
│       ├── index.tsx
│       └── index.scss
├── pages/trip/index.tsx           ← 修改：接入两个 view
└── utils/
    └── override.ts                ← 删除
```

---

## Task 1: 创建 `views/BudgetView`

**Files:**
- Create: `src/views/BudgetView/index.tsx`
- Create: `src/views/BudgetView/index.scss`

- [ ] **Step 1.1:** `src/views/BudgetView/index.tsx`
```tsx
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { useTripStore } from '../../store/trip-store'
import { fmtCurrency } from '../../utils/format'
import EditSpotSheet from '../../components/EditSpotSheet'
import type { Spot, SpotType } from '../../types/trip'
import './index.scss'

interface Bucket {
  type: SpotType
  label: string
  total: number
}

const CATEGORIES: { type: SpotType; label: string; seg: string }[] = [
  { type: 'hotel', label: '住宿', seg: 'seg-hotel' },
  { type: 'transport', label: '交通', seg: 'seg-transport' },
  { type: 'meal', label: '餐饮', seg: 'seg-meal' },
  { type: 'spot', label: '门票', seg: 'seg-ticket' },
]

export default function BudgetView() {
  const { state, dispatch } = useTripStore()
  const trip = state.trip!
  const [editSpot, setEditSpot] = useState<{ dayId: string; spot: Spot } | null>(null)

  // 聚合 4 类
  const totals: Record<SpotType, number> = { spot: 0, hotel: 0, meal: 0, transport: 0, arrive: 0 }
  for (const d of trip.days) {
    for (const s of d.spots) {
      totals[s.type] = (totals[s.type] || 0) + (s.price || 0)
    }
  }
  const grandTotal = totals.spot + totals.hotel + totals.meal + totals.transport
  const perPax = trip.pax > 0 ? Math.round(grandTotal / trip.pax) : grandTotal
  const pct = (n: number) => grandTotal > 0 ? `${(n / grandTotal) * 100}%` : '0%'

  return (
    <View className='budget'>
      {/* 总览 */}
      <View className='bg-total-row'>
        <View className='bg-total-block'>
          <Text className='bg-total-label'>总开销</Text>
          <Text className='bg-total-value'>{fmtCurrency(grandTotal)}</Text>
        </View>
        <View className='bg-total-block'>
          <Text className='bg-total-label'>人均 ({trip.pax}人)</Text>
          <Text className='bg-total-sub'>{fmtCurrency(perPax)}</Text>
        </View>
      </View>

      {/* 分布条 */}
      <View className='bg-dist'>
        <View className='bg-dist-bar'>
          {CATEGORIES.map(c => (
            <View
              key={c.type}
              className={`dist-seg ${c.seg}`}
              style={{ width: pct(totals[c.type]) }}
            />
          ))}
        </View>
        <View className='bg-dist-legend'>
          {CATEGORIES.map(c => (
            <View key={c.type} className='legend-item'>
              <View className={`legend-dot ${c.seg}`} />
              <Text className='legend-label'>{c.label}</Text>
              <Text className='legend-value'>{fmtCurrency(totals[c.type])}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 按天展开 */}
      <ScrollView className='bg-days' scrollY>
        {trip.days.map((d, idx) => {
          const dayTotal = d.spots.reduce((s, sp) => s + (sp.price || 0), 0)
          if (d.spots.length === 0) return null
          return (
            <View key={d.id} className='bg-day'>
              <View className='bg-day-head'>
                <Text className='bg-day-no'>DAY {String(idx + 1).padStart(2, '0')}</Text>
                <Text className='bg-day-date'>{d.date}</Text>
                <Text className='bg-day-total'>{fmtCurrency(dayTotal)}</Text>
              </View>
              {d.spots.map(s => (
                <View
                  key={s.id}
                  className='bg-spot'
                  onClick={() => setEditSpot({ dayId: d.id, spot: s })}
                >
                  <Text className='bg-spot-cat'>{CATEGORIES.find(c => c.type === s.type)?.label || '其他'}</Text>
                  <Text className='bg-spot-name'>{s.name}</Text>
                  <Text className='bg-spot-price'>{fmtCurrency(s.price || 0)}</Text>
                </View>
              ))}
            </View>
          )
        })}
        {trip.days.every(d => d.spots.length === 0) && (
          <View className='bg-empty'>还没有任何 spot；去攻略 tab 添加</View>
        )}
      </ScrollView>

      <EditSpotSheet
        open={!!editSpot}
        spot={editSpot?.spot || null}
        defaultCity={editSpot?.spot.city}
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

- [ ] **Step 1.2:** `src/views/BudgetView/index.scss`
```scss
.budget {
  padding: 16rpx 32rpx 32rpx;
}

.bg-total-row {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 24rpx 32rpx;
  border: 2rpx solid currentColor;
  border-radius: 12rpx;
  margin-bottom: 32rpx;
}
.bg-total-block { display: flex; flex-direction: column; }
.bg-total-label { font-size: 22rpx; opacity: 0.55; letter-spacing: 2rpx; }
.bg-total-value { font-size: 56rpx; font-weight: 700; margin-top: 8rpx; }
.bg-total-sub { font-size: 32rpx; font-weight: 600; opacity: 0.85; margin-top: 8rpx; }

.bg-dist { margin-bottom: 32rpx; }
.bg-dist-bar {
  display: flex;
  height: 24rpx;
  border: 2rpx solid currentColor;
  overflow: hidden;
}
.dist-seg { height: 100%; }
.dist-seg.seg-hotel { background: #2a2522; }
.dist-seg.seg-transport { background: rgba(42,37,34,0.7); }
.dist-seg.seg-meal { background: rgba(42,37,34,0.45); }
.dist-seg.seg-ticket { background: rgba(42,37,34,0.22); }

.bg-dist-legend {
  display: flex; flex-direction: column;
  margin-top: 16rpx;
}
.legend-item {
  display: flex; align-items: center;
  padding: 10rpx 0;
  border-bottom: 1rpx dashed currentColor;
}
.legend-dot { width: 14rpx; height: 14rpx; margin-right: 12rpx; }
.legend-dot.seg-hotel { background: #2a2522; }
.legend-dot.seg-transport { background: rgba(42,37,34,0.7); }
.legend-dot.seg-meal { background: rgba(42,37,34,0.45); }
.legend-dot.seg-ticket { background: rgba(42,37,34,0.22); }
.legend-label { flex: 1; font-size: 24rpx; letter-spacing: 2rpx; }
.legend-value { font-size: 26rpx; font-weight: 600; }

.bg-days { margin-top: 16rpx; }

.bg-day {
  margin-bottom: 24rpx;
  padding: 16rpx 0;
  border-top: 2rpx solid currentColor;
}
.bg-day-head {
  display: flex; align-items: baseline;
  padding-bottom: 12rpx;
}
.bg-day-no {
  font-size: 22rpx; letter-spacing: 4rpx; font-weight: 700;
  margin-right: 16rpx;
}
.bg-day-date {
  font-size: 22rpx; opacity: 0.55;
  flex: 1;
}
.bg-day-total { font-size: 26rpx; font-weight: 600; }

.bg-spot {
  display: flex; align-items: baseline;
  padding: 14rpx 0;
  border-bottom: 1rpx dashed rgba(0,0,0,0.08);
}
.bg-spot-cat {
  width: 80rpx; font-size: 22rpx; opacity: 0.6;
}
.bg-spot-name { flex: 1; font-size: 26rpx; }
.bg-spot-price { font-size: 26rpx; font-weight: 600; }

.bg-empty {
  text-align: center; padding: 64rpx;
  opacity: 0.55; font-size: 26rpx;
}
```

- [ ] **Step 1.3:** 提交
```bash
git add src/views/BudgetView/
git commit -m "feat(view): add BudgetView aggregating spots by type"
```

---

## Task 2: 创建 `components/TemplateImport`

**Files:**
- Create: `src/components/TemplateImport/index.tsx`
- Create: `src/components/TemplateImport/index.scss`

- [ ] **Step 2.1:** `src/components/TemplateImport/index.tsx`
```tsx
import { View, Text, ScrollView } from '@tarojs/components'
import { PACKING_TEMPLATES } from '../../data/packing'
import { uid } from '../../utils/id'
import type { PackingItem } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  onClose: () => void
  onImport: (items: PackingItem[]) => void
}

export default function TemplateImport({ open, onClose, onImport }: Props) {
  if (!open) return null

  const importTemplate = (idx: number) => {
    const tpl = PACKING_TEMPLATES[idx]
    const items: PackingItem[] = tpl.items.map(([cat, label]) => ({
      id: uid(), category: cat, label, checked: false,
    }))
    onImport(items)
    onClose()
  }

  return (
    <View className='tpl-mask' onClick={onClose}>
      <View className='tpl-sheet' onClick={e => e.stopPropagation()}>
        <View className='tpl-head'>
          <Text className='tpl-title'>导入清单模板</Text>
          <Text className='tpl-close' onClick={onClose}>×</Text>
        </View>
        <Text className='tpl-hint'>选一个模板会追加到现有清单（不会覆盖）</Text>
        <ScrollView className='tpl-list' scrollY>
          {PACKING_TEMPLATES.map((t, i) => (
            <View key={t.name} className='tpl-item' onClick={() => importTemplate(i)}>
              <Text className='tpl-item-name'>{t.name}</Text>
              <Text className='tpl-item-count'>{t.items.length} 项</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  )
}
```

- [ ] **Step 2.2:** `src/components/TemplateImport/index.scss`
```scss
.tpl-mask {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: flex-end;
  z-index: 100;
}

.tpl-sheet {
  width: 100%; max-height: 70vh;
  background: var(--bg, #f7f1e3);
  color: var(--ink, #2a2522);
  border-radius: 24rpx 24rpx 0 0;
  padding: 24rpx;
  display: flex; flex-direction: column;
  box-sizing: border-box;
}

.tpl-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8rpx;
}
.tpl-title { font-size: 30rpx; font-weight: 600; }
.tpl-close { font-size: 40rpx; opacity: 0.55; padding: 0 12rpx; }

.tpl-hint {
  display: block;
  font-size: 22rpx;
  opacity: 0.55;
  margin-bottom: 16rpx;
}

.tpl-list { flex: 1; }

.tpl-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 24rpx 12rpx;
  border-bottom: 1rpx solid rgba(0,0,0,0.08);
}
.tpl-item-name { font-size: 28rpx; font-weight: 500; }
.tpl-item-count { font-size: 22rpx; opacity: 0.55; }
```

- [ ] **Step 2.3:** 提交
```bash
git add src/components/TemplateImport/
git commit -m "feat(component): add TemplateImport for packing presets"
```

---

## Task 3: 创建 `views/PackingView`

**Files:**
- Create: `src/views/PackingView/index.tsx`
- Create: `src/views/PackingView/index.scss`

- [ ] **Step 3.1:** `src/views/PackingView/index.tsx`
```tsx
import { useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTripStore } from '../../store/trip-store'
import { PACKING_CATEGORIES } from '../../data/packing'
import { uid } from '../../utils/id'
import TemplateImport from '../../components/TemplateImport'
import type { PackingItem } from '../../types/trip'
import './index.scss'

export default function PackingView() {
  const { state, dispatch } = useTripStore()
  const trip = state.trip!
  const [draftByCat, setDraftByCat] = useState<Record<string, string>>({})
  const [tplOpen, setTplOpen] = useState(false)

  const setPacking = (next: PackingItem[]) =>
    dispatch({ type: 'UPDATE_TRIP', patch: { packing: next } })

  const toggle = (id: string) => {
    setPacking(trip.packing.map(p => p.id === id ? { ...p, checked: !p.checked } : p))
  }
  const remove = async (id: string) => {
    const res = await Taro.showModal({ title: '删除该项？', confirmText: '删除', confirmColor: '#c43d3d' })
    if (res.confirm) setPacking(trip.packing.filter(p => p.id !== id))
  }
  const add = (catId: string) => {
    const label = (draftByCat[catId] || '').trim()
    if (!label) return
    setPacking([...trip.packing, { id: uid(), category: catId, label, checked: false }])
    setDraftByCat({ ...draftByCat, [catId]: '' })
  }
  const onImport = (items: PackingItem[]) => {
    setPacking([...trip.packing, ...items])
    Taro.showToast({ title: `已导入 ${items.length} 项`, icon: 'success' })
  }

  const checkedCount = trip.packing.filter(p => p.checked).length

  return (
    <View className='packing'>
      <View className='pk-head'>
        <Text className='pk-summary'>已勾选 {checkedCount} / {trip.packing.length}</Text>
        <View className='pk-tpl-btn' onClick={() => setTplOpen(true)}>导入模板</View>
      </View>

      {PACKING_CATEGORIES.map(cat => {
        const list = trip.packing.filter(p => p.category === cat.id)
        return (
          <View key={cat.id} className='pk-group'>
            <Text className='pk-group-title'>{cat.icon} {cat.label}</Text>
            {list.map(it => (
              <View key={it.id} className='pk-item'>
                <View
                  className={`pk-check ${it.checked ? 'on' : ''}`}
                  onClick={() => toggle(it.id)}
                >{it.checked ? '✓' : ''}</View>
                <Text
                  className={`pk-label ${it.checked ? 'done' : ''}`}
                  onClick={() => toggle(it.id)}
                >{it.label}</Text>
                <Text className='pk-x' onClick={() => remove(it.id)}>×</Text>
              </View>
            ))}
            <Input
              className='pk-add-input'
              placeholder={`+ 添加${cat.label}`}
              value={draftByCat[cat.id] || ''}
              onInput={e => setDraftByCat({ ...draftByCat, [cat.id]: e.detail.value })}
              onConfirm={() => add(cat.id)}
            />
          </View>
        )
      })}

      <TemplateImport
        open={tplOpen}
        onClose={() => setTplOpen(false)}
        onImport={onImport}
      />
    </View>
  )
}
```

- [ ] **Step 3.2:** `src/views/PackingView/index.scss`
```scss
.packing {
  padding: 16rpx 32rpx 32rpx;
}

.pk-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 24rpx;
}
.pk-summary { font-size: 24rpx; opacity: 0.65; }
.pk-tpl-btn {
  padding: 10rpx 20rpx;
  border: 2rpx solid currentColor;
  border-radius: 999rpx;
  font-size: 22rpx;
}

.pk-group {
  margin-bottom: 32rpx;
  padding: 20rpx;
  border: 2rpx solid currentColor;
  border-radius: 12rpx;
}
.pk-group-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
  letter-spacing: 2rpx;
}

.pk-item {
  display: flex; align-items: center;
  padding: 12rpx 0;
}
.pk-check {
  width: 32rpx; height: 32rpx;
  margin-right: 16rpx;
  border: 2rpx solid currentColor;
  border-radius: 6rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 22rpx;
}
.pk-check.on { background: var(--ink); color: var(--bg); }
.pk-label { flex: 1; font-size: 26rpx; }
.pk-label.done { opacity: 0.45; text-decoration: line-through; }
.pk-x { padding: 4rpx 16rpx; font-size: 32rpx; opacity: 0.5; }

.pk-add-input {
  margin-top: 12rpx;
  padding: 10rpx 0;
  font-size: 24rpx;
  opacity: 0.75;
  border-bottom: 2rpx dashed currentColor;
}
```

- [ ] **Step 3.3:** 提交
```bash
git add src/views/PackingView/
git commit -m "feat(view): add PackingView with 6 categories and template import"
```

---

## Task 4: 接入两个 view 到 trip 页

**Files:**
- Modify: `src/pages/trip/index.tsx`

- [ ] **Step 4.1:** 替换 trip 页中的占位

找到这段：
```tsx
{view === 'budget' && <View className='trip-empty'>开销 view 待 Phase 4</View>}
{view === 'packing' && <View className='trip-empty'>清单 view 待 Phase 4</View>}
```

替换为：
```tsx
{view === 'budget' && <BudgetView />}
{view === 'packing' && <PackingView />}
```

同时在 import 区域加上：
```tsx
import BudgetView from '../../views/BudgetView'
import PackingView from '../../views/PackingView'
```

- [ ] **Step 4.2:** 类型检查
```bash
npx tsc --noEmit
```

- [ ] **Step 4.3:** 提交
```bash
git add src/pages/trip/index.tsx
git commit -m "feat(trip): wire BudgetView and PackingView"
```

---

## Task 5: 清理旧文件 `utils/override.ts`

**Files:**
- Delete: `src/utils/override.ts`

- [ ] **Step 5.1:** 确认无 import 引用
```bash
cd /Users/jinchi/Documents/行册
grep -rn "from.*override" src/ 2>/dev/null
grep -rn "override\.ts" src/ 2>/dev/null
```

预期：无输出（或仅 self 引用）。

- [ ] **Step 5.2:** 删除
```bash
rm src/utils/override.ts
```

- [ ] **Step 5.3:** 类型检查
```bash
npx tsc --noEmit
```

- [ ] **Step 5.4:** 提交
```bash
git add -A
git commit -m "refactor: remove obsolete utils/override.ts (data now in trip doc)"
```

---

## Task 6: 端到端验证

**Files:** 无；纯手动。

- [ ] **Step 6.1:** 编译，进入一个有 spots 的 trip 详情页

- [ ] **Step 6.2:** 切到"开销" tab：
- 顶部看到总开销 + 人均
- 分布条 4 段（住宿/交通/餐饮/门票）宽度按金额比例
- 下方按天展开 spots，金额对齐

- [ ] **Step 6.3:** 点开销 view 里某个 spot → 弹 EditSpotSheet → 改价格 → 保存 → 分布条 / 总额实时更新

- [ ] **Step 6.4:** 切到"清单" tab：
- 6 类卡片（证件/衣物/电子/洗漱/药品/其他），每类下方有 "+ 添加" 输入框
- 顶部"已勾选 0 / 0"
- 右上"导入模板"按钮

- [ ] **Step 6.5:** 点"导入模板" → 选 "国内 · 基础" → toast"已导入 18 项" → 6 类下都有了对应 item

- [ ] **Step 6.6:** 勾选几个 → 顶部计数更新 → 勾选项 strike-through + 灰

- [ ] **Step 6.7:** 在某类输入框打字 + 回车 → 新增成功，列表多一项

- [ ] **Step 6.8:** 点 × → modal 确认 → 删除

- [ ] **Step 6.9:** **持久化验证**：刷新页面 → 勾选状态、导入项、添加项都还在

- [ ] **Step 6.10:** **协作同步验证**（两端）：A 勾一项 → B 几秒内看到那项变勾选

- [ ] **Step 6.11:** 提交杂项
```bash
git status
git add -A && git commit -m "chore(phase4): verification passed" 2>/dev/null || true
```

---

## 7. Phase 4 验收

- 7.1 ✅ 开销 view 顶部总览 + 人均 + 4 类分布条
- 7.2 ✅ 开销 view 按天展开，点 spot 进 EditSpotSheet
- 7.3 ✅ 清单 view 6 类分组，可勾选 / 添加 / 删除
- 7.4 ✅ 模板导入：6 个内置模板都能导入，追加而非覆盖
- 7.5 ✅ 数据持久化到 `trip.packing`，刷新不丢
- 7.6 ✅ 协作端能同步
- 7.7 ✅ `utils/override.ts` 已删除，全项目无残留引用
- 7.8 ✅ TypeScript 无 error

全部 ✅ 后进入 Phase 5。
