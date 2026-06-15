# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 1. 项目概述

**行册** 是一个基于 Taro 4.2 + React 18 + TypeScript 的多端旅行规划小程序，目标平台以微信小程序为主，同时支持 H5、支付宝、字节、QQ、京东、百度、鸿蒙 Hybrid。后端使用腾讯云开发（CloudBase）：数据存储在云数据库 `trips` 集合，业务逻辑放在云函数，并通过实时 `watch` 支持多人协作。AI 行程规划、高德 POI / 天气等能力均经由云函数代理。

## 2. 常用命令

```bash
# 开发（微信小程序为主）
npm run dev:weapp
npm run dev:h5

# 构建
npm run build:weapp
npm run build:h5

# Husky 安装（首次克隆后）
npm run prepare
```

`package.json` 为 9 个平台各提供 `dev:*`（watch）与 `build:*` 两套脚本；完整清单见 [docs/commands.md](docs/commands.md)。

无 lint / test 脚本：仓库依赖 `eslint`、`stylelint`、`commitlint` 通过 Husky + lint-staged 在提交时触发，没有顶层 `npm run lint` 命令，也未配置测试运行器。新增脚本时需与既有 husky 钩子保持一致。

云函数位于 [cloudfunctions/](cloudfunctions/)，需在微信开发者工具 / CloudBase CLI 中单独上传部署，不参与 `npm run build`。

## 3. 架构要点

### 3.1. 多页面 + 主题分发器

[src/app.config.ts](src/app.config.ts) 注册 5 个页面：`home`、`new-trip`、`trip`、`share`、`me`。

页面与功能视图采用「分发器 + 主题变体」模式：
- [src/pages/home/index.tsx](src/pages/home/index.tsx) 是分发器，根据当前主题渲染 `HomeTegami` / `HomeMagazine` / `HomePostcard` / `HomeMinimal` 之一，共享逻辑放在 [home/shared.tsx](src/pages/home/shared.tsx)。
- [src/pages/trip/index.tsx](src/pages/trip/index.tsx) 同理，分发到 `TripHeader{Tegami,Magazine,Postcard,Minimal}.tsx`，共享类型/逻辑放在 [trip/shared-header.ts](src/pages/trip/shared-header.ts)。
- 功能视图在 [src/views/](src/views/) 下，同样按主题分发：`ItineraryView`（行程，分发到 `Itin{Tegami,Magazine,Postcard,Minimal}`）、`PackingView`（打包清单，分发到 `Pack{...}`）、`BudgetView`（预算）、`MapView`（地图）。每个视图的 `index.tsx` 是薄分发器，公共 props/逻辑放在同目录 `shared.ts`。
- 新增主题相关 UI 时：先决定它是「主题无关」(放 shared) 还是「主题特定」(放四个变体文件)，避免在分发器里写条件分支。

四种主题：`tegami`（手紙）/ `magazine`（杂志）/ `postcard`（明信片）/ `minimal`（极简），通过 CSS 变量切换，主题工具在 [src/utils/theme-class.ts](src/utils/theme-class.ts)，设计令牌在 [src/styles/tokens.scss](src/styles/tokens.scss)。设计稿来源在 [triplist-design/](triplist-design/)，规格在 [docs/superpowers/](docs/superpowers/)。

### 3.2. 状态管理（自建 Store）

[src/store/](src/store/) 下三个 Provider，未使用 Redux/Zustand。`App` 在 [src/app.tsx](src/app.tsx) 顶层包裹 `MeProvider` → `ThemeProvider`；`TripProvider` 由 trip 页面按 `tripId` 局部挂载。

- [me-store.tsx](src/store/me-store.tsx) — 用户信息。挂载时调 `ensure-user` 云函数获取 `openid`/昵称/头像/主题/`plan`（`'free' | 'pro'`），首次缺昵称头像时自动弹 `ProfileSetupModal`。
- [theme-store.tsx](src/store/theme-store.tsx) — 当前主题。本地 `Storage` + 云端（`ensure-user`）双写，登录后以云端值优先合并。
- [trip-store.tsx](src/store/trip-store.tsx) — 单条行程数据，基于 `useReducer`。初次 `getTrip` 拉取后订阅云数据库 `watch` 实现协作同步；本地编辑经 500ms debounce 后用 `update-trip` 云函数全量保存；用 `lastSavedRef`/`pendingRef`/`deferredRemoteRef` 处理「自身回声」「保存期间的远端更新」等竞态。

读写遵循不可变模式（reducer 始终 spread 返回新对象，禁止原地 mutate）。

### 3.3. 数据流：CloudBase 为源 + 本地种子示例

- **真实行程**：云数据库 `trips` 集合是唯一可信源。读取走 `getTrip` / `list-my-trips`，写入走 `update-trip` / `clone-trip` 等云函数（绕开客户端权限规则，让 owner 与协作者都能写）。封装在 [src/utils/db.ts](src/utils/db.ts) 与 [src/utils/cloud.ts](src/utils/cloud.ts)。
- **示例攻略**：[src/data/seed-trips.ts](src/data/seed-trips.ts)（数据在 `seed-trips.json`）提供只读的演示行程，`isSeedTripId` 命中时直接从本地静态数据加载，不连云、不订阅 watch、编辑不落库（仅提示「复制后可编辑」）。复制示例用 `copyTripLocally`。
- 注意：旧版的「`trips.json` 基线 + 本地 override」机制已移除（`src/utils/override.ts`、`openspec/` 规格均不再存在）。`src/data/trips.json` 仍在仓库中但已无代码引用，属遗留文件，不要据此推断数据流。

### 3.4. 云端能力

[src/utils/cloud.ts](src/utils/cloud.ts) 封装云函数调用。[cloudfunctions/](cloudfunctions/) 现有 10 个函数：
- `ai-plan-trip` / `ai-task-sweeper` — AI 行程生成与异步任务清理（受用户 `plan` 的 AI 额度约束）
- `amap-poi-search` / `amap-weather` — 高德 POI 搜索与天气（注意：当前高德套餐不支持境外 POI）
- `clone-trip` / `update-trip` / `list-my-trips` / `ensure-user` — 行程 CRUD 与用户初始化
- `create-share-token` / `join-collab` — 分享令牌与协作加入

修改云函数后需在云开发控制台/CLI 重新部署，本地构建不会带上它们。云环境 id 在 [src/app.tsx](src/app.tsx) 的 `wx.cloud.init` 中配置。

### 3.5. 组件库

[src/components/](src/components/) 下约 29 个业务组件，命名按特性分组（如 `AIInterview`、`AIPlanPreview`、`AILoadingTheater`、`CollaboratorsSheet`、`TripActionSheet`、`SpotSearch`、`ProfileSetupModal`）。新增组件时优先复用现有命名风格，组件文件夹自带 `.scss`。

## 4. 编码约定

- **TypeScript 严格模式，禁用 `any`**（外部输入用 `unknown` 再窄化；调用 `Taro.cloud` 等无类型 API 时用局部 `@ts-ignore` 并就近注释，不要扩散 `any`）。
- 函数组件 + Hooks，不要 class 组件。
- 状态更新必须返回新对象，不要原地 mutate（store reducer / setState 均如此）。
- 样式使用 SCSS + CSS 变量（主题驱动），遵循 BEM。
- 跨平台代码：避免使用任何平台独占 API；优先 `@tarojs/taro` 提供的统一封装（云能力为 weapp 端特性，已用 `process.env.TARO_ENV` 守卫）。
- 提交信息走 Conventional Commits（`feat:` / `fix:` / `refactor:` 等），由 commitlint 校验。

## 5. 文档与规格

- [docs/commands.md](docs/commands.md) — 全部 npm 脚本与对应 `taro build` 命令清单。
- [docs/codemap.md](docs/codemap.md) — 自动生成的代码地图，**部分内容已过时**（描述了已废弃的单页 `pages/index` + `override` 架构），仅供历史参考，以源码为准。
- [docs/learn/](docs/learn/) — 面向初学者的项目学习手册（基础知识 / 前后端 / 功能详解 / 调试 等）。
- [docs/superpowers/](docs/superpowers/) — 设计系统迁移的 specs、plans 与 frontend-design 资料。
- [triplist-design/](triplist-design/) — 四主题设计稿来源。

## 6. 项目级 Skills（`.claude/skills/`）

仓库内置了三组开源 skills，所有克隆此仓库的用户可直接通过 `Skill` 工具调用：

### Superpowers（obra/superpowers）
结构化开发方法论，涵盖完整研发生命周期：
- `using-superpowers` — 启动 bootstrap，每次会话开始时自动触发其他 skills
- `brainstorming` — 写代码前先梳理需求与设计
- `writing-plans` / `executing-plans` — 编写与执行任务计划
- `subagent-driven-development` — 并行 subagent 分发执行
- `test-driven-development` — TDD 流程
- `systematic-debugging` — 系统性调试
- `requesting-code-review` / `receiving-code-review` — Code Review 双向流程
- `verification-before-completion` — 完成前强制验收
- 以及 `dispatching-parallel-agents`、`finishing-a-development-branch`、`using-git-worktrees`、`writing-skills`

### Frontend Design（Ilm-Alan/frontend-design）
- `frontend-design` — 8 种审美锚点（Swiss / Industrial / Brutalist / Aurora Maximalism / Chaotic Maximalism / Retro-Futuristic / Organic / Lo-Fi），用于写 UI 时明确视觉方向，避免 AI 生成泛化风格

### CloudBase 微信小程序（TencentCloudBase/skills）
- `miniprogram-development` — 微信小程序开发（页面/组件/tabBar/发布/调试），含 CloudBase 集成参考
- `cloud-functions` — 云函数开发（HTTP / 事件函数，部署与配置）
- `cloudbase-wechat-integration` — CloudBase × 微信支付 / 授权集成
- `no-sql-wx-mp-sdk` — 小程序端 CloudBase NoSQL SDK（CRUD / 聚合 / 分页 / 地理位置 / 安全规则）
- `auth-wechat` — 微信小程序 CloudBase 鉴权
- `cloudbase-guidelines` — CloudBase 使用总原则与 MCP 配置
</content>
