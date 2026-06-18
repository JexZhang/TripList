# 首页卡片分隔增强 + 四主题空态设计

## 概述

改进首页「我的行程」区域的两个体验问题：
1. 四主题的卡片之间视觉界限模糊，难以一眼区分
2. Tegami / Magazine / Minimal 三个主题缺少空态设计，新用户看到空白

## 设计决策

- **卡片分隔**：轻度调整 — 保持各主题现有设计语言（圆角/方角、旋转、阴影等特色不变），仅增强卡片之间的视觉分隔
- **空态**：纯引导 — 每个主题的引导文案统一涵盖「AI 规划」和「旅人精选」两个入口
- **不改 border-radius**：AIGlowWrap 光效已匹配各主题的卡片形状，改动圆角会导致光效溢出或错位

## Part 1：卡片分隔增强

### 约束

- 不修改任何卡片的 `border-radius` 值
- 不影响 AIGlowWrap 的 `padding: 8px` 灯带间隙和 `border-radius` 计算
- 不影响卡片的入场动画、:active 交互、旋转（Tegami）等现有行为

### Postcard（签证页）

**当前**：卡片通过 `border-top: 1rpx dashed var(--line)` 虚线分隔，`gap: 0`。

**改动**：
- `.hpp-stamps`：`gap: 0` → `gap: 16rpx`
- `.hpp-card`：
  - 去掉 `border-top: 1rpx dashed var(--line)`
  - 去掉 `.hpp-card:first-child { border-top: none }` 规则
  - `padding: 24rpx 0` → `padding: 24rpx 16rpx`
  - 保持 `background: var(--surface)`（与签证页纸面底色融合）
  - 不添加 box-shadow（保持签证页平面感）

### Tegami（信件）

**当前**：卡片通过 `margin-top: -14rpx` 重叠叠放，`gap: 0`。

**改动**：
- `.ht-stack`：`gap: 0` → `gap: 20rpx`
- `.ht-card`：
  - `margin-top: -14rpx` → `margin-top: 0`（或直接删除）
  - 去掉 `.ht-card:first-child { margin-top: 0 }` 规则
  - 保留 `border-radius: var(--r-lg)`、`box-shadow: var(--shadow-md)`、旋转 class 不变

### Magazine（杂志）

**当前**：卡片通过 `border-bottom: 1rpx solid var(--line)` 分隔。

**改动**：
- `.hm-list`：添加 `display: flex; flex-direction: column; gap: 12rpx`
- `.hm-row`：
  - 去掉 `border-bottom: 1rpx solid var(--line)`
  - `padding: 24rpx 0` → `padding: 24rpx 16rpx`
  - 添加 `background: var(--surface); border-radius: var(--r-sm)`（`--r-sm` 在 tokens.scss 中定义为 `16rpx`）
  - 不添加 box-shadow（保持杂志平面编辑风格）

### Minimal（极简）

**当前**：卡片通过 `border-bottom: 1rpx solid var(--line)` 分隔。

**改动**：
- `.hmin-list`：`gap` 保持 0，改用更粗分隔线
- `.hmin-row`：
  - `border-bottom: 1rpx solid var(--line)` → `border-bottom: 2rpx solid var(--line-2)`
  - `padding: 28rpx 0` → `padding: 32rpx 0`（增大行间距）
  - 保持极简风格，不加背景块和阴影

### AIGlowWrap 兼容性确认

| 主题 | AIGlowWrap 用法 | 卡片圆角 | 改动后影响 |
|------|---------|---------|---------|
| Postcard | `aiglow--row`（方形） | 无 | 无影响，间距在卡片之间，光效包裹单卡 |
| Tegami | 默认（`var(--r-lg)`） | `var(--r-lg)` | 无影响，去掉负 margin 后间距更自然 |
| Magazine | `aiglow--row`（方形） | 无 | 无影响 |
| Minimal | `aiglow--row`（方形） | 无 | 无影响 |

## Part 2：四主题空态设计

### 约束

- 空态仅替换「我的行程」区块内容
- 顶部栏、创建台（AI 规划 + 手动创建）、旅人精选始终显示，不受影响
- 每个主题保持自身图标和文案风格
- 引导文案统一涵盖「AI 规划」和「旅人精选」

### 空态结构

抽取共用空态组件或各主题内联实现，结构统一为：
```
图标（主题特有）
标题（主题特有）
引导文案（两行，分别提到 AI 规划 和 旅人精选）
```

### Postcard（签证页）

已有空态，修改文案：
- 图标：`○`（保留）
- 标题：尚无签证（保留）
- 文案：
  - 用「AI 规划」一键生成行程
  - 或从「旅人精选」挑选模板开始
- 页脚 `— 0 / ∞ —`（保留）

### Tegami（信件）

新增空态：
- 图标：`✉`
- 标题：还没有信件
- 文案：
  - 试试「AI 规划」让行程自动生成
  - 也可以逛逛「旅人精选」找找灵感
- 样式：虚线边框 `1px dashed`，淡橙背景 `rgba(255,122,46,0.04)`

### Magazine（杂志）

新增空态：
- 图标：`№`（衬线字体）
- 标题：第一期尚未发行
- 文案：
  - 点击「AI 规划」让 AI 编排你的创刊号
  - 或从「旅人精选」克隆一个模板
- 样式：无额外装饰，保持杂志编辑风格

### Minimal（极简）

新增空态：
- 图标：`∅`（等宽字体）
- 标题：暂无行程
- 文案：
  - 「AI 规划」帮你一键生成完整行程
  - 「旅人精选」有更多模板可供参考
- 样式：极简，无额外装饰

## 涉及文件

| 文件 | 改动类型 |
|------|---------|
| `src/pages/home/styles/home-postcard.scss` | 修改卡片分隔样式 |
| `src/pages/home/HomePostcard.tsx` | 修改空态文案 |
| `src/pages/home/styles/home-tegami.scss` | 修改卡片分隔样式 |
| `src/pages/home/HomeTegami.tsx` | 新增空态 UI |
| `src/pages/home/styles/home-magazine.scss` | 修改卡片分隔样式 |
| `src/pages/home/HomeMagazine.tsx` | 新增空态 UI |
| `src/pages/home/styles/home-minimal.scss` | 修改卡片分隔样式 |
| `src/pages/home/HomeMinimal.tsx` | 新增空态 UI |
| `src/pages/home/shared.tsx`（可选） | 抽取空态配置数据 |
