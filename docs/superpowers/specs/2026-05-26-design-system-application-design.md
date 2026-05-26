# 行册 · 四主题设计体系落地方案

1. 元信息
   - 1.1. 日期：2026-05-26
   - 1.2. 状态：设计稿已定稿，待实施
   - 1.3. 设计来源：`triplist-design/project/`（Claude Design 导出包）
   - 1.4. 目标平台：Taro 4.x React 多端（H5 + 微信小程序为主）

2. 设计意图（Aesthetic POV）

   本次不是"换皮肤"，而是把 **"旅行册"的纸质媒介隐喻** 完整落入产品。
   四主题对应四种纸质媒介的人格，每种都强烈、互不调和，让用户在测试期
   选出自己最契合的人格作为长期默认。

   - 2.1. **手帖 tegami**（暖橘活力）
      - 隐喻：把每条 trip 当成一张写给未来的明信片，堆叠在桌面
      - 人格：温暖、亲和、像下午三点的橘子汁
      - 关键视觉：圆润大圆角、暖橘渐变、纸张颗粒、轻柔阴影、堆叠错位
   - 2.2. **刊物 magazine**（冷峻编辑感）
      - 隐喻：每段旅程是杂志的一期 cover story，有刊号、栏目、目录、条形码
      - 人格：理性、克制、像 *Monocle / Kinfolk* 的编辑部
      - 关键视觉：直角、Playfair Display 大字号、红色 accent、双线分割、栏目化目录
   - 2.3. **护照 postcard**（复古牛皮纸）
      - 隐喻：旅行护照内页，每段旅程是一枚签证盖戳，按天数大小排布
      - 人格：怀旧、有重量、像 70 年代外交官的牛皮文件夹
      - 关键视觉：斜纹纸纹背景、深棕墨水、椭圆盖戳、烫金质感
   - 2.4. **极简 minimal**（清爽留白）
      - 隐喻：一份用 PingFang 写在白纸上的清单
      - 人格：克制、安静、像无印良品的产品标签
      - 关键视觉：大量留白、极淡边线、墨色单色、几乎无圆角

   > 设计稿原文（tokens.css L13–L191）已给出四套完整 tokens。落地必须保留
   > 原稿的"风格落差"——不能为了"统一感"把 magazine 圆角调圆、把 minimal
   > 加阴影；每套 token 都是经过设计推敲的整体，落地按原稿 px→rpx 等比换算。

3. 已确认的设计决策

   | 编号 | 决策 | 取值 |
   | --- | --- | --- |
   | C1 | Logo 样式 | 仅"钤印 seal" |
   | C2 | 杂志封面 | 仅"照片框 photoframe"，默认图 + 自定义上传 |
   | C3 | 主题数量 | 完整 4 套（tegami / magazine / postcard / minimal） |
   | C4 | 主题作用范围 | home / trip / itinerary / budget / packing 全部做 4 套版式；map 仅跟随 token |
   | C5 | 主题切换入口 | "我的"页内主题卡片选择 |
   | C6 | "我的"页入口 | home 右上角圆形头像 |
   | C7 | 主题存储 | 云端 `users.theme`；未登录态存本地，登录后云端优先 |
   | C8 | 主题切换动效 | 无（瞬时切换） |
   | C9 | 首页底部 CTA | 方案 3：上 AI（强调态 + 动效）+ 下 新建（次级线框） |
   | C10 | AI 入口动效 | 复用 trip 页 AI Badge（shine + 渐变 + dots） |
   | C11 | AI 就绪态 | 删除"印章"，靠卡片 AI 行 + 自动弹 Preview（沿用现草稿流） |
   | C12 | 自定义封面比例 | 16:10 |
   | C13 | 中文主题名 | 手帖 / 刊物 / 护照 / 极简 |

4. 架构变更

   4.1. 主题分层（CSS token）
      - 4.1.1. 新建 `src/styles/tokens.scss`：搬运设计稿 `tokens.css` 全部
        四个 `.theme-*` 块，px→rpx 等比换算（1px ≈ 2rpx，按 750rpx
        设计宽度为基线）
      - 4.1.2. 每个 page 根 View 同时挂 `theme-tokens theme-{name}` 两个
        className；`theme-tokens` 兜底 root-portal 子树（已有先例
        `src/app.scss` L51）
      - 4.1.3. 现 `src/app.scss` 顶部硬编码的 tegami token 块迁出至
        `tokens.scss` 默认 block，保留 keyframes 单独迁入
        `src/styles/animations.scss`
      - 4.1.4. 移植设计稿 keyframes 全集：`page-in / fade-in / slide-up /
        pop-in / sheet-up / shimmer / pulse-glow / spin / stamp-down /
        typing-blink / drop-in / ai-thinking-dots / float-y / pin-bounce`

   4.2. 主题状态管理
      - 4.2.1. 新建 `src/store/theme-store.tsx`（React Context + 持久化）
        ```typescript
        export type ThemeName = 'tegami' | 'magazine' | 'postcard' | 'minimal'
        interface ThemeCtx {
          theme: ThemeName
          setTheme: (next: ThemeName) => void
        }
        ```
      - 4.2.2. 初值解析顺序：cloud `users.theme` > local Storage
        `theme:selected` > 默认 `tegami`
      - 4.2.3. 未登录态切换：写 Storage；登录回调内若 cloud 无值则把
        Storage 值上传一次（cloud 已有则以 cloud 为准并覆盖本地）
      - 4.2.4. `setTheme` 同步写 cloud + Storage；UI 仅监听 Context 触发
        重渲

   4.3. 数据 schema
      - 4.3.1. 后端 `users` 集合新增字段：
        ```
        theme: 'tegami' | 'magazine' | 'postcard' | 'minimal' | null
        ```
        未设置视作 null；前端兜底为 `tegami`
      - 4.3.2. `Trip` 类型 (`src/types/trip.ts`) 新增字段：
        ```typescript
        coverUrl?: string | null
        ```
        默认 null，UI 层兜底为 `default-cover.jpg`
      - 4.3.3. `me-store` `Me` 接口扩展：
        ```typescript
        interface Me {
          openid: string
          nickname: string
          avatarUrl: string
          theme?: ThemeName | null
        }
        ```

5. 资产准备

   5.1. 默认封面图
      - 5.1.1. 从设计稿 Unsplash 链接下载并优化为本地
        `src/assets/cover/default-cover.jpg`（目标 ≤ 200KB，1600×1000）
      - 5.1.2. 同名 webp 版本一并提供（小程序按平台择优）

   5.2. 主题预览缩略图（用于"我的"页主题选择卡）
      - 5.2.1. 路径：`src/assets/theme-preview/{tegami|magazine|postcard|minimal}.svg`
      - 5.2.2. 尺寸：200×260（5:6.5）
      - 5.2.3. 内容：每张缩略图是该主题首页的极简抽象（不必真截图）
        - tegami：3 张错位卡片 + 暖橘色块
        - magazine：粗线刊头 + 红色色块 + 黑色目录
        - postcard：椭圆盖戳 3 枚 + 牛皮纸纹
        - minimal：3 条 hairline + 极小数字

   5.3. Icon 补齐
      - 5.3.1. 现有 icon 不足以覆盖设计稿，需补：
        `sparkle-fill / arrow-right / chevron-right / pin / people / spot /
        edit / check / plus / close / camera / replace / settings`
      - 5.3.2. 落入 `src/components/Icon/`，用 inline SVG via Taro `View`
        + `dangerouslySetInnerHTML` 或 path 数组渲染

6. 组件清单

   6.1. 新增
      - 6.1.1. `BrandLogo`（仅 seal 实现）
        - props: `{ size?: 'sm'|'md'|'lg'; theme?: ThemeName }`
        - 输出：红方章「行/册」+ 旁注「XING · CE / 旅 行 簿 · 2026」
        - 各主题下色彩跟随 token，但版式不变
      - 6.1.2. `AIBadge`
        - props: `{ status: 'idle'|'thinking'|'ready'|'error'; label?: string;
          compact?: boolean; onClick }`
        - 共用：linear-gradient + shine animation + dots
        - 在首页底部 CTA 使用 `compact={false}` 大尺寸
        - 在 trip 页顶部使用 `compact={true}` 小尺寸
      - 6.1.3. `AIInterview`（重写 `AIPlanForm`）
        - 题库定义放 `src/data/ai-interview.ts`
        - 分步 UI + 历史折叠 + 单选/多选/freetext
        - textarea 自动撑高 + sheet 内部可滚（解决上次会话遗留问题）
      - 6.1.4. `AILoadingTheater`
        - 全屏 mask + orb 三环动画 + 循环 sub 文案
        - 两个操作：底部「停止生成」（调 `cancelAITask`）+ 右上角「×」最小化（不停止任务，仅退出全屏）
        - props: `{ open, tripId, onCancel, onMinimize, onComplete }`
        - 订阅对应 trip 的 `aiStatus`，`ready` → 自动关闭并触发 `onComplete`（进入 Preview）
      - 6.1.9. `TripAIStatusBar`（trip 页顶部专用 AI 状态条）
        - 当 `trip.aiStatus === 'generating'` 且 AILoadingTheater 已最小化时显示
        - 视觉：贴 trip header 下方一条横条，带 shine + dots 动效（与 AIBadge 同色系）
        - 文案：「AI 正在为你编排 · 点击展开」
        - 点击 → 重新打开 AILoadingTheater（不重启任务）
        - `ready` 态自动隐藏并自动弹 Preview
      - 6.1.5. `MagFeatureCover`（仅 photoframe）
        - props: `{ trip; coverUrl; onLongPress?: () => void }`
        - 长按 → 弹"替换封面"sheet
      - 6.1.6. `CoverPicker`
        - 弹底 sheet，三项：拍照 / 相册 / 恢复默认
        - 选中后调微信 `chooseMedia` → 裁剪（自实现 16:10 裁剪框）→ 上传云存储
      - 6.1.7. `ThemeCard`
        - props: `{ name: ThemeName; selected: boolean; onSelect }`
        - 显示缩略图 + 中文名 + 英文小标 + 选中描边
      - 6.1.8. `AvatarEntry`
        - 首页 masthead 右上角圆形头像按钮
        - 未登录显示默认头像 + 红点
        - 点击 → `Taro.navigateTo('/pages/me/index')`

   6.2. 改造
      - 6.2.1. `AILoadingBar` → `HomeCardAIRow`（功能不变，仅简化为卡内
        thinking/ready 两态条）
      - 6.2.2. `ProfileSetupModal` 表单部分抽出为可复用 form，供"我的"
        页使用

   6.3. 删除
      - 6.3.1. 旧 `AIPlanForm`（被 `AIInterview` 替代）
      - 6.3.2. 不实现设计稿里的 `AIReadyStamp`
      - 6.3.3. 不实现 `BrandLogo` 其他 4 种样式（masthead/script/spine/bigtype）
      - 6.3.4. 不实现 `MagFeatureArt` 其他 3 种模式（silhouette/type/grid）
      - 6.3.5. 不实现 `tweaks-panel.jsx`（开发期工具）

7. 页面 × 主题版式矩阵

   每页 4 套 layout 在同一个 `index.tsx` 内用 `theme === 'xxx' && <PageXxx/>`
   dispatcher 分发；样式按主题前缀命名（`.ht-* / .hm-* / .hpp-* / .hmin-*`）。

   7.1. 首页 home（设计稿 `home.jsx` 已完整提供，按原稿落地）

      | 主题 | layout 类 | 关键元素 |
      | --- | --- | --- |
      | 手帖 | `home-tegami` `.ht-stack` | masthead + BrandLogo + 卡片堆叠错位（5 张以内 z-index 错位 12rpx） |
      | 刊物 | `home-mag` `.hm-feature` | masthead + 双线 + feature 大封面（photoframe）+ index 目录行 |
      | 护照 | `home-pp` `.hpp-stamps` | 护照封面 + 盖戳网格（按 days 缩放 0.62–1.0）+ 底部统计 |
      | 极简 | `home-min` `.hmin-list` | eyebrow + BrandLogo + 3 数字统计 + 行式清单 |

      共用：右上角 `<AvatarEntry/>`；底部 CTA = `<AIBadge size="lg"/>` 上
      + 线框「+ 新建攻略」下

   7.2. trip 页（设计稿 `trip.jsx` 提供 4 套头部 + 1 套主体）

      | 主题 | header 风格 | 主体 |
      | --- | --- | --- |
      | 手帖 | 暖橘色 hero + 圆角 + 倒计时大字 | 沿用现 ItineraryView |
      | 刊物 | 双线刊头 + 期号 + 大衬线标题 + 黑色 hairline | 沿用 |
      | 护照 | 牛皮纸纸纹 hero + 椭圆"已入境"戳 | 沿用 |
      | 极简 | 单行 eyebrow + 大字标题 + hairline | 沿用 |

      共用：右上角 `<AIBadge compact/>` 替换现 `.th-ai-btn`

   7.3. ItineraryView 每日列表

      7.3.1. 主体每日卡片（每主题不同结构）

      | 主题 | 每日卡片 |
      | --- | --- |
      | 手帖 | 圆角卡 + 暖橘 day no 圆章 + 时间线 dot 暖色 |
      | 刊物 | 编辑栏：DAY 01 大粗体 + 红色 accent 数字 + 黑色 hairline 分割 |
      | 护照 | 椭圆 day 戳 + 牛皮纸底 + 墨水蓝时间数字 |
      | 极简 | 行式：Day 01 small + spots 缩进 hairline |

      7.3.2. DayTabs（顶部日期切换器，4 套独立 variant）

      参考设计稿 `trip.jsx` L255–L309 `DayTabs` 组件，按主题映射：

      | 主题 | variant | 视觉 |
      | --- | --- | --- |
      | 手帖 tegami | `ticket`（票根撕口式） | 每个 tab 是一张票根：序号 + 撕口虚线 + 日期 + "Day N" 标签；上下两个 notch 缺口 |
      | 刊物 magazine | `spine`（时间轴脊柱） | 每个 tab 一个小 dot + `D1` + 日期；底部贯穿一条横线代表脊柱 |
      | 护照 postcard | `calendar`（日历方块） | 每 tab 一个日历方格：上月份、中大日子、下"Day N"；激活态深棕底 + 牛皮纸纹 |
      | 极简 minimal | `simple`（极简文字） | 仅"1 / 4.26"两行 + 极细下划线；激活态加粗 |

      7.3.3. 实现策略
         - 抽象组件 `<DayTabs variant trip activeId onChange/>`（src/components/DayTabs/）
         - 内部 switch variant 渲染 4 套 DOM
         - 主题切换无需重渲：`useTheme()` → variant 由 `DAYTAB_VARIANT[theme]` 映射
         - 保留现有"前后加日期 / 长按调整顺序"逻辑（spec C 决策已确认）

   7.4. BudgetView

      7.4.1. 单一结构（沿用设计稿 `budget.jsx`）

      不为 4 主题各做独立版式；统一结构 + token 漂移。结构包含：

      - 7.4.1.1. 顶部总览：本次总开销 + 人均（含"省 X%"对比） + 环形 donut（conic-gradient）+ 中心占比文案
      - 7.4.1.2. 分类图例：色块 + 分类名 + 百分比 + 金额
      - 7.4.1.3. 每日折线卡：SVG path + 渐变填充 + 6 点（含起点）
      - 7.4.1.4. 最贵一笔高亮卡：单条 spot/meal/hotel 信息 + 价格 + "占总开销 X%"
      - 7.4.1.5. 分类明细：可展开/折叠

      7.4.2. 4 主题 token 漂移效果

      | 主题 | 关键差异 |
      | --- | --- |
      | 手帖 | donut 用暖橘渐变环；卡片大圆角 |
      | 刊物 | donut 仍保留但配色变红/黑系；卡片直角；数字用 Helvetica |
      | 护照 | donut 用深棕橙系；纸纹底 |
      | 极简 | donut 极淡线；金额 mono 字体右对齐 |

      7.4.3. 实现策略
         - 单一 `BudgetView` 组件，DOM 不分主题
         - SVG path / conic-gradient 颜色用 `var(--accent / --leaf / --plum ...)` 而非硬编码

   7.5. PackingView

      | 主题 | 风格 |
      | --- | --- |
      | 手帖 | 贴纸感勾选项 + 暖橘高亮 |
      | 刊物 | 清单卡：粗线分类标题 + 复选黑色 □ |
      | 护照 | 行李条样式：每项类似条形码标签 |
      | 极简 | 极淡复选框 + 行式 list |

   7.6. MapView

      7.6.1. 地图本体（瓦片/控件）不可主题化，token 跟随即可

      7.6.2. MapModeBar（日期/全部 模式切换器，4 套独立 variant）

      参考设计稿 `trip.jsx` L353+ 与 `MAPMODE_VARIANT` 映射：

      | 主题 | variant | 视觉 |
      | --- | --- | --- |
      | 手帖 tegami | `track`（颜色胶囊条） | 每天一颗彩色胶囊（dayColor）+ 全部按钮；激活态实心填充 |
      | 刊物 magazine | `segmented`（分段控制器） | iOS 风分段控件：黑色边框 + 黑底激活；等宽分隔 |
      | 护照 postcard | `route`（路线卡片条） | 每天一张迷你"签证卡"：Day N + 日期 + 距离；激活态盖戳样 |
      | 极简 minimal | `pill`（极简胶囊） | hairline 胶囊；激活态填充黑色 |

      7.6.3. 实现策略
         - 抽象组件 `<MapModeBar variant trip mode onChange/>`
         - 与 DayTabs 共用 `dayColor(i)` 工具，保持 trip 内日期色一致

   7.7. new-trip 页
      - 7.7.1. 表单页保留单一版式
      - 7.7.2. 按钮、输入框跟随 token 漂移
      - 7.7.3. AI 入口按钮替换为 `<AIBadge/>` 样式

   7.8. share 页
      - 7.8.1. 保留单一版式，token 跟随
      - 7.8.2. 不做 4 套

   7.9. "我的"页（新增 `/pages/me/index`）
      - 7.9.1. 单一版式（token 跟随）
      - 7.9.2. 区块：
        - 顶部头像 + 昵称（点击编辑，沿用 `ProfileSetupModal` 表单逻辑）
        - 主题选择：2×2 `ThemeCard` 网格 + 选中态描边
        - 底部：版本号、协议入口（暂占位）

8. 关键 UX 流程

   8.1. 主题切换流
      ```
      "我的"页 → 点击 ThemeCard
        → themeStore.setTheme(next)
          ├─ ctx 立即更新（页面瞬时切换，无动效）
          ├─ Storage.setSync('theme:selected', next)
          └─ cloud users.update({ theme: next }) [async, 失败仅 toast 不回滚]
      ```

   8.2. 未登录 → 登录主题合并
      ```
      登录回调拿到 cloudMe
        if cloudMe.theme != null:
          themeStore.set(cloudMe.theme)  // 云端优先
        else if Storage 有值:
          themeStore.set(storageTheme)
          cloud.update({ theme: storageTheme })  // 把本地选择上传
        else:
          themeStore.set('tegami')
      ```

   8.3. 自定义封面流
      ```
      杂志主题首页 feature 卡长按
        → <CoverPicker> 弹底
          ├─ 拍照 → chooseMedia({ sourceType: ['camera'] })
          ├─ 相册 → chooseMedia({ sourceType: ['album'] })
          └─ 恢复默认 → coverUrl = null
        → 进入裁剪页（16:10 锁定）
        → 上传云存储 → fileID 写回 trip.coverUrl
      ```

   8.4. AI 流（重写后）

      8.4.1. 入口 A：首页底部「让 AI 帮你规划」
        ```
        home AIBadge 大按钮
          → <AIInterview/> 采访 sheet
          → onSubmit(prefs) → createTrip + startAITask
          → 自动回到首页（保留当前逻辑），新 trip 卡进入 generating 态
            ├─ 首页卡片显示 <HomeCardAIRow status='thinking'/>
            └─ 用户点击该卡 → 进入 trip 页
              → trip 页自动以全屏态打开 <AILoadingTheater/>
        ```

      8.4.2. 入口 B：已有 trip 页右上角 AIBadge
        ```
        trip 顶部 AIBadge 小按钮
          → <AIInterview/> 采访 sheet
          → onSubmit(prefs) → startAITask（针对当前 trip）
          → 不跳转，直接在当前 trip 页打开 <AILoadingTheater/> 全屏
        ```

      8.4.3. AILoadingTheater 内部操作
        ```
        <AILoadingTheater open>
          ├─ 底部「停止生成」→ cancelAITask + 关闭弹层 + 清空 trip.aiStatus
          │   - trip 记录本身保留（不论入口 A 还是 B），用户可手动继续编辑
          ├─ 右上角「×」最小化 → 仅关闭弹层，不停止任务
          │   ↓
          │   trip 页 header 下方显示 <TripAIStatusBar/>
          │   ├─ 文案「AI 正在为你编排 · 点击展开」
          │   └─ 点击 → 重新打开 <AILoadingTheater/>（任务继续）
          └─ aiStatus === 'ready' 自动触发：
             ├─ 关闭弹层（如果开着）
             ├─ 隐藏 TripAIStatusBar（如果在）
             └─ 自动弹 <AIPlanPreview/>
        ```

      8.4.4. 首页 → trip 切换时机
        - 首页卡片 `aiStatus === 'ready'` 时文案变「AI 草稿就绪 · 点击查看」
        - 点击 → 进入 trip 页 → 不再打开 AILoadingTheater（已 ready）→ 沿用现有"自动弹 Preview"逻辑
        - 用户已用尽 ready 之后直接点首页卡片，跳转后行为完全沿用昨日 [trip-store watch + auto-preview] 修复逻辑

9. Phase 拆分与 PR 粒度

   严格按 Phase 1 → 2 → 3 → 4 → 5 顺序，每 Phase 一个 PR（Phase 4 拆 4 个）。

   9.1. Phase 1 · 基础设施（PR-1）
      - 抽 tokens.scss / animations.scss
      - theme-store
      - me-store + cloudfunction 加 theme 字段
      - app.tsx 挂 ThemeProvider
      - `/pages/me/index` 骨架 + AvatarEntry
      - 验收：切换主题后所有页 token 切换正常；refresh 后保留；登录合并逻辑覆盖

   9.2. Phase 2 · 共享组件库（PR-2）
      - BrandLogo / AIBadge / AIInterview / AILoadingTheater
      - 旧 AILoadingBar 改造为 HomeCardAIRow
      - ProfileSetupModal 表单抽出
      - 验收：组件 storybook 风格的预览页（可临时挂在 `/pages/font-comparison`
        附近）覆盖各 status / 各 theme

   9.3. Phase 3 · 首页四主题（PR-3）
      - 按 7.1 实现 4 个 Home 子组件
      - photoframe 默认封面 + CoverPicker（含 16:10 裁剪）
      - 底部 CTA 方案 3 落地
      - 验收：四主题切换首页结构全变，AI 卡内行 + 弹 Preview 自动化

   9.4. Phase 4 · trip / itinerary / budget / packing / map（PR-4a–e）
      - 4a：trip 页 header 4 套
      - 4b：ItineraryView 主体 4 套 + DayTabs 4 variant
      - 4c：BudgetView 单结构 + 4 主题 token 漂移（不做 4 套版式）
      - 4d：PackingView 4 套
      - 4e：MapView MapModeBar 4 variant（地图本体不变）
      - 验收：每 PR 单 view / 单切换器，4 主题视觉走查通过；功能行为不变

   9.5. Phase 5 · AI 收尾与清理（PR-5）
      - 启用 AIInterview 替换旧 AIPlanForm
      - 接入 AILoadingTheater 到所有 AI 入口
      - 删除旧组件
      - 主题预览缩略图绘制
      - 验收：旧组件零引用；冒烟测试 AI 全流程

10. 验收标准（全局）

    - 10.1. 四主题在所有指定页面均可流畅切换，无白屏 / 错位
    - 10.2. token 切换在 root-portal 子树（如 sheet / modal）下生效
    - 10.3. 未登录用户切主题可持久；登录后正确合并云端值
    - 10.4. 自定义封面上传成功 → trip.coverUrl 落库 → 列表/详情立即可见
    - 10.5. AI 流：
       - 入口 A（首页）走 createTrip → 回首页 → 用户点卡 → trip 页自动展全屏 Theater
       - 入口 B（trip 页）直接在当前页展全屏 Theater，不跳转
       - 「×」最小化 → TripAIStatusBar 持续显示，点击可重新展开
       - 「停止」生效后 trip.aiStatus 清空，Theater 与 StatusBar 同时消失
       - ready 态在任意位置都能触发自动弹 Preview（沿用上次会话已修复逻辑）
    - 10.6. 真机回归：H5 + 微信小程序 iOS / Android 各一次
    - 10.7. 无 console.log 残留（PostToolUse hook 已配置）

11. 风险与缓解

    | 风险 | 等级 | 缓解 |
    | --- | --- | --- |
    | 4 主题 × 5 页 = 20 套布局，工作量大 | 高 | Phase 4 拆 4 PR，每 PR 独立 review/合并 |
    | 设计稿 px → rpx 换算疏漏 | 中 | 写共用换算函数，并在 PR-1 leave 一个 token 对照表 |
    | 云函数 schema 变更影响存量用户 | 中 | theme 字段 nullable，前端兜底；不写迁移脚本 |
    | 自定义封面上传失败 | 中 | 上传失败 toast + 保留默认；不阻断主流程 |
    | 主题选择影响心智成本 | 低 | 测试期接受；正式期可在用户活跃 7 天后冻结当前选择为默认 |

12. 非目标（明确不做）

    - 12.1. 主题切换过渡动画（C8）
    - 12.2. BrandLogo 其他 4 种样式
    - 12.3. MagFeatureArt 其他 3 种模式
    - 12.4. tweaks-panel 调参面板
    - 12.5. MapView / new-trip / share 页的 4 主题版式
    - 12.6. 自定义封面的"批量替换 / 历史封面回滚"等高级功能
    - 12.7. 主题以外的字号/字体粒度选择
