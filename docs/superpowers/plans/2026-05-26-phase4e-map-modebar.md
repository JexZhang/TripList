# Phase 4e · MapView MapModeBar 四主题 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** MapView 的日期切换 bar（`ModeBar`）按四主题各做一套：彩色胶囊（tegami）/ 分段控制器（magazine）/ 路线卡片（postcard）/ 极简胶囊（minimal）。地图本体瓦片/Pin 不动。

**Architecture:** 现 `src/views/MapView/ModeBar.tsx` 已有 3 个 variant（track/segmented/route），缺 `pill`。本 Phase：补 pill variant，并把 variant 选择从硬编码改为 `useTheme()`。

**Tech Stack:** Taro 4.x React + TypeScript + SCSS

**Spec:** [docs/superpowers/specs/2026-05-26-design-system-application-design.md](../specs/2026-05-26-design-system-application-design.md) § 7.6

**Prerequisite:** Phase 4a 合并；`useTheme` 可用

**Scope：** 仅改 `ModeBar`；MapView 主体（svg / pins / sheet）不动

---

## File Structure

### 修改

| 路径 | 改动 |
| --- | --- |
| `src/views/MapView/ModeBar.tsx` | 加 `pill` variant；type 加 `'pill'`；export 新增 `MAPMODE_VARIANT` 映射 |
| `src/views/MapView/index.tsx` | 删除硬编码 variant 传参；改用 `useTheme()` → 自动选 variant |
| `src/views/MapView/index.scss` | 新增 `.mv-pill-*` 选择器 |

### 新增

| 路径 | 责任 |
| --- | --- |
| `src/views/MapView/variants.ts` | `MAPMODE_VARIANT: ThemeName → ModeBarVariant` 映射 |

---

## Task 0: 基线

- [ ] **Step 1: Phase 4a 已合并**

Run: `git status && git log --oneline -5`
Expected: 工作树干净；HEAD 含 Phase 4a 的 TripHeader commit

- [ ] **Step 2: 启动 weapp dev**

Run: `npm run dev:weapp`
微信开发者工具 → 编译 → trip 页 → map tab → 当前 ModeBar 显示（默认 track 变体）

---

## Task 1: 映射表

**Files:**
- Create: `src/views/MapView/variants.ts`

- [ ] **Step 1: 创建映射**

Create `src/views/MapView/variants.ts`：

```typescript
import type { ThemeName } from '../../store/theme-store'
import type { ModeBarVariant } from './ModeBar'

export const MAPMODE_VARIANT: Record<ThemeName, ModeBarVariant> = {
  tegami:   'track',
  magazine: 'segmented',
  postcard: 'route',
  minimal:  'pill',
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/MapView/variants.ts
git commit -m "feat(map): 主题 → MapModeBar variant 映射"
```

---

## Task 2: ModeBar 加 pill variant

**Files:**
- Modify: `src/views/MapView/ModeBar.tsx`

- [ ] **Step 1: 扩展 variant 类型**

Edit `src/views/MapView/ModeBar.tsx`：

把 `export type ModeBarVariant = 'track' | 'segmented' | 'route'` 改为：

```typescript
export type ModeBarVariant = 'track' | 'segmented' | 'route' | 'pill'
```

- [ ] **Step 2: 加 PillBar 子组件**

在文件末尾追加：

```typescript
/* ---------- D. 极简胶囊 ---------- */
function PillBar({ days, mode, onChange }: Omit<Props, 'variant'>) {
  return (
    <ScrollView scrollX className='mv-modebar mv-pill'>
      <View
        className={`mv-pill-item ${mode === 'all' ? 'on' : ''}`}
        onClick={() => onChange('all')}
      >
        <Text>全部</Text>
      </View>
      {days.map((d, idx) => (
        <View
          key={d.id}
          className={`mv-pill-item ${mode === idx ? 'on' : ''}`}
          onClick={() => onChange(idx)}
        >
          <Text>D{idx + 1}</Text>
          <Text className='mv-pill-date'>{dayjs(d.date).format('M/D')}</Text>
        </View>
      ))}
    </ScrollView>
  )
}
```

- [ ] **Step 3: dispatcher 加 pill 分支**

把主 `export default function ModeBar` 中：

```typescript
if (variant === 'segmented') return <SegmentedBar days={days} mode={mode} onChange={onChange} />
if (variant === 'route') return <RouteBar days={days} mode={mode} onChange={onChange} />
return <TrackBar days={days} mode={mode} onChange={onChange} />
```

改为：

```typescript
if (variant === 'segmented') return <SegmentedBar days={days} mode={mode} onChange={onChange} />
if (variant === 'route') return <RouteBar days={days} mode={mode} onChange={onChange} />
if (variant === 'pill') return <PillBar days={days} mode={mode} onChange={onChange} />
return <TrackBar days={days} mode={mode} onChange={onChange} />
```

- [ ] **Step 4: 类型检查**

Run: `npx tsc --noEmit 2>&1 | grep "ModeBar" | head -5`
Expected: 无报错

- [ ] **Step 5: Commit**

```bash
git add src/views/MapView/ModeBar.tsx
git commit -m "feat(map): ModeBar 加 pill variant"
```

---

## Task 3: MapView 用 useTheme 自动选 variant

**Files:**
- Modify: `src/views/MapView/index.tsx`

- [ ] **Step 1: 接入 useTheme**

Edit `src/views/MapView/index.tsx`：

- 顶部 import：
  ```typescript
  import { useTheme } from '../../store/theme-store'
  import { MAPMODE_VARIANT } from './variants'
  ```
- 在组件函数体内 hooks 区加：
  ```typescript
  const { theme } = useTheme()
  const variant = MAPMODE_VARIANT[theme]
  ```
- 把 `<ModeBar ... />` 的调用补上 `variant={variant}`：
  ```tsx
  <ModeBar days={trip.days} mode={mode} variant={variant} onChange={setMode} />
  ```

> 若现有调用已传 variant，替换其值即可。

- [ ] **Step 2: 编译验证**

watch 重编。Expected: 无类型/导入报错

- [ ] **Step 3: Commit**

```bash
git add src/views/MapView/index.tsx
git commit -m "feat(map): MapView 按 theme 自动选 ModeBar variant"
```

---

## Task 4: pill variant 样式

**Files:**
- Modify: `src/views/MapView/index.scss`

- [ ] **Step 1: 追加 pill 选择器**

Edit `src/views/MapView/index.scss`，在文件末尾追加：

```scss
/* ===== ModeBar · D. 极简胶囊 ===== */
.mv-pill {
  display: flex;
  gap: 12rpx;
  padding: 16rpx 24rpx;
  background: var(--surface);
  border-bottom: 1rpx solid var(--line);
  white-space: nowrap;
}
.mv-pill-item {
  display: inline-flex;
  align-items: baseline;
  gap: 6rpx;
  padding: 10rpx 22rpx;
  border-radius: var(--r-pill);
  border: 1rpx solid var(--line-2);
  font-size: 22rpx;
  color: var(--ink-2);
  font-family: var(--font-mono);
  letter-spacing: 1rpx;
  transition: all 0.18s var(--ease-out);
}
.mv-pill-item.on {
  background: var(--ink);
  color: var(--surface);
  border-color: var(--ink);
}
.mv-pill-date {
  font-size: 18rpx;
  opacity: 0.7;
}
```

- [ ] **Step 2: 微调既有 variant 让其更贴近设计稿**

可选优化（不强制）：
- 检查 `.mv-track-item.on` 是否填充 `var(--c)` 实色
- 检查 `.mv-segmented` 在 magazine 主题下是否够直角（依赖 `--r-md`，Phase 1 magazine 已 4rpx）

- [ ] **Step 3: Commit**

```bash
git add src/views/MapView/index.scss
git commit -m "feat(map): mv-pill 极简胶囊样式"
```

---

## Task 5: 矩阵走查

**Files:** 仅验证

- [ ] **Step 1: 微信开发者工具 → trip → map tab**

逐主题切换（我的页 → 选主题 → 回 trip）：

| 主题 | variant | 验证 |
| --- | --- | --- |
| 手帖 | track | 彩色胶囊带 dot；激活态填充 dayColor |
| 刊物 | segmented | 黑框分段控件；激活段黑底白字 |
| 护照 | route | 每天一张"签证卡"；含 Day N + 日期 + 距离/点数 |
| 极简 | pill | hairline 胶囊；激活态黑底；mono 字体 |

- [ ] **Step 2: 全部 / 单日切换**

每主题下：
- 默认进入 mode = 'all'，地图显示所有点
- 点 Day 1 → 地图筛选 Day 1 路线（dashed path）
- 点全部 → 回到全 pin 视图

- [ ] **Step 3: 长 trip（10+ 天）滚动**

如有 10+ 天 trip：
- 4 主题的 ModeBar 都是横向 scrollable（ScrollView scrollX）
- pill / track 在天数多时不挤压；segmented 因等分会变窄可接受
- route 卡片宽度固定，滚动顺畅

---

## Task 6: 收尾

- [ ] **Step 1: codemap 同步（如有）**

追加：
- `src/views/MapView/variants.ts`

- [ ] **Step 2: Push**

```bash
git push
```

---

## Self-Review

- ✅ Spec § 7.6.2 MapModeBar 4 variant → Task 2 (pill 补齐) + Task 1 (映射) + Task 3 (wire)
- ✅ Spec § 7.6.1 地图本体不变 → 无 svg / pin 改动
- ✅ Spec § 7.6.3 与 DayTabs 共用 dayColor → 既有，未改

**关键决策：**

1. **复用现有 ModeBar 结构**
   ModeBar.tsx 已有 3 variants；只加 pill + 改 variant 选择来源（hardcode → useTheme）。不重写。

2. **route variant 文案保留现有**
   设计稿 route 是迷你"签证卡" + Day N + 日期 + 距离。现有 RouteBar 已是这个形态。本 Phase 不改细节，留作后续打磨。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-26-phase4e-map-modebar.md`. Subagent-Driven or Inline?**
