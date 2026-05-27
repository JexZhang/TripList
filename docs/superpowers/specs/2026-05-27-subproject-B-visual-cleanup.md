# 子项目 B · 视觉收口（刊物封面 + 护照印章 + 日期按钮 + emoji 清理）

> 本 spec 合并了脑暴拆分中的原 F（emoji 清理 + 设计语言）/ C（刊物封面）/ D（护照印章 + 日期按钮）三块。
>
> 上层 design system 文档：[2026-05-26-design-system-application-design.md](./2026-05-26-design-system-application-design.md)

---

## 1. 目标

1.1. 让刊物（magazine）主题首页的"本期封面"不再被示例 trip 占用，给用户最新的自建攻略让位。

1.2. 让护照（postcard）主题首页印章布局从 3/行死板网格变成"乱中有序"的拼贴，并解决长名字截断问题。

1.3. 让护照主题攻略 tab 顺手把 4 主题里 DayTabs 的 [+] 按钮和 day item 高度对齐。

1.4. 清掉项目里 3 处可见 UI 彩色 emoji（👥 / 🔒），保留单色几何符号（✓ × ▾ ○ ›）作图标使用。

---

## 2. 范围

### 2.1. 涵盖

2.1.1. HomeMagazine featured 选择逻辑改造（原 C）

2.1.2. HomePostcard 印章布局重写：尺寸/形状/旋转哈希派生（原 D）

2.1.3. DayTabsTicket（及其它 3 主题变体）的 [+] 按钮高度对齐（原 D）

2.1.4. 3 处彩色 emoji 文本替换（原 F · 最小落地）

### 2.2. 不涵盖

2.2.1. AI 组件 4 主题×3 状态视觉（已在子项目 A 落地）

2.2.2. 单色几何符号（✓ × ▾ ○ ›）替换为 SVG icon —— 保留现状

2.2.3. 主题 token 体系重建、跨组件设计语言强化（属脑暴中放弃的 F-B/F-C 方案）

2.2.4. 我的页头像/昵称/主题选择 UX（子项目 C）

2.2.5. 出行前/中/后差异化（子项目 D）

2.2.6. 主包分包（子项目 E）

---

## 3. 组件改造清单

### 3.1. HomeMagazine featured 选择

3.1.1. 文件：src/pages/home/HomeMagazine.tsx

3.1.2. 现状：`const featured = trips[0]`；上游 `setTrips([...SEED_TRIPS, ...list])` 把 seed 永远放最前，导致 featured 永远是示例 trip。

3.1.3. 改造后逻辑：

```typescript
import { isSeedTripId } from '../../data/seed-trips'

const userTrips = trips.filter((t) => !isSeedTripId(t._id))
const sortedUser = [...userTrips].sort(
  (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
)
const featured = sortedUser[0] ?? trips.find((t) => isSeedTripId(t._id))
const rest = trips.filter((t) => t._id !== featured?._id)
```

3.1.4. 规则总结：

| 用户状态 | featured | rest（下方网格） |
| --- | --- | --- |
| 无自建 trip | seed 中第一个 | 其它 seed（如果有） |
| 1 个自建 trip | 该自建 | 全部 seed |
| ≥2 自建 trip | updatedAt 最新自建 | 其它自建 + 全部 seed |

3.1.5. 渲染层把当前 `trips.map` 改为 `rest.map`，featured 单独渲染（沿用现有 `.hm-feature` 结构）。

3.1.6. updatedAt 字段确认：若 Trip 类型没有 updatedAt，则 fallback 用 createdAt；都没有则按 trips 数组顺序倒序（数组末尾视为最新）。实施期 grep 确认。

### 3.2. HomePostcard 印章布局

3.2.1. 文件：src/pages/home/HomePostcard.tsx + 同目录或 src/pages/home/index.scss 中的 .hpp-* 段

3.2.2. 新增工具函数（写在 HomePostcard.tsx 顶部，不抽 utils）：

```typescript
type StampSize = 'sm' | 'md' | 'lg'
type StampShape = 'circle' | 'oval' | 'rect'

interface StampStyle {
  size: StampSize
  shape: StampShape
  rotate: number // -3 ~ 3
}

function djb2(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function stampStyle(tripId: string, tripName: string): StampStyle {
  const h = djb2(tripId)
  const sizes: StampSize[] = ['sm', 'md', 'lg']
  const shapes: StampShape[] = ['circle', 'oval', 'rect']
  const longName = tripName.length > 8
  return {
    size: longName ? 'lg' : sizes[h % 3],
    shape: shapes[(h >> 2) % 3],
    rotate: ((h >> 5) % 7) - 3,
  }
}
```

3.2.3. 渲染层为每张印章吐出 3 个 className + inline rotate：

```tsx
{rest.map((trip) => {
  const st = stampStyle(trip._id, trip.name)
  return (
    <View
      key={trip._id}
      className={`hpp-stamp hpp-stamp--${st.size} hpp-stamp--${st.shape}`}
      style={{ transform: `rotate(${st.rotate}deg)` }}
      onClick={() => onOpenTrip(trip)}
      onLongPress={() => onLongPressTrip(trip)}
    >
      {/* 现有印章内容（trip name / dates / aiglow / ✓）保持不动 */}
      {/* 子项目 A 已注入的 HomeCardAIRow 也保持 */}
    </View>
  )
})}
```

注意：`onLongPress` 在小程序里 onClick + onLongPress 同 View 上是 OK 的（项目其它地方有用例）。

3.2.4. 容器布局：把当前 grid 改为 flex wrap：

```scss
.hpp-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 28rpx 24rpx;
  padding: 24rpx;
  align-items: flex-start;
  justify-content: flex-start;
}
```

3.2.5. 印章尺寸 token：

| size | width × height | font-size | 名字最大行数 |
| --- | --- | --- | --- |
| sm | 140rpx × 140rpx | 22rpx | 1 行（超出省略） |
| md | 200rpx × 200rpx | 26rpx | 2 行 |
| lg | 280rpx × 280rpx | 30rpx | 2 行 |

3.2.6. 形状变体：

```scss
.hpp-stamp--circle { border-radius: 50%; border-style: dashed; }
.hpp-stamp--oval   { border-radius: 50% / 40%; border-style: dashed; }
.hpp-stamp--rect   { border-radius: 16rpx; border-style: solid; }
```

3.2.7. 长名截断处理（覆盖任意 size 的 trip 名字渲染段，注意 lg 时已强制 size='lg' 所以足够）：

```scss
.hpp-stamp-name {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  word-break: break-all;
  text-align: center;
  padding: 0 12rpx;
}
.hpp-stamp--sm .hpp-stamp-name { -webkit-line-clamp: 1; }
```

3.2.8. featured 处理：在 postcard 主题里 featured 概念不存在；rest 直接等于 trips（不剔除 seed）。HomeMagazine 的 featured 逻辑只影响 magazine 主题。

### 3.3. DayTabs [+] 按钮高度对齐

3.3.1. 文件：

| 主题变体 | 组件 | item className | add className |
| --- | --- | --- | --- |
| postcard | DayTabsTicket | dt-item--ticket | dt-add--ticket |
| magazine | DayTabsSpine | dt-item--spine | dt-add--spine |
| tegami | DayTabsCalendar | dt-item--cal | dt-add--cal |
| minimal | DayTabsSimple | dt-item--simple | dt-add--simple |

3.3.2. 在每个对应 SCSS 文件中，给 .dt-item--xxx 和 .dt-add--xxx 引入共享高度变量：

```scss
.dt-track--ticket {
  --dt-ticket-h: 168rpx; // 由当前 dt-item--ticket 实际高度填入
}
.dt-item--ticket, .dt-add--ticket {
  height: var(--dt-ticket-h);
  display: flex;
  align-items: center;
  justify-content: center;
}
```

3.3.3. 实施期在微信开发者工具里量出每个变体 item 真实高度，把数值填入 --dt-xxx-h 变量。其它 3 主题同样处理。

3.3.4. 不调整 width / padding / 字号；只动 height 与 align。

### 3.4. emoji 清理（3 处）

3.4.1. src/components/ShareTypeSheet/index.tsx

替换：`'👥 邀请协作'` → `'邀请协作'`

3.4.2. src/pages/share/index.tsx

替换：`'🔒 一份只读攻略'` → `'一份只读攻略'`；`'👥 协作邀请'` → `'协作邀请'`

3.4.3. 不改 ✓ × ▾ ○ ›（保留作图标）。

3.4.4. 不引入 SVG 替代。子项目 A 已删的 "✨ AI 帮我规划" 不在本子项目重复处理。

---

## 4. 文件清单

### 4.1. 修改

| 路径 | 改动 |
| --- | --- |
| src/pages/home/HomeMagazine.tsx | featured 选择逻辑改自建优先；rest 计算 |
| src/pages/home/HomePostcard.tsx | 引入 stampStyle 哈希；渲染层吐出 size/shape/rotate |
| src/pages/home/index.scss（或对应 .hpp- 段所在文件）| .hpp-grid 改 flex wrap；新增 .hpp-stamp--sm/md/lg、--circle/oval/rect、.hpp-stamp-name clamp |
| src/views/ItineraryView/DayTabsTicket.tsx 对应 SCSS | --dt-ticket-h 变量统一 |
| src/views/ItineraryView/DayTabsSpine.tsx 对应 SCSS | --dt-spine-h 变量统一 |
| src/views/ItineraryView/DayTabsCalendar.tsx 对应 SCSS | --dt-cal-h 变量统一 |
| src/views/ItineraryView/DayTabsSimple.tsx 对应 SCSS | --dt-simple-h 变量统一 |
| src/components/ShareTypeSheet/index.tsx | 删 👥 |
| src/pages/share/index.tsx | 删 🔒 / 👥 |

### 4.2. 新增

无。

### 4.3. 删除

无。

---

## 5. 错误处理

| 场景 | 行为 |
| --- | --- |
| Trip 缺 updatedAt 字段 | fallback 用 createdAt；都没有时按 trips 数组顺序倒序（末尾视为最新） |
| 完全没有 trip（含 seed 都没有） | featured = undefined；HomeMagazine 不渲染 .hm-feature 段（沿用现有判断） |
| Trip name 为空字符串 | 哈希仍按 _id 算；显示 "未命名" 占位 |
| tripId 极短（< 4 字符） | djb2 仍正常工作，分布偏，可接受 |
| flex wrap 在窄屏（< 320px）只剩 1 列 | 接受；视觉退化为单列拼贴，不影响功能 |

---

## 6. 验收冒烟（人工 · 微信开发者工具）

| # | 操作 | 期望 |
| --- | --- | --- |
| B1 | 新账号首次进首页（仅 seed）| 刊物封面显示 seed[0]；下方网格显示其它 seed |
| B2 | 创建 1 个自建 trip | 刊物封面切到该自建；seed 全部退到下方网格 |
| B3 | 创建多个自建并编辑其中之一 | 刊物封面显示 updatedAt 最新那个自建 |
| B4 | 切到 postcard 主题，构造 6 个 trip（含长名字 trip） | sm/md/lg 三档尺寸均出现；圆/椭圆/方戳三档形状均出现；微旋转 ±3°；长名字 trip 进 lg 戳，名字两行不截断 |
| B5 | 同一 trip 多次进出首页 | 印章样式保持稳定不变（哈希派生） |
| B6 | postcard 主题 trip 页 | DayTabsTicket 的 [+] 按钮与 day item 顶/底对齐 |
| B7 | tegami / magazine / minimal 三主题 trip 页 | 各自 DayTabs 的 [+] 与 item 对齐 |
| B8 | 触发 ShareTypeSheet | 标签是"邀请协作"，无 👥 |
| B9 | 进入 share 页 | 标签是"一份只读攻略" / "协作邀请"，无 🔒 / 👥 |
| B10 | 全局 grep | src/ 下不再出现 👥 / 🔒 / ✨ 字符（注释除外） |

---

## 7. 自审检查清单

7.1. 仅修改 9 个文件，不新增组件 ✓

7.2. 不引入 SVG 资产 ✓

7.3. 不改 trip 数据结构（updatedAt 是只读字段，已存在）✓

7.4. 不影响子项目 A 已落地的 AI 组件视觉 ✓

7.5. flex wrap + transform rotate 不引发小程序渲染异常（项目已用 transform，无未知风险）✓

7.6. 哈希派生保证印章样式幂等 ✓

---

## 8. 后续 plan 入口

本 spec 完成 + 用户审查通过后，调用 superpowers:writing-plans 出实施计划。预计 3 个 task：

8.1. Task 1：HomeMagazine featured 改造 + 验收 B1/B2/B3

8.2. Task 2：HomePostcard 印章布局重写 + DayTabs 4 主题高度对齐 + 验收 B4/B5/B6/B7

8.3. Task 3：emoji 清理 + 全局 grep 验证 + 验收 B8/B9/B10
