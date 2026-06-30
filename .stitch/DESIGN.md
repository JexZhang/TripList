---
name: 行迹
colors:
  background: '#FFF4E6'
  surface: '#FFFFFF'
  surface-2: '#FFF9F1'
  on-surface: '#2B1A10'
  on-surface-variant: '#5A4338'
  outline: 'rgba(43, 26, 16, 0.08)'
  primary: '#FF7A2E'
  primary-container: '#FFEBD6'
  secondary: '#6B46C1'
  tertiary: '#4FB286'
  warning: '#FFC247'
  error: '#FF5B5B'
  magazine-background: '#F4F0E8'
  magazine-primary: '#D62E2E'
  postcard-background: '#EFE6D5'
  postcard-primary: '#C13D2F'
  minimal-background: '#FAFAF8'
  minimal-primary: '#2B1A10'
typography:
  display:
    fontFamily: Noto Serif SC, Songti SC, STSong, serif
    fontSize: 52rpx
    fontWeight: '800'
    lineHeight: '1.15'
    letterSpacing: 2rpx
  title:
    fontFamily: var(--font-display)
    fontSize: 32rpx
    fontWeight: '700'
    lineHeight: '1.35'
    letterSpacing: 1rpx
  body:
    fontFamily: PingFang SC, Noto Sans SC, Source Han Sans SC, -apple-system, sans-serif
    fontSize: 26rpx
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label:
    fontFamily: var(--font-mono)
    fontSize: 22rpx
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 1rpx
rounded:
  xs: 12rpx
  sm: 16rpx
  md: 22rpx
  lg: 32rpx
  xl: 44rpx
  pill: 999rpx
spacing:
  page-x: 32rpx
  section-gap: 24rpx
  card-padding: 24rpx
  sheet-padding: 32rpx
  touch-min: 80rpx
---

# 1. Design System: 行迹

## 1.1. Visual Theme & Atmosphere

行迹是一个以旅行规划为核心的小程序界面，整体视觉语言建立在浅色纸感、轻量卡片、主题化变量和明确的触摸反馈之上。源码中的 `src/styles/tokens.scss` 定义了四套主题：手帖 `tegami`、刊物 `magazine`、护照 `postcard`、极简 `minimal`；每套主题共享相同语义变量，如 `--bg`、`--surface`、`--ink`、`--accent`、`--r-*`、`--shadow-*`，由 `theme-tokens theme-{name}` 根类切换。

默认手帖主题偏暖橘，页面背景带浅奶油色和局部径向光感，卡片圆角较大，阴影柔和，适合表达“轻松做攻略”的产品气质。其他主题不是换色皮肤，而是各自调整形状和排版语气：刊物主题更方、更硬、更像编辑目录；护照主题使用签证页、虚线、编号、水印等旅行证件意象；极简主题保留留白、低阴影和克制分隔线。

首页方向保持“少装饰、先创建、再发现、再个人行程”的结构。推荐内容以 `旅人精选` 呈现，和 `我的行程` 明确分层，不做底部常驻广告式信息流。模板库和阅读页强调只读感、搜索与天数筛选，视觉上复用现有主题 token，不依赖 emoji 装饰。

## 2. Color Palette & Roles

### 2.1. Primary Foundation

| 角色 | Token | 默认值 | 用途 |
|:---|:---|:---|:---|
| 页面背景 | `--bg` | `#FFF4E6` | 页面根底色、原生窗口回弹背景 |
| 深层背景 | `--bg-deep` | `#F4E6CE` | 深一点的纸面或分隔背景 |
| 柔背景 | `--bg-soft` | `#FFE9D1` | 弹层分组、取消区块、浅底强调 |
| 主表面 | `--surface` | `#FFFFFF` | 卡片、弹层、搜索框、分段控件 |
| 次表面 | `--surface-2` | `#FFF9F1` | 结果按压态、标签背景、次级容器 |
| 线条 | `--line` | `rgba(43, 26, 16, 0.08)` | 细分割线、输入边框 |
| 强线条 | `--line-2` | `rgba(43, 26, 16, 0.14)` | 弹层拖拽柄、虚线边框、较明显分隔 |

四主题基础色如下：

| 主题 | 背景 | 表面 | 主文字 | 主强调 |
|:---|:---|:---|:---|:---|
| 手帖 `tegami` | `#FFF4E6` | `#FFFFFF` | `#2B1A10` | `#FF7A2E` |
| 刊物 `magazine` | `#F4F0E8` | `#FFFFFF` | `#111111` | `#D62E2E` |
| 护照 `postcard` | `#EFE6D5` | `#FFFCF3` | `#2B1F0E` | `#C13D2F` |
| 极简 `minimal` | `#FAFAF8` | `#FFFFFF` | `#0F0F0E` | `#2B1A10` |

### 2.2. Accent & Interactive

| 角色 | Token | 默认值 | 用途 |
|:---|:---|:---|:---|
| 主强调 | `--accent` | `#FF7A2E` | CTA、选中 tab、可编辑入口、搜索手动添加 |
| 第二强调 | `--accent-2` | `#FF9A4D` | 渐变终点、活跃按钮过渡 |
| 强调浅色 | `--accent-soft` | `#FFD3A8` | 虚线边框、柔和光晕 |
| 强调背景 | `--accent-bg` | `#FFEBD6` | 二级按钮、按压态、输入背景 |
| AI / 特殊强调 | `--plum` | `#6B46C1` | AI 创建 tile、AI 状态光效 |
| 成功/自然 | `--leaf` | `#4FB286` | 绿色状态、自然主题色 |
| 阳光/提醒 | `--sun` | `#FFC247` | 暖色装饰、季节/天气语义 |

交互色通常通过渐变表达：选中 tab 使用 `linear-gradient(135deg, var(--accent), var(--accent-2))`；AI 入口使用 `var(--plum)` 到 `var(--accent)`；行程卡和地点卡用左侧 6-12rpx 色条强调当前对象。

### 2.3. Typography & Text Hierarchy

| 角色 | Token | 默认值 | 用途 |
|:---|:---|:---|:---|
| 主文字 | `--ink` | `#2B1A10` | 标题、正文主信息 |
| 次文字 | `--ink-2` | `#5A4338` | 元信息、正文辅助信息 |
| 弱文字 | `--ink-3` | `#9B8378` | 日期、提示、空态、说明 |
| 反白文字 | 固定 | `#FFFFFF` | 主按钮、选中胶囊、渐变卡片 |

### 2.4. Functional States

| 状态 | Token / 值 | 用途 |
|:---|:---|:---|
| 危险/删除 | `--coral` / 默认 `#FF5B5B` | 删除、危险操作、价格强调 |
| LIVE 状态 | `#ff3b3b` | `TripPhaseChip` 当前旅行状态脉冲 |
| 弹层遮罩 | `rgba(43, 26, 16, 0.45)` | Sheet、搜索、编辑弹层统一遮罩 |
| 禁用/弱化 | `opacity: 0.45-0.6` | 已结束行程、禁用按钮、弱提示 |
| 搜索/输入 hint | `var(--ink-3)` | 空态、输入提示、结果地址 |

## 3. Typography Rules

### 3.1. Font Families

系统字体以中文可读性优先：

| Token | 字体栈 | 性格 |
|:---|:---|:---|
| `--font-serif` | `Noto Serif SC`, `Songti SC`, `STSong`, `SimSun`, serif | 旅行手帐、标题、城市名，有纸本感 |
| `--font-sans` | `PingFang SC`, `Noto Sans SC`, `Source Han Sans SC`, `-apple-system`, sans-serif | 正文、表单、通用操作，清楚耐读 |
| `--font-mono` | `JetBrains Mono`, `SF Mono`, `Fira Code`, ui-monospace, monospace | 日期、编号、金额、天数、路线信息 |
| `--font-display` | 主题覆写 | 主题标题字体，刊物使用 Playfair Display，极简使用 sans |
| `--font-body` | 主题覆写 | 页面正文与控件字体 |

### 3.2. Hierarchy & Weights

大标题集中在 44-56rpx，常见于 trip hero、模板详情标题、预算总额。分区标题约 30-32rpx，权重 600-900，主题差异明显：手帖偏圆润 700，刊物常用 900 与粗线，极简为 600。正文和列表主信息多在 26-30rpx；弱信息、标签、日期、地址多在 18-24rpx。

金额、日期、天数、编号使用等宽体强化信息感。例如预算总额 `56rpx / 800 / var(--font-mono)`，行程卡 meta `22rpx / var(--font-mono)`，地图路线日序 `20-26rpx / var(--font-mono 或 serif)`。

### 3.3. Spacing Principles

标题和标签允许轻微字距，常见 `letter-spacing: 1-4rpx`，用于日期、英文副标题、编号和 chip。正文不使用负字距。行高以紧凑移动端为主：标题 `1.15-1.35`，说明文本约 `1.5`。布局密度保持小程序触控友好，主要按钮高度约 80-88rpx，底部 sheet 操作项高度约 80rpx 以上。

## 4. Component Stylings

### 4.1. Buttons

主按钮使用 `var(--accent)` 或 `linear-gradient(135deg, var(--accent), var(--accent-2))`，白字，圆角随主题走 `var(--r-md)` 到 `var(--r-pill)`。全局按钮按压会 `scale(0.96)`，多数局部按钮使用 `0.94-0.985` 的轻微缩放。次级按钮使用 `var(--accent-bg)` 或 `var(--surface)`，文字为 `var(--ink-2)` 或 `var(--accent)`；危险按钮使用 `var(--coral)`。

创建入口是首页最强按钮组：AI 规划 tile 占比更大，使用紫到橘的渐变、扫光和 `pulse-glow`；手动新建 tile 使用深色 `var(--ink)` 底。模板详情底部 CTA 固定在底部，`24px` padding，`16px` 圆角，强调“复制为我的行程”。

### 4.2. Cards & Containers

卡片以 `var(--surface)` 为底，圆角使用 `var(--r-md)`、`var(--r-lg)` 或 `var(--r-xl)`，阴影使用 `var(--shadow-sm/md/lg)`。手帖卡片有轻微旋转和左侧渐变色条；刊物卡片更像目录行，方角、粗边和低圆角；护照卡片使用虚线、签证编号、水印和纸页阴影；极简卡片保留分隔线和低阴影。

模板库卡片是全宽列表卡：顶部 8px 渐变 ink 条，主体 36-40px 内边距，标题用 display 字体，天数胶囊用等宽体。`旅人精选` 首页卡是横向滚动 280rpx 小封面，封面渐变由 `templateCoverColors` 根据城市和季节确定性生成。

### 4.3. Navigation

页面顶部多为极简栏：左侧日期或返回按钮，右侧头像/菜单。Trip 主导航为 pill tab：容器 `var(--surface)`、`var(--r-pill)`、8rpx 内边距，选中项使用强调渐变和白字。模板详情使用上下边框 tab，未选中为 `var(--ink-3)`，选中为 `var(--accent)`。

地图页存在三种路线控制视觉：颜色胶囊条、分段控制器、路线卡片条。共同规则是横向滑动、等宽信息字体、选中态填充主题色并轻微上移或加阴影。

### 4.4. Inputs & Forms

搜索框和输入框使用浅底、圆角和主题边框。模板库搜索是 pill 形 `var(--surface)` 容器，`1px solid var(--line)`，输入文字 28px；地点搜索 sheet 的输入使用 `var(--bg)` 底、`2rpx transparent` 边框、`var(--r-sm)` 圆角。Profile setup 的输入高 80rpx，背景 `var(--accent-bg)`，圆角 `var(--r-md)`。

筛选 chip 使用 pill 形，默认 `var(--surface)` 与 `var(--line)`，选中后 `var(--accent)` 填充、白字，并有轻微 `scale(1.05)`。天数筛选是模板库的主检索控件，需要明显但紧凑。

### 4.5. Sheets & Modals

底部 sheet 是统一移动端容器：遮罩 `rgba(43, 26, 16, 0.45)`，内容从底部弹出，顶部圆角 `var(--r-xl) var(--r-xl) 0 0`，顶部有 72rpx x 8rpx 的拖拽柄，阴影为 `0 -16rpx 48rpx rgba(43, 26, 16, 0.15)`。搜索、协作、复制、编辑地点、行程整理、日期调整等弹层都遵循这个模式。

### 4.6. Domain-Specific Components

行程地点卡 `spot-card` 使用左侧 6rpx 强调条、时间等宽体、地点名称主文本、价格 coral 等宽体；按压时轻微缩放并提升阴影。预算视图使用总额卡、donut、图例、折线卡和“最贵一笔”渐变卡，数值均倾向等宽体。地图视图以真实地图为主，控件漂浮在上方或右下，定位按钮为 80rpx 圆形白底。

图标系统使用 `View + CSS mask` 的单色线条图标，线条约 1.7，颜色由 `backgroundColor` 接收 token。图标覆盖搜索、地点、标签、协作、日历、四个主视图、地点类型、确认、关闭、箭头等；这是全 app 的方向，避免 emoji 作为装饰或功能图标。

## 5. Layout Principles

### 5.1. Grid & Structure

这是移动端小程序优先的布局系统，主要单位为 `rpx`，部分库页使用 `px`。页面根通常 `min-height: 100vh`，横向溢出被全局 `.theme-tokens` 裁剪。核心页面使用纵向流：顶部极简栏、创建/hero、横滑推荐、列表或功能 view。多数内容边距为 24-32rpx，卡片内部 20-40rpx。

### 5.2. Whitespace Strategy

首页和个人行程列表强调留白，首屏不堆欢迎语和过多装饰。创建台靠前，`旅人精选` 作为明确发现区，个人行程使用单一时间顺序列表。功能页密度更高，但每个操作块仍保持触摸目标和可读间距：卡片 gap 常见 12-24rpx，库页列表 gap 为 32px。

### 5.3. Alignment & Visual Balance

信息以左对齐为主，数字和金额靠右或用等宽体形成秩序。视觉重量由主题决定：手帖靠圆角、暖色和色条；刊物靠粗线、编号和强字重；护照靠纸页边界、虚线和水印；极简靠分割线和留白。横滑内容保留左右 32rpx padding，避免贴边。

### 5.4. Responsive Behavior & Touch

项目面向 Taro 多端，云能力以 weapp 为主。设计上以小屏触控为基准：按钮、胶囊、sheet item、定位按钮都接近或超过 80rpx 高；横向内容通过 ScrollView/nowrap 处理，不依赖桌面断点。`useThemeClass` 会同步原生背景色，避免微信小程序上下回弹露白。

### 5.5. Motion & Feedback

全局动画集中在 `src/styles/animations.scss`：页面进入 `page-in`、普通淡入 `fade-in`、卡片上浮 `slide-up`、弹层 `sheet-up`、局部弹入 `pop-in`、AI 扫光/脉冲和地图 pin 弹跳。动效时间多在 0.18-0.42s，曲线使用 `--ease-out`、`--ease-in-out`、`--ease-spring`。动效要轻，不应盖过内容。

## 6. Design System Notes for Stitch Generation

### 6.1. Language to Use

用“移动端旅行手帐”“轻纸感”“主题化小程序”“可触摸的卡片和底部 sheet”“暖色创建入口”“只读模板攻略库”“原生地图与行程视图复用”来描述。避免泛化成营销落地页，也不要写成桌面 SaaS；它是一个真实可操作的小程序工具。

### 6.2. Color References

默认生成可先使用手帖主题：奶油背景 `#FFF4E6`、白色卡片 `#FFFFFF`、深棕文字 `#2B1A10`、橘色强调 `#FF7A2E`、浅橘强调底 `#FFEBD6`、紫色 AI 强调 `#6B46C1`、珊瑚危险 `#FF5B5B`。需要主题变体时，用同一布局替换为刊物红黑、护照牛皮纸红章、极简黑白低阴影。

### 6.3. Component Prompts

1. 创建一个微信小程序旅行首页，顶部留白克制，先放两个创建 tile：AI 规划更宽、紫橘渐变、轻微扫光；手动新建为深色 tile。下方是横滑“旅人精选”封面卡，再下方是时间排序的“我的行程”列表。
2. 创建一个行程详情页，顶部是主题 hero 卡，标题 52rpx、纸感背景和暖色光斑；下方是 pill tab 切换行程、地图、预算、行李。行程地点卡用左侧渐变条、等宽时间、地点名和珊瑚色价格。
3. 创建一个模板库页面，顶部 pill 搜索框，紧凑天数筛选 chip，更多筛选可展开；列表卡全宽、顶部细渐变条、标题用衬线 display 字体，天数为等宽胶囊，标签为浅底描边。
4. 创建一个底部 sheet，半透明暖棕遮罩，白色表面，顶部大圆角和拖拽柄，操作项 30rpx 半粗体，危险操作用 coral。

### 6.4. Incremental Iteration

优先从 token 和四主题根类还原，不要新增未在源码出现的 CSS 变量。先做手帖默认主题，再根据相同语义 token 派生刊物、护照、极简。模板和推荐内容使用原创的几何/纸感视觉，不临摹第三方旅行 app；图标使用单色 CSS mask 风格，不使用 emoji 装饰。移动端要检查文字是否在按钮、chip、卡片内换行合理，横向滚动控件不要挤压主内容。
