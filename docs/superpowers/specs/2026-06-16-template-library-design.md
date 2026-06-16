# 攻略库(模板库)设计文档

状态:已讨论确认,实施计划见 docs/superpowers/plans/2026-06-16-template-library.md
日期:2026-06-16
关联 mockup:docs/superpowers/mockups/template-library-v4-icons.html(自绘图标、零 emoji)

## 1. 背景与目标

### 1.1. 问题

1.1.1. 现状的「示例攻略」由前端本地静态文件 src/data/seed-trips.json 提供,只读,复制走 copyTripLocally。

1.1.2. 致命体验问题(用户反馈):示例攻略复用了可编辑的 trip 页,仅在进入时弹一行「复制后可编辑」提示;用户注意不到,编辑很久后才发现无法保存,观感极差。

1.1.3. 示例随前端发版,数量受限、更新要发版;且会随日期被 getTripPhase 判为 post 折叠进归档,失去演示价值。

### 1.2. 目标

1.2.1. 把示例升级为云端「攻略库」:常驻云端、运营可随时增删改、覆盖大量热门城市并持续更新。

1.2.2. 所有用户可浏览攻略库并一键复制到自己的行程后再编辑。

1.2.3. 模板严格只读,且从页面形态上让用户一眼看穿「不可编辑」,杜绝「改半天存不了」。

1.2.4. 前端不再随包发送示例数据。

## 2. 关键设计决策

2.1. 模板只读形态:独立只读阅读页(方案 A)。模板进新页面 pages/template,无任何编辑控件,底部常驻「复制到我的行程」+ 锁定说明。

2.2. 首页顺序:自适应(方案 V3)。有真实行程时「我的行程」置顶、精选收为次级横滑条;无真实行程时空状态 + 精选置顶引导。

2.3. 数据:新建独立云端集合 trip_templates。schema 复用 Trip,增加分类/精选字段。安全规则全员可读、客户端禁写。

2.4. 攻略库入口:首页精选区只展示 featured 少量;全量在独立页 pages/library,支持搜索与城市/主题分类。

2.5. 模板预览页与攻略库页做主题无关单布局,不做四主题变体(跟随 CSS 变量换色)。

2.6. 复制:新增 clone-template 云函数,复用 clone-trip 的字段剥离逻辑,去掉 share_token 校验(模板公开)。

2.7. 前端删除 src/data/seed-trips.json 及 isSeedTripId 相关只读分支;只读判定改由「来源是模板」驱动。

## 3. 数据模型

### 3.1. 集合 trip_templates

3.1.1. 复用 Trip 的全部行程字段(name、destinations、days、spots、startDate、endDate、pax 等)。

3.1.2. 新增字段清单(无加粗,纯表):

| 字段 | 类型 | 说明 |
|---|---|---|
| city | string | 主城市,用于分类与搜索 |
| region | string | 地区/省,用于聚合 |
| dayCount | number | 冗余存的天数(= days.length),天数筛选与卡片展示用 |
| spotCount | number | 冗余存的地点总数(各 day spots 之和),卡片展示用 |
| tags | string[] | 主题玩法标签,如 美食、古镇、自然、citywalk、博物馆、温泉、海岛 |
| audience | AIAudience[] | 适合人群,复用已有枚举(独行/情侣/亲子/老人/朋友) |
| seasons | string[] | 适合季节/月份,如 春、秋、看雪、避暑(策展,可空) |
| featured | boolean | 是否首页精选 |
| sortWeight | number | 排序权重,降序 |
| coverImages | string[] | 封面图,初期可空(卡片无图文字降级);后期云存储 fileID |
| version | number | 内容版本,便于运营管理 |
| updatedAt | number | 运营更新时间戳 |

3.1.3. 模板文档不含用户身份字段(_openid/owner/collaborators 等),复制时由云函数注入当前用户身份。

### 3.2. 安全规则

3.2.1. read 全员可读;write 客户端禁写。写入只经管理员通道(CloudBase 控制台/CLI)。

### 3.3. 初始数据

3.3.1. 把现有 seed-trips.json 两条(南京金陵四日、南京→大兴安岭寻北)转换为模板格式 JSON,补 city/region/dayCount/spotCount/tags/audience/featured 字段,作为导入种子。

### 3.4. 日期语义(重要)

3.4.1. Day.date 与 Trip.startDate/endDate 是类型必填,模板文档里保留,但仅作名义占位,不对用户展示。

3.4.2. 模板的「时长」由 days.length 推导(X天Y晚),阅读页与卡片只显示时长 + 地点数,绝不显示绝对日期(避免绑死某天)。

3.4.3. 模板不存储/不展示 weather(每日 weather 视为 null)。

3.4.4. 真实日期在「复制」环节才确定,见 4.2 的 rebase 逻辑。

### 3.5. 筛选模型(攻略库页)

3.5.1. 筛选维度:天数(主)、城市/地区、主题玩法 tags、适合人群 audience、季节 seasons。不做 pace、不做派生预算。

3.5.2. 天数为主筛选:攻略库页顶部一排精确天数 chip(1 / 2 / 3 / 4 / 5 / 6天+),命中 dayCount(6天+ 即 dayCount>=6)。理由:多数用户天数固定,先按天数收敛再挑目的地。

3.5.3. 其余维度为次级 chip;跨维度 AND,维度内多选 OR。

3.5.4. 适合人群直接复用 src/types/trip.ts 的 AIAudience 枚举,与 AI 规划共用,不新增概念。

3.5.5. 分类选项来源:初期前端固定一份策展清单(城市、tags、audience、seasons 候选值),不做后端 distinct。

3.5.6. 查询落地见 5.1(P1 前端直查)。

## 4. 云函数(仅 1 个)

> 读取走 P1:前端用小程序 SDK 直查 trip_templates(公开读规则),可缓存、无 list 云函数。只有「复制」需云函数(要身份 + 写 trips)。

### 4.2. clone-template

4.2.1. 入参:templateId、startDate('YYYY-MM-DD',用户在复制时选的出发日)。

4.2.2. 逻辑:校验 OPENID → 读模板文档 → 剥离 _id/身份/时间戳/AI 字段 → 注入当前用户 owner 信息、空协作者、createdAt/updatedAt=now → 按 startDate rebase 日期(见 4.2.4)→ add 进 trips 集合 → 返回 newTripId。

4.2.3. 复用 clone-trip 的字段剥离白名单逻辑,但不需要 share_token 校验。

4.2.4. 日期 rebase(与前端 resyncDays 同语义,按序号顺延):

| 字段 | 复制后取值 |
|---|---|
| days[i].date | startDate + i 天 |
| days[i].weather | null(清空模板天气) |
| Trip.startDate | startDate |
| Trip.endDate | startDate + (days.length − 1) 天 |

4.2.5. 校验 startDate 合法(YYYY-MM-DD),非法则报错,不写库。

## 5. 前端

### 5.1. 数据封装 src/utils/templates.ts(P1 前端直查)

5.1.1. listFeaturedTemplates():前端直查 where(featured=true).orderBy(sortWeight,'desc').limit(N),带 Storage SWR 缓存(TTL 6 小时 + 下拉强制刷新);.field() 只取轻字段(name/city/region/dayCount/spotCount/tags/coverImages),不取 days。

5.1.2. listTemplates(params):攻略库页查询。params 含 dayCount? / city? / region? / tags? / audience? / seasons? / keyword? / skip? / limit?。同样 .field() 轻字段 + 分页;初期数据量小,复杂多维筛选可拉城市切片后客户端再筛。

5.1.3. getTemplate(id):只读详情页加载完整文档(含 days),可走 Storage 缓存。

5.1.4. cloneTemplate(id, startDate):调 clone-template 云函数(传出发日),返回新 tripId。

5.1.5. 轻字段卡片类型 TemplateCard 与完整类型 Template(含 days)分开定义,避免列表误带 days。

### 5.2. 只读详情页 pages/template

5.2.1. 阅读器形态:封面 + 四个只读 view 的 Tab 切换(行程 / 地图 / 开销 / 清单),对齐 trip 页四视图,但全部为只读快照,无任何编辑/长按/添加/拖拽入口。一个完整可复制攻略必须含这四块,不可裁剪。

5.2.2. 四 view 只读内容来源:
| Tab | 内容 | 只读处理 |
|---|---|---|
| 行程 | 逐日地点列表(第 N 天 + 地点),不显示绝对日期 | 去掉增删/拖拽/编辑入口 |
| 地图 | 地点点位与路线预览 | 只读,不可增删点位 |
| 开销 | 预算/花费汇总 | 只读,不可记账 |
| 清单 | 打包清单项 | 只读,不可勾选/增删 |

5.2.3. 复用策略:优先复用 ItineraryView / MapView / BudgetView / PackingView 的展示层,通过 readonly 模式(或只读包装)隐藏交互控件,避免重写四套 UI。

5.2.4. 顶部「样板 · 只读」标识 + 锁定图标;底部常驻 sticky「+ 复制到我的行程」+ 锁定说明行,贯穿四个 Tab。

5.2.5. 点复制 → 弹出日期选择(复用 DatePicker,仅选出发日)→ 调 cloneTemplate(templateId, startDate) → 成功后跳转到新建的可编辑 trip 页(日期已 rebase)。

5.2.6. 主题无关单布局,图标走 §9 的 <Icon> 体系,无 emoji。

### 5.3. 攻略库页 pages/library

5.3.1. 顶部主筛选:一排精确天数 chip(1/2/3/4/5/6天+);其下次级筛选 chip(城市/地区、主题玩法、适合人群、季节)+ 搜索框。

5.3.2. 卡片网格:无图文字卡(标题 + 城市 + 时长「X天Y晚」+ 地点数 + tags);分页加载;点卡片进 pages/template。

5.3.3. 三种状态:loading 骨架、无网络重试、筛选无结果引导(放宽条件/清空筛选)。

5.3.4. 主题无关单布局(继承 CSS 变量,不做四变体)。

### 5.4. 首页改造 src/pages/home

5.4.1. 数据分区改为:真实行程 active(pre/live)/ archived(post);精选模板独立来源(云端)。

5.4.2. V3 自适应:有真实行程→我的行程置顶 + 精选次级横滑条 + 归档;无真实行程→空状态 + 精选置顶。

5.4.3. 精选区卡片点进 pages/template;「查看全部」入口进 pages/library。

5.4.4. 复用已铺好的空状态组件 HomeEmptyState 与折叠组件。

5.4.5. 四主题变体各自接入精选区与空状态(分发器模式)。

### 5.5. 清理(seed 影响面共 6 文件,逐一处理)

5.5.1. 删除 src/data/seed-trips.json 与 src/data/seed-trips.ts。

5.5.2. src/utils/db.ts:移除 copyTripLocally 的 seed 分支(及 isSeedTripId/getSeedTrip 引用);模板复制统一走 cloneTemplate。

5.5.3. src/store/trip-store.tsx(6/154/204 行):删除「tripId 为 seed 则本地加载、不订阅 watch」整段;trip-store 只处理真实行程。

5.5.4. src/pages/trip/index.tsx(228/321 行):删除 seed 只读 + 'copy' action 分支(模板不再进 trip 页)。

5.5.5. src/pages/home/index.tsx:移除 SEED_TRIPS 初始/合并、isSeedTripId 判断、seed 的 copy action;精选改云端来源。

5.5.6. src/pages/home/HomeTegami.tsx、HomeMagazine.tsx:移除 isSeed 角标/过滤逻辑。

### 5.6. 页面注册

5.6.1. src/app.config.ts 增加 pages/template/index 与 pages/library/index。

## 6. 分工

6.1. 我(写进仓库):clone-template 云函数源码、前端全部、初始数据 JSON、CLAUDE.md 更新、云端部署清单。

6.2. 你(CloudBase 侧,我给步骤):建集合 trip_templates、安全规则设「read 全员可读 / write 客户端禁写」、部署 clone-template、导入初始数据 JSON。

## 9. 图标体系与 emoji 清理(已确认 2026-06-16)

9.1. 图标风格:采用自绘单色线条图标(参考 triplist-design/project/icons.jsx),24×24、stroke=currentColor、随主题 CSS 变量变色。mockup template-library-v4-icons.html 的图标一览已确认通过,不用 emoji。

9.2. 落地为统一 <Icon> 组件,图标以代码内联存放(不建独立资源目录);weapp 端渲染走 CSS mask-image(SVG data-URI + background-color 着色),不稳再退 iconfont。

9.3. emoji 清理范围:全 App。除攻略库/只读新页用新图标外,顺带替换现有代码中的 emoji(至少 PackingView、ItineraryView/SpotCard、HomePostcard、AILoadingTheater、AIPlanPreview)。

9.4. 拆分:攻略库功能 PR 内做 <Icon> 组件 + 新页面图标;全 App 旧 emoji 清理单列一个后续小任务,避免该 PR 过大。

## 7. 非目标(YAGNI)

7.1. 不做模板后台管理界面,初期用 CloudBase 控制台维护。

7.2. 不做「模板有更新」提示;复制为快照语义。

7.3. 不做模板收藏/点赞/评论。

## 8. 验收

8.1. 模板页无任何可编辑入口,用户无法误编辑;底部复制可用。

8.2. 复制后在「我的行程」生成可编辑副本,模板本身不受影响。

8.3. 首页无真实行程时显示空状态 + 精选;有行程时我的行程置顶。

8.4. 攻略库页:天数 chip 主筛选 + 城市/主题/人群/季节次级筛选 + 搜索 + 分页正常;无结果/无网络/loading 三态可见。

8.5. 复制只问出发日;pax/打包清单沿用模板默认。

8.6. 前端不再含 seed-trips.json;6 个 seed 引用文件清理干净;tsc 无新增报错。

8.7. 只读页含行程/地图/开销/清单四个 Tab,均为只读快照,无任何编辑入口;四 view 不可裁剪。

8.8. 攻略库/只读页无 emoji,统一走 <Icon> 体系;weapp 端图标 CSS mask 渲染正常、随主题变色。
