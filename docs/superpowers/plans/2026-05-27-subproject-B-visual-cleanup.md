# 子项目 B · 视觉收口 · 实施计划

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: 修复刊物封面被示例 trip 占用、护照印章 3/行死板且长名截断、护照（含其它 3 主题）DayTabs 的 [+] 按钮与 day item 高度不一致，并清掉 3 处可见 UI 彩色 emoji。

Architecture: 3 处独立局部修复，无新增组件，无新增 utils 文件。HomeMagazine 按 updatedAt 选 featured；HomePostcard 印章用 djb2 哈希派生 size/shape/rotate；DayTabs 4 主题统一 height 变量；emoji 字符串直接替换。

Tech Stack: Taro 4.2 + React 18 + TypeScript + SCSS。

Spec 来源：[2026-05-27-subproject-B-visual-cleanup.md](../specs/2026-05-27-subproject-B-visual-cleanup.md)

测试说明：项目无自动测试套件，所有验证步骤指在「微信开发者工具」中手动冒烟。

---

## 1. 文件结构

### 1.1. 修改

| 路径 | 责任 |
| --- | --- |
| src/pages/home/HomeMagazine.tsx | featured 改为优先取最新自建；rest 按规则计算 |
| src/pages/home/HomePostcard.tsx | 内联 stampStyle 哈希；移除 _scale 派生宽度 |
| src/pages/home/styles/home-postcard.scss | 印章 size/shape/rotate 三档样式；长名 clamp |
| src/views/ItineraryView/styles/daytabs.scss | 4 主题 item/add 高度变量统一 |
| src/components/ShareTypeSheet/index.tsx | 删 👥 |
| src/pages/share/index.tsx | 删 🔒 / 👥 |

### 1.2. 新增 / 删除

无。

---

## 2. 任务清单

### 2.1. Task 1：HomeMagazine featured 优先取最新自建

Files:
- 修改：src/pages/home/HomeMagazine.tsx

- [ ] 2.1.1. 在文件顶部 import 中加入 isSeedTripId

```typescript
import { isSeedTripId } from '../../data/seed-trips'
```

- [ ] 2.1.2. 替换 featured / rest 计算

定位当前代码（第 22–23 行）：

```typescript
const featured = trips[0]
const rest = trips.slice(1)
```

替换为：

```typescript
const userTrips = trips.filter((t) => !isSeedTripId(t._id))
const sortedUser = [...userTrips].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
const featured = sortedUser[0] ?? trips.find((t) => isSeedTripId(t._id))
const rest = trips.filter((t) => t._id !== featured?._id)
```

- [ ] 2.1.3. 调整 rest 索引展示

定位渲染段（约 77 行）`{rest.map((t, i) => ( … <Text>P. {String(i + 2).padStart(2, '0')}</Text> … ))}` 中的 `i + 2`：因为 featured 不再固定为 trips[0]，而 rest 也不再严格是 trips.slice(1)，逻辑上目录页码应保持「featured 为 P.01，rest 依次 P.02、P.03…」。改为：

```tsx
{rest.map((t, i) => (
  <View key={t._id} className='hm-index-row' onClick={...} onLongPress={...}>
    <Text className='hm-index-no'>P. {String(i + 2).padStart(2, '0')}</Text>
    {/* 其它内容保持 */}
  </View>
))}
```

`i + 2` 不变（rest 数组的第 0 个是 P.02，第 1 个是 P.03，依此类推）；不需要改。仅确认逻辑正确即可。

- [ ] 2.1.4. 验证

运行：`npm run dev:weapp`，切到 magazine 主题：

1) 清空本地存储（开发者工具 Storage 面板 → 清空），仅 seed trip → 刊物封面显示 seed[0]，目录里有其它 seed（如果有）
2) 创建一个自建 trip → 刊物封面切到该自建；seed 退到目录
3) 创建第二个自建 trip → 刊物封面切到 updatedAt 最新那个；旧自建出现在目录

- [ ] 2.1.5. Commit

```bash
git add src/pages/home/HomeMagazine.tsx
git commit -m "fix(home-magazine): prefer latest user trip as featured cover"
```

---

### 2.2. Task 2：HomePostcard 印章布局重写

Files:
- 修改：src/pages/home/HomePostcard.tsx
- 修改：src/pages/home/styles/home-postcard.scss

- [ ] 2.2.1. 在 HomePostcard.tsx 顶部（STAMP_COLORS 之下）追加 stampStyle 工具

```typescript
type StampSize = 'sm' | 'md' | 'lg'
type StampShape = 'circle' | 'oval' | 'rect'

interface StampStyle {
  size: StampSize
  shape: StampShape
  rotate: number
}

function djb2(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function stampStyle(tripId: string, tripName: string): StampStyle {
  const h = djb2(tripId)
  const sizes: StampSize[] = ['sm', 'md', 'lg']
  const shapes: StampShape[] = ['circle', 'oval', 'rect']
  const longName = (tripName?.length ?? 0) > 8
  return {
    size: longName ? 'lg' : sizes[h % 3],
    shape: shapes[(h >> 2) % 3],
    rotate: ((h >> 5) % 7) - 3,
  }
}
```

- [ ] 2.2.2. 删除 sized useMemo（不再需要 _scale）

定位 33–36 行：

```typescript
const sized = useMemo(() => trips.map((t) => {
  const d = tripDays(t)
  return { ...t, _scale: Math.min(1.0, Math.max(0.62, 0.5 + d * 0.06)), _days: d }
}), [trips])
```

替换为（保留 _days 用于 totalDays 计算）：

```typescript
const sized = useMemo(() => trips.map((t) => ({ ...t, _days: tripDays(t) })), [trips])
```

`useMemo` 已在 import 中（顶部 `import { useMemo } from 'react'`），无需新增 import。

- [ ] 2.2.3. 重写印章渲染段

定位 63–88 行的 `.hpp-stamps` 内 `sized.map`，替换为：

```tsx
<View className='hpp-stamps'>
  {sized.map((t, i) => {
    const ai = aiStatusFor(t)
    const destFull = t.destinations.map((d) => d.name).join(' ')
    const st = stampStyle(t._id, t.name)
    return (
      <View
        key={t._id}
        className={`hpp-stamp hpp-stamp--${st.size} hpp-stamp--${st.shape}`}
        onClick={() => onOpenTrip(t)}
        onLongPress={() => onLongPressTrip(t)}
        style={{
          '--stamp-color': STAMP_COLORS[i % STAMP_COLORS.length],
          animationDelay: `${i * 60}ms`,
          transform: `rotate(${st.rotate}deg)`,
        } as React.CSSProperties}
      >
        <Text className='hpp-stamp-name'>{destFull || t.name}</Text>
        <View className='hpp-stamp-divider' />
        <Text className='hpp-stamp-date'>{t.startDate.slice(0, 7).replace('-', '.')}</Text>
        <Text className='hpp-stamp-days'>{t._days} DAYS · {t.pax}P</Text>
        {ai === 'thinking' && <View className='hpp-stamp-aiglow' />}
        {ai === 'ready' && <View className='hpp-stamp-airready'>✓</View>}
      </View>
    )
  })}
</View>
```

注意：删除了原 inline `width / height` style（改为由 className 控制），保留 `--stamp-color` 与 `animationDelay`，新增 `transform: rotate`。

- [ ] 2.2.4. 修改 home-postcard.scss

定位 75–91 行的 `.hpp-stamp` 块，在其后追加新规则（不修改既有 .hpp-stamp 公共属性，仅追加 size/shape 变体）：

```scss
/* size 三档 — 替代原 inline width/height */
.hpp-stamp--sm { width: 140rpx; height: 140rpx; }
.hpp-stamp--md { width: 200rpx; height: 200rpx; }
.hpp-stamp--lg { width: 280rpx; height: 280rpx; }

/* shape 三档 */
.hpp-stamp--circle { border-radius: 50%; border-style: dashed; }
.hpp-stamp--oval   { border-radius: 50% / 40%; border-style: dashed; }
.hpp-stamp--rect   { border-radius: 16rpx; border-style: solid; }
```

- [ ] 2.2.5. 修改 .hpp-stamp-name 增加 line-clamp（覆盖第 93–101 行）

把原 `.hpp-stamp-name` 块改为：

```scss
.hpp-stamp-name {
  font-size: 22rpx;
  font-weight: 700;
  font-family: var(--font-display);
  letter-spacing: 2rpx;
  line-height: 1.2;
  max-width: 100%;
  text-align: center;
  padding: 0 12rpx;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  word-break: break-all;
  box-sizing: border-box;
}

.hpp-stamp--sm .hpp-stamp-name { -webkit-line-clamp: 1; font-size: 20rpx; }
.hpp-stamp--lg .hpp-stamp-name { font-size: 26rpx; }
```

- [ ] 2.2.6. 调整 .hpp-stamps 容器，让 align-items 改为 flex-start（避免不同高度的卡片垂直居中导致空隙不均）

定位第 68–74 行：

```scss
.hpp-stamps {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
  justify-content: center;
  align-items: center;
}
```

改为：

```scss
.hpp-stamps {
  display: flex;
  flex-wrap: wrap;
  gap: 28rpx 24rpx;
  justify-content: flex-start;
  align-items: flex-start;
  padding: 16rpx 8rpx;
}
```

- [ ] 2.2.7. 验证

`npm run dev:weapp` 切 postcard 主题：

1) 构造至少 6 个 trip（含 1 个 name 长度 > 8 字符的 trip）→ 应看到 sm/md/lg 三档尺寸混搭、圆/椭圆/方戳三档形状均出现、微旋转 ±3°、长名 trip 进 lg 戳且名字最多 2 行不截断。
2) 关闭再打开首页 → 同一 trip 印章样式（size/shape/rotate）保持不变。

- [ ] 2.2.8. Commit

```bash
git add src/pages/home/HomePostcard.tsx src/pages/home/styles/home-postcard.scss
git commit -m "feat(home-postcard): hash-derived stamp size/shape/rotate, fix long-name truncation"
```

---

### 2.3. Task 3：DayTabs 4 主题 [+] 按钮高度对齐

Files:
- 修改：src/views/ItineraryView/styles/daytabs.scss

- [ ] 2.3.1. ticket 变体（postcard 主题）：把 .dt-add--ticket 改为与 item 同高

定位第 87–94 行：

```scss
.dt-add--ticket {
  flex: 0 0 auto;
  width: 88rpx;
  align-self: stretch;
  min-height: 96rpx;
  border: 1rpx dashed var(--accent);
  background: transparent;
}
```

改为：

```scss
.dt-track--ticket { --dt-ticket-h: 116rpx; }
.dt--ticket .dt-item--ticket { min-height: var(--dt-ticket-h); }
.dt-add--ticket {
  flex: 0 0 auto;
  width: 88rpx;
  min-height: var(--dt-ticket-h);
  align-self: stretch;
  border: 1rpx dashed var(--accent);
  background: transparent;
}
```

- [ ] 2.3.2. spine 变体（magazine 主题）：把 .dt-add--spine 改为与 item 同高

定位第 153–161 行：

```scss
.dt-add--spine {
  flex: 0 0 auto;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: transparent;
  border: 1rpx dashed var(--ink-3);
  color: var(--ink-3);
}
```

改为：

```scss
.dt-track--spine { --dt-spine-h: 88rpx; }
.dt-item--spine { min-height: var(--dt-spine-h); }
.dt-add--spine {
  flex: 0 0 auto;
  width: 64rpx;
  height: var(--dt-spine-h);
  border-radius: 32rpx;
  background: transparent;
  border: 1rpx dashed var(--ink-3);
  color: var(--ink-3);
  align-self: center;
}
```

注：spine 变体 item 内含 dot + no + date，原本视觉高度约 80rpx，把变量定为 88rpx 给 add 留视觉一致呼吸；spine 的 add 改为长圆角（border-radius: 32rpx）以匹配 item 列向布局。

- [ ] 2.3.3. calendar 变体（tegami 主题）：item 和 add 都是 120rpx 固定，已经对齐，无需改动。

确认 daytabs.scss 第 171–213 行不动；如发现实际渲染仍有偏差，加 `align-self: stretch` 到 `.dt-add--cal`。

- [ ] 2.3.4. simple 变体（minimal 主题）：把 .dt-add--simple 改为与 item 同高

定位第 249–256 行：

```scss
.dt-add--simple {
  flex: 0 0 auto;
  width: 64rpx;
  height: 64rpx;
  background: transparent;
  color: var(--ink-3);
  border: 1rpx dashed var(--ink-3);
}
```

改为：

```scss
.dt-track--simple { --dt-simple-h: 74rpx; }
.dt-item--simple { min-height: var(--dt-simple-h); }
.dt-add--simple {
  flex: 0 0 auto;
  width: 64rpx;
  height: var(--dt-simple-h);
  background: transparent;
  color: var(--ink-3);
  border: 1rpx dashed var(--ink-3);
  align-self: center;
}
```

- [ ] 2.3.5. 验证

`npm run dev:weapp`，依次切 4 主题进入 trip 页攻略 tab：

1) postcard 主题 → ticket 变体：[+] 按钮顶/底与 day item 严格对齐
2) magazine 主题 → spine 变体：[+] 与 item 中线对齐
3) tegami 主题 → calendar 变体：原本就 120rpx 对齐，无回归
4) minimal 主题 → simple 变体：[+] 与 item 顶/底对齐

如某变体实际渲染高度与变量不符，调整该变体的变量值。

- [ ] 2.3.6. Commit

```bash
git add src/views/ItineraryView/styles/daytabs.scss
git commit -m "fix(daytabs): align add button height to day item across all 4 themes"
```

---

### 2.4. Task 4：emoji 清理（3 处）

Files:
- 修改：src/components/ShareTypeSheet/index.tsx
- 修改：src/pages/share/index.tsx

- [ ] 2.4.1. ShareTypeSheet：删 👥

打开 src/components/ShareTypeSheet/index.tsx，定位第 56 行：

```typescript
{renderItem('collab', '👥 邀请协作', '对方加入后能编辑同一份攻略,改动实时同步')}
```

改为：

```typescript
{renderItem('collab', '邀请协作', '对方加入后能编辑同一份攻略,改动实时同步')}
```

- [ ] 2.4.2. share 页：删 🔒 / 👥

打开 src/pages/share/index.tsx，定位第 78 行：

```typescript
<Text className='sh-label'>{kind === 'readonly' ? '🔒 一份只读攻略' : '👥 协作邀请'}</Text>
```

改为：

```typescript
<Text className='sh-label'>{kind === 'readonly' ? '一份只读攻略' : '协作邀请'}</Text>
```

- [ ] 2.4.3. 全局 grep 验证

运行：

```bash
grep -rn '👥\|🔒\|✨' src/ --include='*.tsx' --include='*.ts'
```

预期输出：无匹配（注释里如有，本子项目不动；如有命中是否在 .tsx/.ts 注释里需人工判断）。

- [ ] 2.4.4. 验证 UI

`npm run dev:weapp`：

1) trip 页 → 触发分享 → ShareTypeSheet 应显示"邀请协作"，无 👥
2) 进入 share 页（任一分享链接进入）→ 标签是"一份只读攻略" / "协作邀请"，无 🔒 / 👥

- [ ] 2.4.5. Commit

```bash
git add src/components/ShareTypeSheet/index.tsx src/pages/share/index.tsx
git commit -m "refactor: remove visible color emoji from share UI"
```

---

### 2.5. Task 5：验收冒烟

Files: 仅人工验证。

- [ ] 2.5.1. B1：清空本地存储仅留 seed → magazine 封面是 seed[0]

- [ ] 2.5.2. B2：创建 1 个自建 trip → magazine 封面切到该自建，seed 出现在目录

- [ ] 2.5.3. B3：创建第二个自建 trip 并编辑第一个 → magazine 封面显示 updatedAt 最新（被编辑的那个）

- [ ] 2.5.4. B4：postcard 主题构造 6 trip（含长名）→ 三档 size、三档 shape、±3° rotate 都出现；长名进 lg 戳两行不截断

- [ ] 2.5.5. B5：同一 trip 多次进出首页 → 印章样式稳定不变

- [ ] 2.5.6. B6：postcard 主题 trip 页 → DayTabs ticket 变体 [+] 与 item 对齐

- [ ] 2.5.7. B7：tegami / magazine / minimal 三主题 trip 页 → 各自变体 [+] 与 item 对齐

- [ ] 2.5.8. B8：ShareTypeSheet 标签是"邀请协作"

- [ ] 2.5.9. B9：share 页标签是"一份只读攻略" / "协作邀请"

- [ ] 2.5.10. B10：`grep -rn '👥\|🔒\|✨' src/ --include='*.tsx' --include='*.ts'` 无可见 UI 文案命中

- [ ] 2.5.11. 建 PR

```bash
git checkout -b feat/subproject-b-visual-cleanup
git push -u origin feat/subproject-b-visual-cleanup
gh pr create --title "feat(visual): subproject B · cover/stamp/daytabs/emoji cleanup" --body "$(cat <<'EOF'
## Summary
- HomeMagazine 封面优先取最新自建 trip，seed 退到目录
- HomePostcard 印章用哈希派生 size/shape/rotate；长名进 lg 戳不截断
- DayTabs 4 主题 [+] 按钮与 day item 高度统一
- 清理 ShareTypeSheet / share 页的 3 处彩色 emoji（👥 / 🔒）

## Test plan
- [ ] B1-B10 人工冒烟（见 plan 2.5 节）
EOF
)"
```

---

## 3. 自审清单

3.1. Spec § 3.1 HomeMagazine featured 改造 → Task 1 ✓

3.2. Spec § 3.2 HomePostcard 印章布局 → Task 2 ✓

3.3. Spec § 3.3 DayTabs 4 主题高度对齐 → Task 3 ✓

3.4. Spec § 3.4 emoji 清理 3 处 → Task 4 ✓

3.5. Spec § 6 验收 B1–B10 → Task 5 ✓

3.6. 无占位词（TBD / TODO / "implement later"）✓

3.7. 类型一致性：StampSize / StampShape / StampStyle 在唯一定义点 ✓

3.8. 文件路径全部已确认存在（HomeMagazine.tsx、HomePostcard.tsx、styles/home-postcard.scss、styles/daytabs.scss、ShareTypeSheet/index.tsx、share/index.tsx）✓
