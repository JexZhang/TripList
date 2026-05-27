# AI 状态展示视觉规格 · HomeCardAIRow + TripAIStatusBar

> 4 主题 × 3 状态 = 12 个视觉规格。HomeCardAIRow 与 TripAIStatusBar 共享同一套主题/状态视觉语言；前者嵌在卡片底部、宽度跟随卡片，后者在 trip 攻略页顶部、宽度撑满父容器。本规格仅约束**视觉语言**与**动效要点**，不约束业务逻辑。

## 1. 共享设计原则

1.1. **不占位**：`aiStatus` 为 `null` 时整条组件不渲染，不留空白边距。

1.2. **三态文案固定**：
   - generating: `AI 正在为你编排`
   - ready: `AI 草稿就绪 · 点击查看`
   - error: `AI 生成失败 · 点击重试`

1.3. **token-only**：颜色、字号、圆角、阴影全部走 `--accent / --ink / --line / --surface / --bg-soft / --coral / --shadow-*` 等现有 CSS 变量；本文件不写死任何 hex。变量来源 `src/styles/tokens.scss`。

1.4. **无 emoji**：装饰一律用 DOM/SVG/伪元素 + 主题描边/纹理。所有「闪星 / sparkle」一律复用现有组件 [`<SparkleIcon />`](../../../src/components/SparkleIcon/index.tsx)（三颗星 mask-image SVG，颜色经 `--sparkle-color` 或 `currentColor` 控制），不写文本 `✦` 字符、不引入新 SVG。本规格 DOM 草图中出现的「✦」仅为示意，落地时全部替换为 `<SparkleIcon size={36} />`。

1.5. **动效语义**：
   - generating 必须有持续动态：shine 扫光 / 跳点 / 旋转环 / 邮戳呼吸 之一以上
   - ready 必须有「邀请点击」提示：右侧箭头或滑入抖动一次
   - error 必须有 red token（沿用 `--coral`），并伴随 6rpx 的水平 shake 一次

1.6. **尺寸基线（跨主题统一）**：
   - 行高（容器高度）：`88rpx` ± 4rpx
   - 文字字号：`28rpx`（body）/ `24rpx`（hint）
   - 内边距：`20rpx 28rpx`
   - 图标尺寸：`36rpx`（左侧 sparkle）/ `28rpx`（右侧箭头）

1.7. **共享 DOM 骨架**（HomeCardAIRow / TripAIStatusBar 同构）：

```
.hc-ai (or .taisb)  // 状态类：.is-generating | .is-ready | .is-error
├── .hc-ai-deco         // 主题装饰位（折角 / 报头 / 椭圆戳 / hairline）
├── .hc-ai-shine        // generating 专属，扫光
├── .hc-ai-icon         // 包裹 <SparkleIcon size={36} />；color 由父级 css 变量驱动 currentColor
├── .hc-ai-text         // 主文案
├── .hc-ai-meta         // 可选 hint（如倒计时）
├── .hc-ai-dots         // generating 专属，三跳点
└── .hc-ai-arrow        // ready/error 专属，右侧引导符
```

1.8. **可达性**：整条作为 tap target，最小 88rpx 高度；error/ready 须有视觉对比，generating 不依赖颜色单独传达（必须有动效）。

---

## 2. 主题 1 · tegami 手帖（信封折角 · 邮戳字母 · 暖橘描边）

### 2.1. tegami / generating

2.1.1. **DOM 草图**

```
┌──────────────────────────────────────────────┐╲
│ ✦   AI 正在为你编排…           ● ● ●          │ ╲  ← 右上信封折角（伪元素）
└──────────────────────────────────────────────┘
   ⤷ 整条横向暖橘 shine 从左扫到右
```

2.1.2. **token 列表**
   - 背景：`background: var(--bg-soft);`
   - 描边：`border: 2rpx dashed var(--accent);`（手写邮戳虚线）
   - 圆角：`var(--r-md)`
   - 文字色：`var(--ink)`
   - icon 色：`var(--accent)`
   - shine：`linear-gradient(110deg, transparent 0%, var(--accent-soft) 50%, transparent 100%)`，`opacity: .55`
   - 阴影：`var(--shadow-sm)`
   - 折角伪元素：`background: var(--accent-soft); clip-path: polygon(100% 0, 100% 100%, 0 100%);`

2.1.3. **动效**
   - `.hc-ai-shine`：`translateX(-120%) → 120%`，3.2s linear infinite
   - `.hc-ai-dots .hc-ai-dot:nth-child(n)`：opacity 0.3 ↔ 1，0.9s 错相，`animation-delay: 0 / .15s / .3s`
   - 折角 hover：旋转 -2deg（小程序无 hover，省略）

---

### 2.2. tegami / ready

2.2.1. **DOM 草图**

```
┌──────────────────────────────────────────────┐╲
│ ✦   AI 草稿就绪 · 点击查看              ›    │ ╲
└──────────────────────────────────────────────┘
   ⤷ 左侧出现一枚邮戳印章「READY」轻贴文本上方
```

2.2.2. **token 列表**
   - 背景：`linear-gradient(135deg, var(--accent-bg), var(--surface-2))`
   - 描边：`border: 2rpx solid var(--accent);`（确认态：实线）
   - 圆角：`var(--r-md)`
   - 文字色：`var(--ink)`；箭头色：`var(--accent)`
   - 邮戳装饰：右上小圆 + 字母「READY」用 `var(--font-mono)`，色 `var(--accent)`，`opacity: .6`
   - 阴影：`var(--shadow-md)`

2.2.3. **动效**
   - 进入：`translateY(8rpx) → 0`，opacity 0 → 1，280ms `var(--ease-out)`
   - 箭头：循环 4s，`translateX(0 → 6rpx → 0)`，闲置 2s 后再触发（infinite ease-in-out）

---

### 2.3. tegami / error

2.3.1. **DOM 草图**

```
┌──────────────────────────────────────────────┐╲
│ ⚠   AI 生成失败 · 点击重试              ↻    │
└──────────────────────────────────────────────┘
   ⤷ 整条以暖橘转珊瑚色，左侧 SparkleIcon 改用 coral 着色（--sparkle-color: var(--coral)）
```

2.3.2. **token 列表**
   - 背景：`color-mix(in srgb, var(--coral) 8%, var(--bg-soft))`（兜底 `var(--bg-soft)`）
   - 描边：`border: 2rpx dashed var(--coral);`
   - 文字色：`var(--ink)`；图标色 `var(--coral)`
   - 重试 icon：等粗 circle-arrow，色 `var(--coral)`
   - 阴影：`var(--shadow-sm)`

2.3.3. **动效**
   - 进入 shake：`translateX(0 → -6rpx → 6rpx → 0)`，280ms 一次
   - 重试 icon：闲置 3s 后自转 360deg / 0.8s ease-in-out，循环

---

## 3. 主题 2 · magazine 刊物（报头横线 · 装订小圆点 · 黑底白字数字标号）

### 3.1. magazine / generating

3.1.1. **DOM 草图**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│ 01  AI 正在为你编排…              ▮▮▮         │
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 · · · · · · · · · ·  ← 底部装订点
```

3.1.2. **token 列表**
   - 背景：`var(--surface)`
   - 顶/底：`border-top: 2rpx solid var(--ink); border-bottom: 2rpx solid var(--ink);`（报头双线）
   - 圆角：`0`（杂志硬切）
   - 数字标号：左侧 `01` 用 `var(--font-mono)`，`background: var(--ink); color: var(--surface); padding: 4rpx 10rpx;`
   - 文字色：`var(--ink)`；字体 `var(--font-display)`
   - 跳点：方块条状 `▮`，色 `var(--ink)`
   - 装订点伪元素：`::after { content: ''; }` 横向 8 个 `var(--ink-3)` 实心圆点

3.1.3. **动效**
   - 跳点：3 个方块 `scaleY(0.4 ↔ 1)`，0.7s 错相
   - 报头线：无动效（杂志静态稳重）
   - 进入：opacity 0 → 1，120ms

---

### 3.2. magazine / ready

3.2.1. **DOM 草图**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│ ▶   AI 草稿就绪 · 点击查看            READ →  │
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

3.2.2. **token 列表**
   - 背景：`var(--ink)`（反色块，强信号）
   - 文字色：`var(--surface)`
   - 报头线在反色态改为 `border-color: var(--surface)`，宽 2rpx
   - 数字位替换为 ▶ 字符（黑体），色 `var(--surface)`
   - 右侧「READ →」：`var(--font-mono)`，字号 22rpx，`letter-spacing: 2rpx`
   - 阴影：`var(--shadow-md)`

3.2.3. **动效**
   - 进入：高度从 0 → 88rpx，180ms `var(--ease-out)`，文本随后淡入
   - 「→」：循环 2.4s `translateX(0 → 8rpx → 0)`

---

### 3.3. magazine / error

3.3.1. **DOM 草图**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│ ERR  AI 生成失败 · 点击重试           RETRY ↻ │   ← 顶线红、底线红
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

3.3.2. **token 列表**
   - 背景：`var(--surface)`
   - 顶/底线：`border-color: var(--coral); border-width: 2rpx solid;`
   - 「ERR」标号：`background: var(--coral); color: var(--surface);`，`var(--font-mono)`
   - 文字色：`var(--ink)`；右侧「RETRY ↻」：色 `var(--coral)`
   - 圆角：`0`

3.3.3. **动效**
   - 进入：水平 shake `-6rpx ↔ 6rpx` 一次，220ms
   - 「↻」：每 2s 自转一周

---

## 4. 主题 3 · postcard 明信片（椭圆戳轮廓 · 虚线边 · 牛皮纸底色）

### 4.1. postcard / generating

4.1.1. **DOM 草图**

```
╔══════════════════════════════════════════════╗
║  ◌  AI 正在为你编排…             · · ·       ║   ← 虚线边
╚══════════════════════════════════════════════╝
       ⤷ 左侧椭圆戳轮廓里嵌 sparkle，戳一圈缓慢旋转
```

4.1.2. **token 列表**
   - 背景：`var(--bg-soft)`（牛皮纸）
   - 描边：`border: 2rpx dashed var(--line-2);`
   - 圆角：`var(--r-lg)`（柔角）
   - 椭圆戳：`width:64rpx; height:44rpx; border:2rpx solid var(--accent); border-radius: 999rpx;`
   - 内嵌 sparkle：色 `var(--accent)`
   - 跳点：`var(--accent)` 实心圆
   - 阴影：`var(--shadow-sm)`

4.1.3. **动效**
   - 椭圆戳：`rotate(-3deg) → rotate(3deg)` 缓慢摆动，2.6s ease-in-out infinite
   - 跳点：opacity 跑马灯
   - 虚线边：`background-position` 缓慢移动模拟「邮路」（可选）

---

### 4.2. postcard / ready

4.2.1. **DOM 草图**

```
╔══════════════════════════════════════════════╗
║ ⬭ARR  AI 草稿就绪 · 点击查看          ✈ →    ║
╚══════════════════════════════════════════════╝
   ⤷ 椭圆戳里加上「ARR」字样，整体微微抬起阴影
```

4.2.2. **token 列表**
   - 背景：`var(--surface-2)`
   - 描边：`border: 2rpx solid var(--accent);`（虚 → 实，确认到达）
   - 椭圆戳内字「ARR」：`var(--font-mono)`，色 `var(--accent)`
   - 文字色：`var(--ink)`
   - 「✈」用 SVG 路径（纸飞机），色 `var(--accent)`
   - 阴影：`var(--shadow-md)`

4.2.3. **动效**
   - 进入：缩放 `scale(0.96 → 1)`，220ms `var(--ease-spring)`
   - 纸飞机：闲置 1.6s，触发 `translateX(0 → 10rpx) + rotate(0 → -6deg)`，复位 220ms

---

### 4.3. postcard / error

4.3.1. **DOM 草图**

```
╔══════════════════════════════════════════════╗
║ ⬭✕   AI 生成失败 · 点击重试            ↻      ║   ← 戳变红
╚══════════════════════════════════════════════╝
```

4.3.2. **token 列表**
   - 背景：`color-mix(in srgb, var(--coral) 6%, var(--bg-soft))`（兜底 `var(--bg-soft)`）
   - 描边：`border: 2rpx dashed var(--coral);`
   - 椭圆戳：`border-color: var(--coral);` 内嵌 ✕（用 SVG）
   - 文字色：`var(--ink)`；icon 色 `var(--coral)`

4.3.3. **动效**
   - 进入 shake：`-6rpx ↔ 6rpx` 一次
   - 戳：呼吸缩放 `scale(1 → 1.04 → 1)`，1.6s infinite

---

## 5. 主题 4 · minimal 极简（极细 hairline · 等宽数字 · 大量留白）

### 5.1. minimal / generating

5.1.1. **DOM 草图**

```
                                                  
 ─  AI 正在为你编排                      03/05   
                                                  
─────────────────────────────────────────────────  ← 底部 1rpx hairline
```

5.1.2. **token 列表**
   - 背景：`transparent`
   - 顶/底：`border-bottom: 1rpx solid var(--line);`（仅底 hairline）
   - 圆角：`0`
   - 文字色：`var(--ink-2)`；数字进度 `var(--ink-3)`，`var(--font-mono)`
   - 左侧 sparkle 改为 1rpx 极细短横「─」长 24rpx，色 `var(--ink-2)`
   - 内边距：`28rpx 32rpx`（更宽松）
   - 阴影：无

5.1.3. **动效**
   - 短横：「─」`width: 24rpx → 48rpx → 24rpx`，1.8s ease-in-out infinite（呼吸延伸）
   - 文本：不动；信息密度全交给「等宽数字进度」（如 `03/05` 表示 5 阶段中的第 3 阶段）
   - 进入：opacity 0 → 1，160ms

---

### 5.2. minimal / ready

5.2.1. **DOM 草图**

```
 ─  AI 草稿就绪 · 点击查看                  →   
─────────────────────────────────────────────────
```

5.2.2. **token 列表**
   - 背景：`var(--surface)`（仅这一态加微弱面）
   - 底线：`border-bottom: 1rpx solid var(--ink);`（hairline 加深表达「可点」）
   - 文字色：`var(--ink)`；箭头色 `var(--ink)`
   - 左侧短横：色 `var(--ink)`
   - 阴影：无

5.2.3. **动效**
   - 进入：底线 `scaleX(0 → 1)`，280ms `var(--ease-out)`，`transform-origin: left`
   - 箭头：`translateX(0 → 4rpx → 0)`，2.4s infinite

---

### 5.3. minimal / error

5.3.1. **DOM 草图**

```
 ─  AI 生成失败 · 点击重试                  ↻   
─────────────────────────────────────────────────  ← 底线变红
```

5.3.2. **token 列表**
   - 背景：`transparent`
   - 底线：`border-bottom: 1rpx solid var(--coral);`
   - 文字色：`var(--ink)`；左侧短横、右侧 ↻ 色 `var(--coral)`
   - 阴影：无

5.3.3. **动效**
   - 进入：底线 `scaleX(0 → 1)` 后 shake 一次 `-4rpx ↔ 4rpx`
   - ↻：每 2.4s 自转一周（极简：不要太频繁）

---

## 6. 实现注意

6.1. **CSS 变量挂载**：`HomeCardAIRow` 跟随其父卡片的主题作用域；`TripAIStatusBar` 跟随 trip 页 `theme-{name}` 根。`.theme-tokens` 仅 RootPortal 兜底用，不要直接挂在这两个组件上。

6.2. **`.hc-ai-deco`** 与 `.hc-ai-shine` 在 SCSS 里默认 `display: none`，由各主题选择器单独打开（避免跨主题渗漏）。

6.3. **动效优先级**：generating > ready > error。同时存在时按当前 `aiStatus` 唯一渲染。

6.4. **小程序限制**：`color-mix()`、`clip-path` 在低版本基础库不可用，需 fallback：tegami 折角可用 `linear-gradient(135deg, transparent 50%, var(--accent-soft) 50%)` 模拟；error 背景在不支持 `color-mix()` 时回退到 `var(--bg-soft)` 加上 `border-color: var(--coral)` 表达「红」。

6.5. **TripAIStatusBar 宽度差异**：与 HomeCardAIRow 视觉一致，唯独 `width: 100%` 且左右 padding 改为 `32rpx`（trip 页边距更宽）。其余 token / 动效一致。

6.6. **进入/退出动画顶层封装**：所有状态切换均经由短暂 `opacity` + `translateY(6rpx)` 过渡（180–280ms `var(--ease-out)`），主题内动效叠加在此之上。
