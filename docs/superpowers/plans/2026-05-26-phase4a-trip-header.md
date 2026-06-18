# Phase 4a · Trip 页 Header 四主题 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 trip 页头部（`.trip-head` 块）按四主题各做一套版式：暖橘 hero / 双线刊头 / 牛皮纸盖戳 / 极简 hairline。同时把现有 `.th-ai-btn` 紫红 pill 替换为共享 `<AIBadge compact />`，保留 pax picker、CollaboratorsBar、菜单按钮、AILoadingBar 的所有功能。

**Architecture:** trip 页根仍是 `pages/trip/index.tsx`，把 `.trip-head` 抽成 `<TripHeader/>` 组件 + 4 个 variant 子组件（`TripHeaderTegami / Magazine / Postcard / Minimal`），由 `theme` 分发。子组件 props 统一（trip / isOwner / aiStatus / 各种回调），版式各自独立。

**Tech Stack:** Taro 4.x React + TypeScript + SCSS

**Spec:** [docs/superpowers/specs/2026-05-26-design-system-application-design.md](../specs/2026-05-26-design-system-application-design.md) § 7.2 + § 9.4

**Prerequisite:** Phase 1 + 2 + 3 已合并；`useTheme / AIBadge / BrandLogo` 可用

**Scope（明确范围）：**
- 改：trip 页 header 区域（`.trip-head` 整块）
- 不改：tab 栏（itinerary/map/budget/packing 切换）；4 个 view 子组件内部；AILoadingBar 引用（Phase 5 处理）；AI 流程时序（Phase 5）

**Testing reality:** 无单元测试框架；只发布微信小程序。冒烟全程用 `npm run dev:weapp` watch + 微信开发者工具，不跑 H5。

---

## File Structure

### 新增

| 路径 | 责任 |
| --- | --- |
| `src/pages/trip/TripHeader.tsx` | header dispatcher：按 theme 分发 4 个子组件 |
| `src/pages/trip/shared-header.ts` | 4 个 header 子组件共用 props 类型 |
| `src/pages/trip/TripHeaderTegami.tsx` | 手帖：暖橘 hero + 圆角 |
| `src/pages/trip/TripHeaderMagazine.tsx` | 刊物：双线刊头 + 大衬线标题 |
| `src/pages/trip/TripHeaderPostcard.tsx` | 护照：牛皮纸纸纹 + 入境戳 |
| `src/pages/trip/TripHeaderMinimal.tsx` | 极简：单行 eyebrow + 大字 hairline |
| `src/pages/trip/styles/header-tegami.scss` | 手帖样式 |
| `src/pages/trip/styles/header-magazine.scss` | 刊物样式 |
| `src/pages/trip/styles/header-postcard.scss` | 护照样式 |
| `src/pages/trip/styles/header-minimal.scss` | 极简样式 |

### 修改

| 路径 | 改动 |
| --- | --- |
| `src/pages/trip/index.tsx` | header 区域换成 `<TripHeader/>`；`.th-ai-btn` 替换为 `<AIBadge compact/>` |
| `src/pages/trip/index.scss` | 删除 `.trip-head / .th-row / .th-name / .th-meta / .th-ai-btn` 等被 header 子组件接管的选择器；保留 trip-content / trip-tabs 等 |

### 不动

- 4 个 view 子组件（ItineraryView / MapView / BudgetView / PackingView）— Phase 4b–e
- AILoadingBar — Phase 5
- CollaboratorsBar — 沿用，挂到 header 子组件内
- TripActionSheet / ShareTypeSheet / CollaboratorsSheet — 沿用

---

## Task 0: 前置基线检查

- [ ] **Step 1: Phase 1+2+3 已合并**

Run:
```bash
cd /Users/jinchi/Documents/行迹 && git status && git log --oneline -10
```
Expected: 工作树干净；近期 commits 含 Phase 3 home 四主题 + Phase 2 AIBadge

- [ ] **Step 2: 共享组件可用**

Run: `ls src/components/AIBadge src/components/BrandLogo`
Expected: 都存在

- [ ] **Step 3: 启动 weapp dev**

Run: `npm run dev:weapp`（watch 保持运行）
微信开发者工具 → 编译 → 任一 trip 页打开正常（header 含 trip 名 / AI 按钮 / 菜单 / pax / 协作条）。

---

## Task 1: 共享 props 类型

**Files:**
- Create: `src/pages/trip/shared-header.ts`

- [ ] **Step 1: 创建共享类型**

Create `src/pages/trip/shared-header.ts`：

```typescript
import type { Trip } from '../../types/trip'

export type TripAIHeaderStatus = 'generating' | 'ready' | 'error' | null | undefined

/** 4 个 TripHeader 子组件共用 props */
export interface TripHeaderViewProps {
  trip: Trip
  isOwner: boolean
  aiStatus: TripAIHeaderStatus
  /** AI 按钮点击（disabled 状态时父组件已处理 toast 提示） */
  onAITap: () => void
  /** AI loading bar 点击（与现有 handleBarTap 等价） */
  onAIBarTap: () => void
  /** 右上角菜单按钮（⋯）点击 → 打开 ActionSheet */
  onMenuTap: () => void
  /** 返回按钮 */
  onBack: () => void
  /** pax 改变 */
  onPaxChange: (pax: number) => void
  /** 协作者条点击 */
  onCollabTap: () => void
}

/** 标准化 trip.aiStatus 到 AIBadge 可消费的 status */
export function badgeStatusOf(s: TripAIHeaderStatus): 'idle' | 'thinking' | 'ready' | 'error' {
  if (s === 'generating') return 'thinking'
  if (s === 'ready') return 'ready'
  if (s === 'error') return 'error'
  return 'idle'
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit 2>&1 | grep "shared-header" | head -5`
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add src/pages/trip/shared-header.ts
git commit -m "feat(trip): TripHeader 子组件共用 props 类型"
```

---

## Task 2: TripHeaderTegami（手帖）

**Files:**
- Create: `src/pages/trip/TripHeaderTegami.tsx`
- Create: `src/pages/trip/styles/header-tegami.scss`

> 隐喻：明信片背面手写感。暖橘 hero block + 大圆角 + trip 名手写衬线 + 暖色辅助条。

- [ ] **Step 1: 创建子组件**

Create `src/pages/trip/TripHeaderTegami.tsx`：

```typescript
import { View, Text, Picker } from '@tarojs/components'
import AIBadge from '../../components/AIBadge'
import AILoadingBar from '../../components/AILoadingBar'
import CollaboratorsBar from '../../components/CollaboratorsBar'
import type { TripHeaderViewProps } from './shared-header'
import { badgeStatusOf } from './shared-header'
import './styles/header-tegami.scss'

const PAX_OPTIONS = Array.from({ length: 99 }, (_, i) => `${i + 1} 人`)

export default function TripHeaderTegami({
  trip, isOwner, aiStatus, onAITap, onAIBarTap, onMenuTap, onBack, onPaxChange, onCollabTap,
}: TripHeaderViewProps) {
  const showAI = isOwner && !aiStatus
  const startDate = trip.days[0]?.date || trip.startDate
  const endDate = trip.days[trip.days.length - 1]?.date || trip.endDate

  return (
    <View className='thtg'>
      <View className='thtg-bar'>
        <View className='thtg-back' onClick={onBack}>‹</View>
        <Text className='thtg-issue'>HANDWRITTEN · 2026</Text>
        <View className='thtg-menu' onClick={onMenuTap}>⋯</View>
      </View>

      <View className='thtg-hero'>
        <View className='thtg-hero-bg' />
        <View className='thtg-hero-body'>
          <Text className='thtg-name'>{trip.name}</Text>
          <View className='thtg-meta'>
            <Text>{startDate} → {endDate}</Text>
            <Text className='thtg-dot'>·</Text>
            <Text>{trip.days.length || 0} 天</Text>
            <Text className='thtg-dot'>·</Text>
            <Picker
              mode='selector'
              range={PAX_OPTIONS}
              value={Math.max(0, Math.min(98, (trip.pax || 1) - 1))}
              onChange={(e) => {
                const next = Number(e.detail.value) + 1
                if (next !== trip.pax) onPaxChange(next)
              }}
            >
              <Text className='thtg-pax-edit'>{trip.pax} 人 ▾</Text>
            </Picker>
          </View>
        </View>
        {showAI && (
          <View className='thtg-ai'>
            <AIBadge status='idle' size='compact' label='AI 规划' onClick={onAITap} />
          </View>
        )}
      </View>

      {isOwner && aiStatus && (
        <View className='thtg-ai-bar'>
          <AILoadingBar
            status={aiStatus as 'generating' | 'ready' | 'error'}
            onTap={onAIBarTap}
          />
        </View>
      )}

      <CollaboratorsBar
        collaborators={trip.collaborators || []}
        ownerNickname={trip.ownerNickname}
        isOwner={isOwner}
        onTap={onCollabTap}
      />
    </View>
  )
}
```

- [ ] **Step 2: 创建样式**

Create `src/pages/trip/styles/header-tegami.scss`：

```scss
.thtg {
  padding: 16rpx 24rpx 8rpx;
  animation: page-in 0.36s var(--ease-out) both;
}

.thtg-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0 16rpx;
}
.thtg-back {
  width: 56rpx; height: 56rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 36rpx;
  color: var(--ink-2);
  border-radius: 50%;
}
.thtg-back:active { background: var(--accent-bg); }
.thtg-issue {
  font-size: 20rpx;
  letter-spacing: 6rpx;
  color: var(--ink-3);
  font-family: var(--font-mono);
}
.thtg-menu {
  width: 56rpx; height: 56rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 40rpx;
  color: var(--ink-2);
  border-radius: 50%;
}
.thtg-menu:active { background: var(--accent-bg); }

.thtg-hero {
  position: relative;
  padding: 32rpx 32rpx 36rpx;
  border-radius: var(--r-xl);
  overflow: hidden;
  margin-bottom: 16rpx;
}
.thtg-hero-bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(120% 80% at 100% 0%, rgba(255, 154, 77, 0.42) 0%, transparent 60%),
    radial-gradient(80% 50% at 0% 100%, rgba(255, 194, 71, 0.32) 0%, transparent 60%),
    var(--surface);
  z-index: 0;
}
.thtg-hero-body { position: relative; z-index: 1; padding-right: 160rpx; }
.thtg-name {
  display: block;
  font-size: 52rpx;
  font-weight: 800;
  font-family: var(--font-display);
  color: var(--ink);
  letter-spacing: 2rpx;
  line-height: 1.15;
  margin-bottom: 16rpx;
}
.thtg-meta {
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
  align-items: center;
  font-size: 22rpx;
  font-family: var(--font-mono);
  color: var(--ink-2);
  letter-spacing: 1rpx;
}
.thtg-dot { color: var(--ink-3); }
.thtg-pax-edit {
  color: var(--accent);
  font-weight: 600;
}

.thtg-ai {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  z-index: 2;
}

.thtg-ai-bar {
  margin: 0 0 16rpx;
}
```

- [ ] **Step 3: 编译验证**

watch 自动重编
Expected: 编译成功

- [ ] **Step 4: Commit**

```bash
git add src/pages/trip/TripHeaderTegami.tsx src/pages/trip/styles/header-tegami.scss
git commit -m "feat(trip): TripHeaderTegami 手帖暖橘 hero"
```

---

## Task 3: TripHeaderMagazine（刊物）

**Files:**
- Create: `src/pages/trip/TripHeaderMagazine.tsx`
- Create: `src/pages/trip/styles/header-magazine.scss`

> 隐喻：杂志栏目页。双线分割 + 期号小字 + 衬线大标题 + 黑色 hairline meta。

- [ ] **Step 1: 创建子组件**

Create `src/pages/trip/TripHeaderMagazine.tsx`：

```typescript
import { View, Text, Picker } from '@tarojs/components'
import AIBadge from '../../components/AIBadge'
import AILoadingBar from '../../components/AILoadingBar'
import CollaboratorsBar from '../../components/CollaboratorsBar'
import type { TripHeaderViewProps } from './shared-header'
import './styles/header-magazine.scss'

const PAX_OPTIONS = Array.from({ length: 99 }, (_, i) => `${i + 1} 人`)

export default function TripHeaderMagazine({
  trip, isOwner, aiStatus, onAITap, onAIBarTap, onMenuTap, onBack, onPaxChange, onCollabTap,
}: TripHeaderViewProps) {
  const showAI = isOwner && !aiStatus
  const startDate = trip.days[0]?.date || trip.startDate
  const endDate = trip.days[trip.days.length - 1]?.date || trip.endDate
  const issueNo = String((trip._id || '').slice(-3).toUpperCase() || '000')

  return (
    <View className='thmg'>
      <View className='thmg-topbar'>
        <View className='thmg-back' onClick={onBack}>← back</View>
        <Text className='thmg-issueno'>VOL. {issueNo}</Text>
        <View className='thmg-menu' onClick={onMenuTap}>⋯</View>
      </View>

      <View className='thmg-rule thmg-rule-thick' />
      <Text className='thmg-strap'>EDITORIAL · TRAVEL · PERSONAL</Text>
      <View className='thmg-rule' />

      <View className='thmg-titleblock'>
        <Text className='thmg-name'>{trip.name}</Text>
        <View className='thmg-meta'>
          <Text>{startDate} → {endDate}</Text>
          <Text>·</Text>
          <Text>{trip.days.length || 0} DAYS</Text>
          <Text>·</Text>
          <Picker
            mode='selector'
            range={PAX_OPTIONS}
            value={Math.max(0, Math.min(98, (trip.pax || 1) - 1))}
            onChange={(e) => {
              const next = Number(e.detail.value) + 1
              if (next !== trip.pax) onPaxChange(next)
            }}
          >
            <Text className='thmg-pax-edit'>{trip.pax} PAX ▾</Text>
          </Picker>
        </View>
      </View>

      {showAI && (
        <View className='thmg-ai'>
          <AIBadge status='idle' size='compact' label='AI 规划' onClick={onAITap} />
        </View>
      )}

      {isOwner && aiStatus && (
        <View className='thmg-ai-bar'>
          <AILoadingBar
            status={aiStatus as 'generating' | 'ready' | 'error'}
            onTap={onAIBarTap}
          />
        </View>
      )}

      <View className='thmg-rule' />

      <CollaboratorsBar
        collaborators={trip.collaborators || []}
        ownerNickname={trip.ownerNickname}
        isOwner={isOwner}
        onTap={onCollabTap}
      />
    </View>
  )
}
```

- [ ] **Step 2: 创建样式**

Create `src/pages/trip/styles/header-magazine.scss`：

```scss
.thmg {
  padding: 16rpx 24rpx 8rpx;
  animation: page-in 0.36s var(--ease-out) both;
  background: var(--bg);
}

.thmg-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0 12rpx;
}
.thmg-back {
  font-size: 22rpx;
  letter-spacing: 4rpx;
  font-family: var(--font-mono);
  color: var(--ink);
  padding: 8rpx 0;
}
.thmg-back:active { opacity: 0.6; }
.thmg-issueno {
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 6rpx;
  font-family: var(--font-mono);
  color: var(--ink);
}
.thmg-menu {
  font-size: 36rpx;
  color: var(--ink);
  padding: 0 8rpx;
}

.thmg-rule {
  height: 1rpx;
  background: var(--ink);
  margin: 8rpx 0;
}
.thmg-rule-thick {
  height: 4rpx;
}
.thmg-strap {
  display: block;
  text-align: center;
  font-size: 18rpx;
  letter-spacing: 10rpx;
  font-family: var(--font-display);
  color: var(--ink-2);
  padding: 4rpx 0;
}

.thmg-titleblock {
  position: relative;
  padding: 32rpx 0 24rpx;
  padding-right: 180rpx;
}
.thmg-name {
  display: block;
  font-size: 64rpx;
  font-weight: 900;
  font-family: var(--font-display);
  line-height: 1.05;
  color: var(--ink);
  margin-bottom: 20rpx;
}
.thmg-meta {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  font-size: 22rpx;
  font-family: var(--font-mono);
  letter-spacing: 2rpx;
  color: var(--ink-2);
}
.thmg-pax-edit {
  color: var(--accent);
  font-weight: 700;
}

.thmg-ai {
  position: absolute;
  top: 0;
  right: 0;
}
/* fallback: 父级 .thmg-titleblock 是 relative，把 AI 绝对定位过去 */
.thmg .thmg-titleblock .thmg-ai,
.thmg > .thmg-ai {
  position: absolute;
}

.thmg-ai-bar {
  margin: 0 0 12rpx;
}
```

> 注：`.thmg-ai` 绝对定位到 `.thmg-titleblock` 右上。把 `.thmg-ai` 放到 titleblock 内部即可（上面 JSX 里 `.thmg-ai` 是 titleblock 的兄弟节点，但定位仍以 `.thmg` 为参照即可；如视觉偏差，把 `<View className='thmg-ai'>` 挪到 `</View>` 前作为 titleblock 的最后子元素，使用 `position: absolute; top: 0; right: 0;`）。

实际把 `.thmg-ai` 放在 `<View className='thmg-titleblock'>` 内最后：

> 调整 JSX：把
> ```tsx
> </View>
> {showAI && (
>   <View className='thmg-ai'>...
> ```
> 改成（紧贴 thmg-titleblock 内部尾部）：
> ```tsx
>   {showAI && (
>     <View className='thmg-ai'>
>       <AIBadge status='idle' size='compact' label='AI 规划' onClick={onAITap} />
>     </View>
>   )}
> </View>
> ```

并把 SCSS 的 `.thmg-ai` 选择器改为：

```scss
.thmg-titleblock { position: relative; }
.thmg-titleblock .thmg-ai {
  position: absolute;
  top: 0;
  right: 0;
}
```

完成后删除前面 SCSS 中 `.thmg .thmg-titleblock .thmg-ai, .thmg > .thmg-ai` 那段冗余 fallback。

- [ ] **Step 3: 编译验证**

watch 自动重编
Expected: 编译成功

- [ ] **Step 4: Commit**

```bash
git add src/pages/trip/TripHeaderMagazine.tsx src/pages/trip/styles/header-magazine.scss
git commit -m "feat(trip): TripHeaderMagazine 双线刊头"
```

---

## Task 4: TripHeaderPostcard（护照）

**Files:**
- Create: `src/pages/trip/TripHeaderPostcard.tsx`
- Create: `src/pages/trip/styles/header-postcard.scss`

> 隐喻：护照内页签证页。牛皮纸纹底 + 椭圆"已入境"戳 + 旅人编号 + 中规中矩的英文 + 中文小字。

- [ ] **Step 1: 创建子组件**

Create `src/pages/trip/TripHeaderPostcard.tsx`：

```typescript
import { View, Text, Picker } from '@tarojs/components'
import AIBadge from '../../components/AIBadge'
import AILoadingBar from '../../components/AILoadingBar'
import CollaboratorsBar from '../../components/CollaboratorsBar'
import type { TripHeaderViewProps } from './shared-header'
import './styles/header-postcard.scss'

const PAX_OPTIONS = Array.from({ length: 99 }, (_, i) => `${i + 1} 人`)

export default function TripHeaderPostcard({
  trip, isOwner, aiStatus, onAITap, onAIBarTap, onMenuTap, onBack, onPaxChange, onCollabTap,
}: TripHeaderViewProps) {
  const showAI = isOwner && !aiStatus
  const startDate = trip.days[0]?.date || trip.startDate
  const endDate = trip.days[trip.days.length - 1]?.date || trip.endDate
  const destShort = (trip.destinations?.[0]?.name) || ''

  return (
    <View className='thpp'>
      <View className='thpp-paper'>
        <View className='thpp-paper-grain' />

        <View className='thpp-topbar'>
          <View className='thpp-back' onClick={onBack}>‹</View>
          <Text className='thpp-eyebrow'>VISA / 签 证</Text>
          <View className='thpp-menu' onClick={onMenuTap}>⋯</View>
        </View>

        <View className='thpp-body'>
          <View className='thpp-titleblock'>
            <Text className='thpp-name'>{trip.name}</Text>
            <View className='thpp-meta-grid'>
              <View className='thpp-meta-row'>
                <Text className='thpp-meta-l'>FROM</Text>
                <Text className='thpp-meta-v'>{startDate}</Text>
              </View>
              <View className='thpp-meta-row'>
                <Text className='thpp-meta-l'>TO</Text>
                <Text className='thpp-meta-v'>{endDate}</Text>
              </View>
              <View className='thpp-meta-row'>
                <Text className='thpp-meta-l'>DAYS</Text>
                <Text className='thpp-meta-v'>{trip.days.length || 0}</Text>
              </View>
              <View className='thpp-meta-row'>
                <Text className='thpp-meta-l'>PAX</Text>
                <Picker
                  mode='selector'
                  range={PAX_OPTIONS}
                  value={Math.max(0, Math.min(98, (trip.pax || 1) - 1))}
                  onChange={(e) => {
                    const next = Number(e.detail.value) + 1
                    if (next !== trip.pax) onPaxChange(next)
                  }}
                >
                  <Text className='thpp-meta-v thpp-meta-edit'>{trip.pax} ▾</Text>
                </Picker>
              </View>
            </View>
          </View>

          <View className='thpp-stamp'>
            <Text className='thpp-stamp-l1'>已入境</Text>
            <Text className='thpp-stamp-l2'>{destShort.toUpperCase()}</Text>
            <Text className='thpp-stamp-l3'>XC · 2026</Text>
          </View>
        </View>

        {showAI && (
          <View className='thpp-ai'>
            <AIBadge status='idle' size='compact' label='AI 规划' onClick={onAITap} />
          </View>
        )}
      </View>

      {isOwner && aiStatus && (
        <View className='thpp-ai-bar'>
          <AILoadingBar
            status={aiStatus as 'generating' | 'ready' | 'error'}
            onTap={onAIBarTap}
          />
        </View>
      )}

      <CollaboratorsBar
        collaborators={trip.collaborators || []}
        ownerNickname={trip.ownerNickname}
        isOwner={isOwner}
        onTap={onCollabTap}
      />
    </View>
  )
}
```

- [ ] **Step 2: 创建样式**

Create `src/pages/trip/styles/header-postcard.scss`：

```scss
.thpp {
  padding: 16rpx 24rpx 8rpx;
  animation: page-in 0.36s var(--ease-out) both;
}

.thpp-paper {
  position: relative;
  padding: 16rpx 24rpx 32rpx;
  background: var(--surface);
  border: 2rpx solid var(--line-2);
  border-radius: var(--r-md);
  overflow: hidden;
  margin-bottom: 16rpx;
}
.thpp-paper-grain {
  position: absolute; inset: 0;
  background:
    repeating-linear-gradient(45deg, transparent 0 24rpx, rgba(43,31,14,0.025) 24rpx 26rpx),
    repeating-linear-gradient(-45deg, transparent 0 24rpx, rgba(43,31,14,0.02) 24rpx 26rpx);
  pointer-events: none;
}

.thpp-topbar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4rpx 0 8rpx;
  border-bottom: 1rpx dashed var(--line-2);
}
.thpp-back {
  width: 56rpx; height: 56rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 36rpx;
  color: var(--ink-2);
}
.thpp-eyebrow {
  font-size: 22rpx;
  letter-spacing: 8rpx;
  font-family: var(--font-mono);
  color: var(--ink-2);
}
.thpp-menu {
  width: 56rpx; height: 56rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 40rpx;
  color: var(--ink-2);
}

.thpp-body {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 24rpx;
  padding-top: 24rpx;
}

.thpp-titleblock { flex: 1; min-width: 0; }
.thpp-name {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  font-family: var(--font-display);
  color: var(--ink);
  margin-bottom: 24rpx;
  line-height: 1.15;
}

.thpp-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx 24rpx;
}
.thpp-meta-row {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
}
.thpp-meta-l {
  font-size: 18rpx;
  letter-spacing: 4rpx;
  font-family: var(--font-mono);
  color: var(--ink-3);
}
.thpp-meta-v {
  font-size: 24rpx;
  font-weight: 600;
  font-family: var(--font-display);
  color: var(--ink);
}
.thpp-meta-edit {
  color: var(--accent);
}

.thpp-stamp {
  position: relative;
  width: 180rpx;
  height: 180rpx;
  border: 4rpx solid var(--accent);
  border-radius: 50%;
  color: var(--accent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: rotate(-12deg);
  background: rgba(255, 252, 243, 0.5);
  animation: stamp-down 0.6s var(--ease-spring) both;
  flex-shrink: 0;
}
.thpp-stamp-l1 {
  font-size: 24rpx;
  font-weight: 800;
  font-family: var(--font-display);
}
.thpp-stamp-l2 {
  font-size: 18rpx;
  letter-spacing: 3rpx;
  font-family: var(--font-mono);
  margin: 4rpx 0;
  max-width: 140rpx;
  overflow: hidden;
}
.thpp-stamp-l3 {
  font-size: 16rpx;
  letter-spacing: 2rpx;
  font-family: var(--font-mono);
  opacity: 0.7;
}

.thpp-ai {
  position: absolute;
  bottom: 16rpx;
  right: 16rpx;
  z-index: 2;
}

.thpp-ai-bar {
  margin: 0 0 16rpx;
}
```

- [ ] **Step 3: 编译验证**

watch 自动重编
Expected: 编译成功

- [ ] **Step 4: Commit**

```bash
git add src/pages/trip/TripHeaderPostcard.tsx src/pages/trip/styles/header-postcard.scss
git commit -m "feat(trip): TripHeaderPostcard 牛皮纸 + 入境戳"
```

---

## Task 5: TripHeaderMinimal（极简）

**Files:**
- Create: `src/pages/trip/TripHeaderMinimal.tsx`
- Create: `src/pages/trip/styles/header-minimal.scss`

> 隐喻：极简清单标题。eyebrow + 巨字 trip 名 + 极淡 hairline meta；AI 按钮中性灰。

- [ ] **Step 1: 创建子组件**

Create `src/pages/trip/TripHeaderMinimal.tsx`：

```typescript
import { View, Text, Picker } from '@tarojs/components'
import AIBadge from '../../components/AIBadge'
import AILoadingBar from '../../components/AILoadingBar'
import CollaboratorsBar from '../../components/CollaboratorsBar'
import type { TripHeaderViewProps } from './shared-header'
import './styles/header-minimal.scss'

const PAX_OPTIONS = Array.from({ length: 99 }, (_, i) => `${i + 1} 人`)

export default function TripHeaderMinimal({
  trip, isOwner, aiStatus, onAITap, onAIBarTap, onMenuTap, onBack, onPaxChange, onCollabTap,
}: TripHeaderViewProps) {
  const showAI = isOwner && !aiStatus
  const startDate = trip.days[0]?.date || trip.startDate
  const endDate = trip.days[trip.days.length - 1]?.date || trip.endDate

  return (
    <View className='thmin'>
      <View className='thmin-bar'>
        <View className='thmin-back' onClick={onBack}>‹</View>
        <View className='thmin-menu' onClick={onMenuTap}>⋯</View>
      </View>

      <Text className='thmin-eyebrow'>CHRONICLE</Text>
      <Text className='thmin-name'>{trip.name}</Text>

      <View className='thmin-meta'>
        <Text>{startDate} → {endDate}</Text>
        <Text>·</Text>
        <Text>{trip.days.length || 0} 天</Text>
        <Text>·</Text>
        <Picker
          mode='selector'
          range={PAX_OPTIONS}
          value={Math.max(0, Math.min(98, (trip.pax || 1) - 1))}
          onChange={(e) => {
            const next = Number(e.detail.value) + 1
            if (next !== trip.pax) onPaxChange(next)
          }}
        >
          <Text className='thmin-pax-edit'>{trip.pax} 人 ▾</Text>
        </Picker>
      </View>

      {showAI && (
        <View className='thmin-ai'>
          <AIBadge status='idle' size='compact' label='AI 规划' onClick={onAITap} />
        </View>
      )}

      {isOwner && aiStatus && (
        <View className='thmin-ai-bar'>
          <AILoadingBar
            status={aiStatus as 'generating' | 'ready' | 'error'}
            onTap={onAIBarTap}
          />
        </View>
      )}

      <View className='thmin-rule' />

      <CollaboratorsBar
        collaborators={trip.collaborators || []}
        ownerNickname={trip.ownerNickname}
        isOwner={isOwner}
        onTap={onCollabTap}
      />
    </View>
  )
}
```

- [ ] **Step 2: 创建样式**

Create `src/pages/trip/styles/header-minimal.scss`：

```scss
.thmin {
  padding: 16rpx 32rpx 8rpx;
  animation: page-in 0.36s var(--ease-out) both;
  position: relative;
}

.thmin-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8rpx 0 24rpx;
}
.thmin-back {
  width: 56rpx; height: 56rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 36rpx;
  color: var(--ink-2);
}
.thmin-back:active { opacity: 0.5; }
.thmin-menu {
  width: 56rpx; height: 56rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 40rpx;
  color: var(--ink-2);
}

.thmin-eyebrow {
  display: block;
  font-size: 22rpx;
  letter-spacing: 8rpx;
  color: var(--ink-3);
  font-family: var(--font-display);
  margin-bottom: 16rpx;
}
.thmin-name {
  display: block;
  font-size: 60rpx;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--ink);
  line-height: 1.05;
  letter-spacing: -1rpx;
  margin-bottom: 20rpx;
}
.thmin-meta {
  display: flex;
  gap: 10rpx;
  font-size: 24rpx;
  color: var(--ink-3);
  font-family: var(--font-mono);
  letter-spacing: 1rpx;
}
.thmin-pax-edit { color: var(--ink); }

.thmin-ai {
  position: absolute;
  top: 16rpx;
  right: 32rpx;
}

.thmin-ai-bar {
  margin: 16rpx 0;
}

.thmin-rule {
  height: 1rpx;
  background: var(--line);
  margin: 32rpx 0 16rpx;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/trip/TripHeaderMinimal.tsx src/pages/trip/styles/header-minimal.scss
git commit -m "feat(trip): TripHeaderMinimal 极简清单标题"
```

---

## Task 6: TripHeader dispatcher

**Files:**
- Create: `src/pages/trip/TripHeader.tsx`

- [ ] **Step 1: 创建 dispatcher**

Create `src/pages/trip/TripHeader.tsx`：

```typescript
import { useTheme } from '../../store/theme-store'
import type { TripHeaderViewProps } from './shared-header'
import TripHeaderTegami from './TripHeaderTegami'
import TripHeaderMagazine from './TripHeaderMagazine'
import TripHeaderPostcard from './TripHeaderPostcard'
import TripHeaderMinimal from './TripHeaderMinimal'

export default function TripHeader(props: TripHeaderViewProps) {
  const { theme } = useTheme()
  if (theme === 'magazine') return <TripHeaderMagazine {...props} />
  if (theme === 'postcard') return <TripHeaderPostcard {...props} />
  if (theme === 'minimal')  return <TripHeaderMinimal {...props} />
  return <TripHeaderTegami {...props} />
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/trip/TripHeader.tsx
git commit -m "feat(trip): TripHeader theme dispatcher"
```

---

## Task 7: trip/index.tsx 接通 TripHeader

**Files:**
- Modify: `src/pages/trip/index.tsx`
- Modify: `src/pages/trip/index.scss`

- [ ] **Step 1: 引入 TripHeader 并替换 header 区**

Edit `src/pages/trip/index.tsx`：

- 顶部 import 区加：
  ```typescript
  import TripHeader from './TripHeader'
  ```
- 找到现有 `<View className='trip-head'>...</View>` 整块（约 L256–L300，含 th-row / th-name / th-ai-btn / th-menu / th-ai-bar / th-meta / pax Picker / CollaboratorsBar）
- 整块替换为：

```tsx
<TripHeader
  trip={t}
  isOwner={isOwner}
  aiStatus={t.aiStatus as 'generating' | 'ready' | 'error' | null | undefined}
  onAITap={handleAiButtonTap}
  onAIBarTap={handleBarTap}
  onMenuTap={() => setActionOpen(true)}
  onBack={() => Taro.navigateBack().catch(() => Taro.reLaunch({ url: '/pages/home/index' }))}
  onPaxChange={(next) => dispatch({ type: 'UPDATE_TRIP', patch: { pax: next } })}
  onCollabTap={() => setCollabSheetOpen(true)}
/>
```

> 注：
> - 现有 `handleAiButtonTap` 已处理 `t.aiStatus` 非空时的 disabled / toast 提示，沿用即可
> - `Taro.navigateBack` 在小程序场景下若是从首页跳来的 navigateTo，可以正常返回；如果是 reLaunch 进入需要 fallback 到首页

- [ ] **Step 2: 移除 import { Picker } from '@tarojs/components'（如已未使用）**

Run:
```bash
grep -n "Picker" src/pages/trip/index.tsx
```
Expected: 若只剩 import 行，删 import 中的 `Picker`；若仍被使用（如 dispatch 写法不同），保留。

- [ ] **Step 3: 移除已迁出的样式**

Edit `src/pages/trip/index.scss`：

删除以下选择器（已被 4 个子组件接管）：
- `.trip-head`
- `.th-row`
- `.th-name`
- `.th-meta`
- `.th-ai-btn`
- `.th-ai-btn-disabled`
- `.th-ai-bar`
- `.th-menu`
- `.th-pax-edit`
- `.trip.theme-tegami`（Phase 1 已删，确认不在）

保留：
- `.trip` 根 / `.trip-content` / `.trip-tabs` / `.tt-item` 等 tab 相关
- 任何 view 内的样式

- [ ] **Step 4: 编译 + 修补类型**

watch 重编。若 tsc 报 `Picker` / 未使用变量错误，按提示删 import。
Expected: 编译成功

- [ ] **Step 5: 微信开发者工具冒烟 · 四主题切换**

进 trip 页（任一示例攻略），我的页切主题轮一遍：

| 主题 | 关键验证点 |
| --- | --- |
| 手帖 | 暖橘 hero card 圆角；AI 按钮右上贴角；点击/长按反馈正常 |
| 刊物 | 双线（4rpx + 1rpx）+ `EDITORIAL · TRAVEL · PERSONAL` 中点；大衬线标题 64rpx；右上 AI |
| 护照 | 牛皮纸纸纹（45° 双向线）；右侧椭圆"已入境"戳 rotate(-12deg)；FROM / TO / DAYS / PAX 2×2 网格 |
| 极简 | eyebrow `CHRONICLE` + 60rpx 大字；下方一条 hairline；AI 中性灰小 pill |

所有主题共用：
- 返回按钮 → 回首页 / navigateBack
- AI 按钮 → 与之前 `handleAiButtonTap` 等效
- AI loading bar → 与之前等效（thinking/ready/error 文案）
- pax 改值 → 落库（observe trip-store watch）
- 协作条点击 → 协作者 Sheet 打开
- ⋯ 菜单 → ActionSheet 打开（重命名 / 复制 / 分享 / 删除）

- [ ] **Step 6: Commit**

```bash
git add src/pages/trip/index.tsx src/pages/trip/index.scss
git commit -m "feat(trip): trip 页 header 接 TripHeader dispatcher"
```

---

## Task 8: 矩阵走查 + 边界冒烟

**Files:** 仅验证

- [ ] **Step 1: 4 主题 × 3 lifecycle × AI 状态 矩阵**

每个主题下：

| 场景 | 验证 |
| --- | --- |
| trip 刚建无 aiStatus | 右上角 AI 按钮显示 |
| aiStatus='generating' | AI 按钮隐藏（showAI = isOwner && !aiStatus）；AILoadingBar 显示在 header 下方 |
| aiStatus='ready' | AI 按钮隐藏；AILoadingBar 显示「AI 草稿就绪 · 点击查看」 |
| aiStatus='error' | AI 按钮隐藏；AILoadingBar 显示错误 |
| 非 owner | AI 按钮不显示；AILoadingBar 不显示 |

- [ ] **Step 2: 协作者条**

切到一个有 collaborators 的 trip（或临时 join 一个）：
- 4 主题下协作者条均显示
- 点击 → 协作者 sheet 弹出

- [ ] **Step 3: ActionSheet**

每主题下：⋯ 菜单 → 重命名 / 复制 / 分享 / 删除 全部可点；删除流程会回首页

- [ ] **Step 4: pax Picker**

每主题下 → 点 "X 人 ▾" → Picker 弹起 → 选新人数 → header 立即更新数字 → trip-store watch 落库

- [ ] **Step 5: 不同 trip 名长度**

- 短名（2 字）：4 主题不留过大空白
- 长名（20+ 字）：换行不撞 AI 按钮（已留 padding-right 160-180rpx）

---

## Task 9: 收尾

- [ ] **Step 1: codemap 同步（如有）**

若 `docs/codemap.md` 维护组件清单，追加：
- `src/pages/trip/TripHeader*` 5 个文件
- `src/pages/trip/styles/header-*.scss` 4 个文件
- `src/pages/trip/shared-header.ts`

- [ ] **Step 2: 推分支**

```bash
git push
```

---

## Self-Review 结果

- ✅ Spec § 7.2 trip 页 4 主题 header → Task 2, 3, 4, 5
- ✅ Spec § 6.1.2 AIBadge 在 trip 页用 compact → Task 2–5 各自接入
- ✅ Spec § 9.4 4a：trip 页 header 4 套 → 本 plan
- ✅ 现有功能保留：pax / collaborators / menu / AILoadingBar → Task 2–5 内
- ⚠️ Spec § 7.2 中"倒计时大字"（pre-trip 阶段）/"已入境戳"具体内容 —— 本 Phase 仅做静态视觉占位，不接入 lifecycle 计算。lifecycle hero（pre/live/post）是设计稿 `trip.jsx` 的 PreTripHero / LiveTripHero / PostTripHero 区块，留作单独 spike（不在本 Phase 范围）。
- ✅ AILoadingBar 引用保留 → Phase 5 swap 不在本 Phase

**关键决策：**

1. **AI 按钮替换为 AIBadge compact**
   原 `.th-ai-btn` 紫红 pill 已废弃；4 主题统一用 `<AIBadge status='idle' size='compact'/>`，shine + dots 动效一致。仅 disabled 状态（aiStatus 非空）隐藏 AI 按钮，由 AILoadingBar 顶替。

2. **lifecycle hero 不做**
   设计稿 `trip.jsx` 的 PreTripHero / LiveTripHero / PostTripHero 是另一个维度（出发前 / 进行中 / 回顾），与 4 主题正交。Phase 4a 只做"主题切换 header 版式"；lifecycle hero 是后续可独立做的能力，且需引入 `daysToGo / current spot` 等业务计算逻辑，超出 header 范围。

3. **返回按钮 fallback**
   `Taro.navigateBack` 在小程序首次进入 trip 页（无 history）时失败；fallback 用 `reLaunch` 回首页，与现有未显式有"返回"按钮的行为对齐。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-26-phase4a-trip-header.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — 每个 Task 派 fresh subagent，主线 review；4 个 header 子组件可并行 review
2. **Inline Execution** — 我连跑全部 Task，每 3 Task 一个 checkpoint

**Which approach?**

---

## 后续 Phase 4 子 PR（待写）

Phase 4 总共 5 个 sub-PR，本 plan 仅覆盖 4a。建议执行顺序：

| 顺序 | sub-PR | 范围 | 工作量 |
| --- | --- | --- | --- |
| 1 | **4a（本 plan）** | trip header 4 套 | M |
| 2 | 4e MapView | MapModeBar 4 variant（地图本体不变） | M |
| 3 | 4b ItineraryView | 主体 4 套 + DayTabs 4 variant | L |
| 4 | 4c BudgetView | 单结构 + 4 主题 token 漂移 | M |
| 5 | 4d PackingView | 4 套 | M |

理由：4a 后做 4e（MapModeBar）相对独立可快速合；4b ItineraryView 改动最大留中间稳定后做；4c BudgetView 是 token-only 重构最轻；4d Packing 收尾。

合并 4a 后，告诉我下一个 sub-PR，我接着写 plan。
