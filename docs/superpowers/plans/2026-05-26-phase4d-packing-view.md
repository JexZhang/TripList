# Phase 4d · PackingView 四主题 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** PackingView 按四主题各做一套版式：手帖贴纸感 / 刊物清单卡 / 护照行李条 / 极简勾选行。保留全部增删改 + 模板导入 + 勾选行为。

**Architecture:** 与 ItineraryView 类似 —— `pages/views/PackingView/index.tsx` 改为薄 dispatcher，按 theme 渲染 4 个子组件。共用 props（categories / draft / dispatch 回调 / template import）。

**Tech Stack:** Taro 4.x React + TypeScript + SCSS

**Spec:** [docs/superpowers/specs/2026-05-26-design-system-application-design.md](../specs/2026-05-26-design-system-application-design.md) § 7.5

**Prerequisite:** Phase 4a 合并

**Scope：**
- 改：PackingView 主体（list + add + toggle + remove）
- 不改：TemplateImport 组件；store / dispatch；packing 数据结构

---

## File Structure

### 新增

| 路径 | 责任 |
| --- | --- |
| `src/views/PackingView/PackTegami.tsx` | 贴纸感 |
| `src/views/PackingView/PackMagazine.tsx` | 清单卡 |
| `src/views/PackingView/PackPostcard.tsx` | 行李条 |
| `src/views/PackingView/PackMinimal.tsx` | 勾选行 |
| `src/views/PackingView/shared.ts` | 共用 props |
| `src/views/PackingView/styles/tegami.scss` | 4 主题样式 |
| `src/views/PackingView/styles/magazine.scss` | … |
| `src/views/PackingView/styles/postcard.scss` | … |
| `src/views/PackingView/styles/minimal.scss` | … |

### 修改

| 路径 | 改动 |
| --- | --- |
| `src/views/PackingView/index.tsx` | 薄 dispatcher：保留 state + CRUD + tplOpen 弹层 |
| `src/views/PackingView/index.scss` | 减薄 |

---

## Task 0: 基线 + Task 1: 共用 props

- [ ] **Step 1: 基线**

`git status` + `git log -5` 含 Phase 4a；`dev:weapp` 启；进 trip → packing tab 查看现状

- [ ] **Step 2: shared.ts**

Create `src/views/PackingView/shared.ts`：

```typescript
import type { PackingItem } from '../../types/trip'

export interface PackCategoryDef {
  id: string
  label: string
}

export interface PackViewProps {
  categories: PackCategoryDef[]
  packing: PackingItem[]
  draftByCat: Record<string, string>
  checkedCount: number
  onDraftChange: (catId: string, value: string) => void
  onAdd: (catId: string) => void
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onOpenTemplate: () => void
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/PackingView/shared.ts
git commit -m "feat(packing): 共用 props 类型"
```

---

## Task 2: PackTegami（手帖贴纸感）

**Files:**
- Create: `src/views/PackingView/PackTegami.tsx`
- Create: `src/views/PackingView/styles/tegami.scss`

> 隐喻：贴纸。圆角矩形 chip，勾选后翻转标记 ✓，勾过的暖橘填充。

- [ ] **Step 1: 组件**

```typescript
import { View, Text, Input } from '@tarojs/components'
import type { PackViewProps } from './shared'
import './styles/tegami.scss'

export default function PackTegami(props: PackViewProps) {
  const { categories, packing, draftByCat, checkedCount, onDraftChange, onAdd, onToggle, onRemove, onOpenTemplate } = props
  return (
    <View className='ptg'>
      <View className='ptg-head'>
        <Text className='ptg-progress'>{checkedCount} / {packing.length} 已打包</Text>
        <View className='ptg-tpl' onClick={onOpenTemplate}>导入模板</View>
      </View>

      {categories.map((cat) => {
        const items = packing.filter((p) => p.category === cat.id)
        return (
          <View key={cat.id} className='ptg-cat'>
            <Text className='ptg-cat-label'>{cat.label}</Text>
            <View className='ptg-chips'>
              {items.map((p) => (
                <View
                  key={p.id}
                  className={`ptg-chip ${p.checked ? 'on' : ''}`}
                  onClick={() => onToggle(p.id)}
                  onLongPress={() => onRemove(p.id)}
                >
                  <Text className='ptg-chip-check'>{p.checked ? '✓' : '○'}</Text>
                  <Text>{p.label}</Text>
                </View>
              ))}
              <View className='ptg-add-row'>
                <Input
                  className='ptg-input'
                  value={draftByCat[cat.id] || ''}
                  placeholder='加一项…'
                  onInput={(e) => onDraftChange(cat.id, e.detail.value)}
                  onConfirm={() => onAdd(cat.id)}
                  confirmType='done'
                />
                <View className='ptg-add-btn' onClick={() => onAdd(cat.id)}>+</View>
              </View>
            </View>
          </View>
        )
      })}
    </View>
  )
}
```

- [ ] **Step 2: 样式**

Create `src/views/PackingView/styles/tegami.scss`：

```scss
.ptg { padding: 24rpx; animation: fade-in 0.28s var(--ease-out) both; }
.ptg-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}
.ptg-progress { font-size: 26rpx; font-weight: 600; color: var(--ink); }
.ptg-tpl {
  padding: 10rpx 22rpx;
  background: var(--accent-bg);
  color: var(--accent);
  border-radius: var(--r-pill);
  font-size: 22rpx;
}
.ptg-cat { margin-bottom: 28rpx; }
.ptg-cat-label {
  display: block;
  font-size: 24rpx;
  letter-spacing: 4rpx;
  color: var(--ink-3);
  font-family: var(--font-display);
  margin-bottom: 12rpx;
}
.ptg-chips { display: flex; flex-wrap: wrap; gap: 12rpx; }
.ptg-chip {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 14rpx 22rpx;
  background: var(--surface);
  border: 2rpx solid var(--line-2);
  border-radius: var(--r-pill);
  font-size: 26rpx;
  color: var(--ink);
  transition: all 0.22s var(--ease-out);
}
.ptg-chip.on {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  text-decoration: line-through;
  opacity: 0.85;
}
.ptg-chip-check { font-size: 22rpx; }
.ptg-add-row {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  border: 2rpx dashed var(--line-2);
  border-radius: var(--r-pill);
  padding: 6rpx 14rpx;
}
.ptg-input {
  width: 200rpx;
  font-size: 24rpx;
  color: var(--ink);
}
.ptg-add-btn {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/PackingView/PackTegami.tsx src/views/PackingView/styles/tegami.scss
git commit -m "feat(packing): PackTegami 贴纸感"
```

---

## Task 3: PackMagazine（清单卡）

**Files:**
- Create: `src/views/PackingView/PackMagazine.tsx`
- Create: `src/views/PackingView/styles/magazine.scss`

> 隐喻：刊物清单。粗线大字分类标题 + 黑色方框复选 □ / ✓。

- [ ] **Step 1: 组件**

```typescript
import { View, Text, Input } from '@tarojs/components'
import type { PackViewProps } from './shared'
import './styles/magazine.scss'

export default function PackMagazine(props: PackViewProps) {
  const { categories, packing, draftByCat, checkedCount, onDraftChange, onAdd, onToggle, onRemove, onOpenTemplate } = props
  return (
    <View className='pmg'>
      <View className='pmg-masthead'>
        <Text className='pmg-eyebrow'>PACKING · 清单</Text>
        <Text className='pmg-progress'>{checkedCount} / {packing.length}</Text>
        <View className='pmg-tpl' onClick={onOpenTemplate}>+ TEMPLATE</View>
      </View>
      <View className='pmg-rule' />

      {categories.map((cat) => {
        const items = packing.filter((p) => p.category === cat.id)
        return (
          <View key={cat.id} className='pmg-cat'>
            <Text className='pmg-cat-label'>{cat.label}</Text>
            <View className='pmg-rule-thin' />
            <View className='pmg-list'>
              {items.map((p) => (
                <View
                  key={p.id}
                  className={`pmg-row ${p.checked ? 'on' : ''}`}
                  onClick={() => onToggle(p.id)}
                  onLongPress={() => onRemove(p.id)}
                >
                  <Text className='pmg-check'>{p.checked ? '■' : '□'}</Text>
                  <Text className='pmg-name'>{p.label}</Text>
                </View>
              ))}
              <View className='pmg-add'>
                <Text className='pmg-check'>＋</Text>
                <Input
                  className='pmg-input'
                  value={draftByCat[cat.id] || ''}
                  placeholder='ADD ITEM…'
                  onInput={(e) => onDraftChange(cat.id, e.detail.value)}
                  onConfirm={() => onAdd(cat.id)}
                />
              </View>
            </View>
          </View>
        )
      })}
    </View>
  )
}
```

- [ ] **Step 2: 样式**

```scss
.pmg { padding: 24rpx; animation: fade-in 0.28s var(--ease-out) both; }
.pmg-masthead {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4rpx;
}
.pmg-eyebrow {
  font-size: 20rpx;
  letter-spacing: 6rpx;
  font-family: var(--font-display);
  color: var(--ink);
}
.pmg-progress {
  font-size: 28rpx;
  font-weight: 800;
  font-family: var(--font-mono);
  color: var(--accent);
}
.pmg-tpl {
  font-size: 20rpx;
  letter-spacing: 2rpx;
  border: 2rpx solid var(--ink);
  padding: 6rpx 14rpx;
}
.pmg-rule { height: 2rpx; background: var(--ink); margin: 12rpx 0 24rpx; }
.pmg-cat { margin-bottom: 32rpx; }
.pmg-cat-label {
  display: block;
  font-size: 36rpx;
  font-weight: 900;
  font-family: var(--font-display);
  color: var(--ink);
}
.pmg-rule-thin { height: 1rpx; background: var(--ink); margin: 8rpx 0 4rpx; }
.pmg-list { display: flex; flex-direction: column; }
.pmg-row, .pmg-add {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--line);
  font-size: 26rpx;
}
.pmg-row.on .pmg-name { text-decoration: line-through; color: var(--ink-3); }
.pmg-check {
  font-size: 24rpx;
  width: 36rpx;
  color: var(--ink);
  font-family: var(--font-mono);
}
.pmg-name { color: var(--ink); flex: 1; }
.pmg-input {
  flex: 1;
  font-size: 26rpx;
  color: var(--ink);
  letter-spacing: 2rpx;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/PackingView/PackMagazine.tsx src/views/PackingView/styles/magazine.scss
git commit -m "feat(packing): PackMagazine 清单卡"
```

---

## Task 4: PackPostcard（行李条）

**Files:**
- Create: `src/views/PackingView/PackPostcard.tsx`
- Create: `src/views/PackingView/styles/postcard.scss`

> 隐喻：航空行李条。每项一长条 + 条形码竖纹 + 圆形勾选戳。

- [ ] **Step 1: 组件**

```typescript
import { View, Text, Input } from '@tarojs/components'
import type { PackViewProps } from './shared'
import './styles/postcard.scss'

export default function PackPostcard(props: PackViewProps) {
  const { categories, packing, draftByCat, checkedCount, onDraftChange, onAdd, onToggle, onRemove, onOpenTemplate } = props
  return (
    <View className='ppp'>
      <View className='ppp-head'>
        <Text className='ppp-lab'>BAGGAGE / 行李 · {checkedCount} / {packing.length}</Text>
        <View className='ppp-tpl' onClick={onOpenTemplate}>导入模板</View>
      </View>

      {categories.map((cat) => {
        const items = packing.filter((p) => p.category === cat.id)
        return (
          <View key={cat.id} className='ppp-cat'>
            <Text className='ppp-cat-label'>{cat.label}</Text>
            {items.map((p) => (
              <View
                key={p.id}
                className={`ppp-tag ${p.checked ? 'on' : ''}`}
                onClick={() => onToggle(p.id)}
                onLongPress={() => onRemove(p.id)}
              >
                <View className='ppp-tag-stamp'>{p.checked ? '✓' : '○'}</View>
                <View className='ppp-tag-body'>
                  <Text className='ppp-tag-name'>{p.label}</Text>
                  <View className='ppp-tag-barcode'>
                    {Array.from({ length: 16 }).map((_, i) => (
                      <View key={i} className='ppp-bar' style={{ width: `${2 + (i % 4)}rpx` }} />
                    ))}
                  </View>
                </View>
              </View>
            ))}
            <View className='ppp-add'>
              <Input
                className='ppp-input'
                value={draftByCat[cat.id] || ''}
                placeholder='加一项…'
                onInput={(e) => onDraftChange(cat.id, e.detail.value)}
                onConfirm={() => onAdd(cat.id)}
              />
              <View className='ppp-add-btn' onClick={() => onAdd(cat.id)}>+</View>
            </View>
          </View>
        )
      })}
    </View>
  )
}
```

- [ ] **Step 2: 样式**

```scss
.ppp {
  padding: 24rpx;
  animation: fade-in 0.28s var(--ease-out) both;
  background:
    repeating-linear-gradient(45deg, transparent 0 24rpx, rgba(43,31,14,0.02) 24rpx 26rpx),
    var(--bg);
}
.ppp-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16rpx;
  border-bottom: 2rpx dashed var(--line-2);
  margin-bottom: 24rpx;
}
.ppp-lab {
  font-size: 22rpx;
  letter-spacing: 6rpx;
  font-family: var(--font-mono);
  color: var(--ink-2);
}
.ppp-tpl {
  padding: 8rpx 18rpx;
  border: 2rpx solid var(--accent);
  color: var(--accent);
  border-radius: var(--r-sm);
  font-size: 22rpx;
}
.ppp-cat { margin-bottom: 32rpx; }
.ppp-cat-label {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--ink);
  margin-bottom: 12rpx;
  letter-spacing: 2rpx;
}
.ppp-tag {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 20rpx;
  background: var(--surface);
  border-radius: var(--r-sm);
  margin-bottom: 8rpx;
  border-left: 6rpx solid var(--accent);
  transition: opacity 0.22s var(--ease-out);
}
.ppp-tag.on { opacity: 0.5; }
.ppp-tag-stamp {
  width: 60rpx; height: 60rpx;
  border: 3rpx solid var(--accent);
  border-radius: 50%;
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  flex-shrink: 0;
}
.ppp-tag-body { flex: 1; min-width: 0; }
.ppp-tag-name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 6rpx;
}
.ppp-tag-barcode {
  display: flex;
  gap: 2rpx;
  align-items: flex-end;
  height: 16rpx;
}
.ppp-bar { height: 100%; background: var(--ink-3); }
.ppp-add {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 20rpx;
  border: 2rpx dashed var(--line-2);
  border-radius: var(--r-sm);
}
.ppp-input { flex: 1; font-size: 26rpx; color: var(--ink); }
.ppp-add-btn {
  width: 44rpx; height: 44rpx;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/PackingView/PackPostcard.tsx src/views/PackingView/styles/postcard.scss
git commit -m "feat(packing): PackPostcard 行李条"
```

---

## Task 5: PackMinimal（勾选行）

**Files:**
- Create: `src/views/PackingView/PackMinimal.tsx`
- Create: `src/views/PackingView/styles/minimal.scss`

- [ ] **Step 1: 组件**

```typescript
import { View, Text, Input } from '@tarojs/components'
import type { PackViewProps } from './shared'
import './styles/minimal.scss'

export default function PackMinimal(props: PackViewProps) {
  const { categories, packing, draftByCat, checkedCount, onDraftChange, onAdd, onToggle, onRemove, onOpenTemplate } = props
  return (
    <View className='pmin'>
      <View className='pmin-head'>
        <Text className='pmin-eyebrow'>PACKING</Text>
        <Text className='pmin-progress'>{checkedCount} / {packing.length}</Text>
      </View>
      <View className='pmin-tpl' onClick={onOpenTemplate}>导入模板</View>

      {categories.map((cat) => {
        const items = packing.filter((p) => p.category === cat.id)
        return (
          <View key={cat.id} className='pmin-cat'>
            <Text className='pmin-cat-label'>{cat.label}</Text>
            {items.map((p) => (
              <View
                key={p.id}
                className={`pmin-row ${p.checked ? 'on' : ''}`}
                onClick={() => onToggle(p.id)}
                onLongPress={() => onRemove(p.id)}
              >
                <View className='pmin-box'>{p.checked && '✓'}</View>
                <Text className='pmin-name'>{p.label}</Text>
              </View>
            ))}
            <View className='pmin-add'>
              <View className='pmin-box pmin-box--add'>+</View>
              <Input
                className='pmin-input'
                value={draftByCat[cat.id] || ''}
                placeholder='添加…'
                onInput={(e) => onDraftChange(cat.id, e.detail.value)}
                onConfirm={() => onAdd(cat.id)}
              />
            </View>
          </View>
        )
      })}
    </View>
  )
}
```

- [ ] **Step 2: 样式**

```scss
.pmin {
  padding: 32rpx;
  animation: fade-in 0.28s var(--ease-out) both;
}
.pmin-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8rpx;
}
.pmin-eyebrow {
  font-size: 22rpx;
  letter-spacing: 8rpx;
  color: var(--ink-3);
  font-family: var(--font-display);
}
.pmin-progress {
  font-size: 36rpx;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--ink);
}
.pmin-tpl {
  font-size: 22rpx;
  color: var(--ink-3);
  margin-bottom: 32rpx;
  padding: 8rpx 0;
}
.pmin-cat { margin-bottom: 32rpx; }
.pmin-cat-label {
  display: block;
  font-size: 24rpx;
  letter-spacing: 4rpx;
  color: var(--ink-3);
  margin-bottom: 4rpx;
  padding-bottom: 8rpx;
  border-bottom: 1rpx solid var(--line);
}
.pmin-row, .pmin-add {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--line);
  font-size: 26rpx;
}
.pmin-row.on .pmin-name {
  text-decoration: line-through;
  color: var(--ink-3);
}
.pmin-box {
  width: 32rpx; height: 32rpx;
  border: 1rpx solid var(--ink-2);
  display: flex; align-items: center; justify-content: center;
  font-size: 22rpx;
  color: var(--ink);
  border-radius: 2rpx;
}
.pmin-box--add { border-style: dashed; color: var(--ink-3); }
.pmin-name { flex: 1; color: var(--ink); }
.pmin-input { flex: 1; font-size: 26rpx; color: var(--ink); }
```

- [ ] **Step 3: Commit**

```bash
git add src/views/PackingView/PackMinimal.tsx src/views/PackingView/styles/minimal.scss
git commit -m "feat(packing): PackMinimal 勾选行"
```

---

## Task 6: dispatcher

**Files:**
- Modify: `src/views/PackingView/index.tsx`
- Modify: `src/views/PackingView/index.scss`

- [ ] **Step 1: 重写 index.tsx 为 dispatcher**

替换 `src/views/PackingView/index.tsx`：

```typescript
import { useState } from 'react'
import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTripStore } from '../../store/trip-store'
import { useTheme } from '../../store/theme-store'
import { PACKING_CATEGORIES } from '../../data/packing'
import { uid } from '../../utils/id'
import TemplateImport from '../../components/TemplateImport'
import type { PackingItem } from '../../types/trip'
import PackTegami from './PackTegami'
import PackMagazine from './PackMagazine'
import PackPostcard from './PackPostcard'
import PackMinimal from './PackMinimal'
import type { PackViewProps } from './shared'
import './index.scss'

export default function PackingView() {
  const { state, dispatch } = useTripStore()
  const trip = state.trip!
  const { theme } = useTheme()
  const [draftByCat, setDraftByCat] = useState<Record<string, string>>({})
  const [tplOpen, setTplOpen] = useState(false)

  const setPacking = (next: PackingItem[]) =>
    dispatch({ type: 'UPDATE_TRIP', patch: { packing: next } })

  const toggle = (id: string) => {
    setPacking(trip.packing.map((p) => p.id === id ? { ...p, checked: !p.checked } : p))
  }
  const remove = async (id: string) => {
    const res = await Taro.showModal({ title: '删除该项？', confirmText: '删除', confirmColor: '#c43d3d' })
    if (res.confirm) setPacking(trip.packing.filter((p) => p.id !== id))
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

  const checkedCount = trip.packing.filter((p) => p.checked).length

  const props: PackViewProps = {
    categories: PACKING_CATEGORIES,
    packing: trip.packing,
    draftByCat,
    checkedCount,
    onDraftChange: (catId, value) => setDraftByCat({ ...draftByCat, [catId]: value }),
    onAdd: add,
    onToggle: toggle,
    onRemove: remove,
    onOpenTemplate: () => setTplOpen(true),
  }

  return (
    <View className='packing'>
      {theme === 'tegami'   && <PackTegami   {...props} />}
      {theme === 'magazine' && <PackMagazine {...props} />}
      {theme === 'postcard' && <PackPostcard {...props} />}
      {theme === 'minimal'  && <PackMinimal  {...props} />}

      <TemplateImport open={tplOpen} onClose={() => setTplOpen(false)} onImport={onImport} />
    </View>
  )
}
```

- [ ] **Step 2: 精简 index.scss**

Edit `src/views/PackingView/index.scss`：

把内容替换为：

```scss
.packing {
  /* 子组件自带 padding */
}
```

> 子组件已包含全部样式；index.scss 仅作为根容器占位。

- [ ] **Step 3: Commit**

```bash
git add src/views/PackingView/index.tsx src/views/PackingView/index.scss
git commit -m "feat(packing): PackingView dispatcher 接 4 主题"
```

---

## Task 7: 矩阵走查

**Files:** 仅验证

- [ ] **Step 1: 微信开发者工具 → trip → packing tab**

每主题验证：

| 主题 | 视觉 |
| --- | --- |
| 手帖 | chip 风格 + 圆形勾 + 暖橘填充已勾 + dashed 添加 |
| 刊物 | 大粗体分类标题 + 黑色 hairline + □/■ 复选 + 大写 ADD ITEM 输入 |
| 护照 | 斜纹底 + 行李条 + 圆形戳 + 条形码细纹 + 已勾透明 |
| 极简 | 极淡 hairline + 边框方框复选 + 删除线已勾文案 |

- [ ] **Step 2: 共用行为**

每主题：
- 加项：输入文字 → 回车 / + → 出现在该分类
- 勾选：点行/chip → 状态切换 + 进度数字更新
- 删除：长按 → showModal 确认
- 模板导入：点导入模板 → 弹 TemplateImport → 导入成功 toast

- [ ] **Step 3: 边界**

- 空 packing：4 主题下显示分类标题但无 row；输入加项正常
- 100+ items：滚动顺畅
- 模板导入后 packing 列表立即更新（state 触发）

---

## Task 8: 收尾

- [ ] **Step 1: codemap** 追加 PackingView 4 个子组件 + shared + styles

- [ ] **Step 2: Push**

```bash
git push
```

---

## Self-Review

- ✅ Spec § 7.5 4 主题 packing 版式 → Task 2, 3, 4, 5
- ✅ Spec § 9.4 4d → 本 plan
- ✅ 保留 toggle / remove / add / template import → Task 6 dispatcher

**关键决策：**

1. **不抽 PackingCategory 子组件**
   每主题的分类块结构差异较大（chip 网格 / 大字标题 / 行李条 / hairline 行）；强行抽公共组件会引入 variant prop 嵌套，反而难读。直接每主题展开 map 更清晰。

2. **TemplateImport 不主题化**
   它是弹层 sheet，跟随 token 漂移即可。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-26-phase4d-packing-view.md`. Subagent-Driven or Inline?**

---

## Phase 4 全部完成的下一步

Phase 4d 是 Phase 4 的最后一个 sub-PR。合并后整个 Phase 4 完成。

**Phase 5 范围：**
- 启用 AIInterview 替换 AIPlanForm
- 接入 AILoadingTheater 到所有 AI 入口（trip 页 + home 触发）
- TripAIStatusBar 接入（最小化态）
- 删除 AILoadingBar / AIPlanForm
- 主题预览缩略图（我的页主题卡用）
- 收尾清理（preview 页移除）

Phase 4d 合并后告诉我，我接着写 Phase 5 plan。
