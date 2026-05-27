# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 1. 项目概述

**行册** 是一个基于 Taro 4.2 + React 18 + TypeScript 的多端旅行规划小程序，目标平台以微信小程序为主，同时支持 H5、支付宝、字节、QQ、京东、百度、鸿蒙 Hybrid。后端使用腾讯云开发（CloudBase）云函数。

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

无 lint / test 脚本：仓库依赖 `eslint`、`stylelint`、`commitlint` 通过 Husky + lint-staged 在提交时触发，没有顶层 `npm run lint` 命令，也未配置测试运行器。新增脚本时需与既有 husky 钩子保持一致。

云函数位于 [cloudfunctions/](cloudfunctions/)，需在微信开发者工具 / CloudBase CLI 中单独上传部署，不参与 `npm run build`。

## 3. 架构要点

### 3.1. 多页面 + 主题分发器

[src/app.config.ts](src/app.config.ts) 注册 6 个页面：`home`、`new-trip`、`trip`、`share`、`me`、`preview`。

页面采用「分发器 + 主题变体」模式：
- [src/pages/home/index.tsx](src/pages/home/index.tsx) 是分发器，根据当前主题渲染 `HomeTegami` / `HomeMagazine` / `HomePostcard` / `HomeMinimal` 之一，共享逻辑放在 [home/shared.tsx](src/pages/home/shared.tsx)。
- [src/pages/trip/index.tsx](src/pages/trip/index.tsx) 同理，分发到 `TripHeader{Tegami,Magazine,Postcard,Minimal}.tsx`，共享类型/逻辑放在 [trip/shared-header.ts](src/pages/trip/shared-header.ts)。
- 新增主题相关 UI 时：先决定它是「主题无关」(放 shared) 还是「主题特定」(放四个变体文件)，避免在分发器里写条件分支。

四种主题：`tegami`（手紙）/ `magazine`（杂志）/ `postcard`（明信片）/ `minimal`（极简），通过 CSS 变量切换，主题工具在 [src/utils/theme-class.ts](src/utils/theme-class.ts)。设计稿来源在 [triplist-design/](triplist-design/)，规格在 [docs/superpowers/specs/](docs/superpowers/specs/) 和 [docs/superpowers/plans/](docs/superpowers/plans/)。

### 3.2. 状态管理（自建 Store）

[src/store/](src/store/) 下三个 Provider，未使用 Redux/Zustand：
- [trip-store.tsx](src/store/trip-store.tsx) — 行程数据
- [theme-store.tsx](src/store/theme-store.tsx) — 当前主题
- [me-store.tsx](src/store/me-store.tsx) — 用户信息

读写遵循不可变模式（spread 返回新对象）。本地持久化通过 [src/utils/db.ts](src/utils/db.ts) 封装 `Taro.getStorageSync/setStorageSync`。

### 3.3. 数据流：基线 + override

`src/data/trips.json` 是只读基线数据，**禁止修改**。用户自定义改动通过 override 机制写入本地存储；详见 [openspec/specs/override-utils/spec.md](openspec/specs/override-utils/spec.md)。

### 3.4. 云端能力

[src/utils/cloud.ts](src/utils/cloud.ts) 封装云函数调用。云函数职责：
- `ai-plan-trip` / `ai-task-sweeper` — AI 行程生成与任务清理
- `amap-poi-search` / `amap-weather` — 高德 POI 与天气
- `clone-trip` / `update-trip` / `list-my-trips` / `ensure-user` — 行程 CRUD
- `create-share-token` / `join-collab` — 分享与协作

修改云函数后需在云开发控制台/CLI 重新部署，本地构建不会带上它们。

### 3.5. 组件库

[src/components/](src/components/) 下约 25 个业务组件，命名按特性分组（如 `AIPlanForm`、`CollaboratorsSheet`、`TripActionSheet`）。新增组件时优先复用现有命名风格，组件文件夹自带 `.scss`。

## 4. 编码约定

- **TypeScript 严格模式，禁用 `any`**（外部输入用 `unknown` 再窄化）。
- 函数组件 + Hooks，不要 class 组件。
- 状态更新必须返回新对象，不要原地 mutate。
- 样式使用 SCSS + CSS 变量（主题驱动），遵循 BEM。
- 跨平台代码：避免使用任何平台独占 API；优先 `@tarojs/taro` 提供的统一封装。
- 提交信息走 Conventional Commits（`feat:` / `fix:` / `refactor:` 等），由 commitlint 校验。

## 5. 文档与规格

- [AGENTS.md](AGENTS.md) — 详细的代理协作约定（与本文件互补，必要时同步更新）。
- [openspec/specs/](openspec/specs/) — 各 capability 的规格文档（trip-core、packing-data、override-utils、project-config）。
- [docs/superpowers/](docs/superpowers/) — 设计系统迁移的 specs 与 phase 计划，当前正在执行 Phase 4 系列（trip 页面四主题改造）。
