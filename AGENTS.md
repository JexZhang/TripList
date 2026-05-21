# AGENTS.md

## 项目概述

**行册**是一个基于 Taro 框架的跨平台旅行管理小程序，提供旅行攻略浏览、开销预算统计、行李打包清单整理三大核心功能。

- **技术栈**：React 18 + TypeScript 5.4 + Taro 4.2 + SCSS
- **构建工具**：Webpack 5 + Babel 7
- **代码质量**：Husky + Commitlint + Stylelint + ESLint
- **目标平台**：微信小程序、H5 等 9 个平台

## 快速链接

- [Codemap](doc/codemap.md) — 完整的项目架构图和模块详解
- [Patterns](doc/patterns.md) — 编码模式和最佳实践
- [Commands](doc/commands.md) — 构建和开发命令参考
- [Specs](openspec/specs/) — 各 capability 的详细规格说明
  - [trip-core](openspec/specs/trip-core/spec.md) — 旅行行程管理核心业务
  - [packing-data](openspec/specs/packing-data/spec.md) — 打包清单数据管理
  - [override-utils](openspec/specs/override-utils/spec.md) — 本地存储工具
  - [project-config](openspec/specs/project-config/spec.md) — 项目构建配置

## 构建命令

### 开发模式

```bash
# H5 开发
npm run dev:h5

# 微信小程序开发
npm run dev:weapp
```

### 构建生产版本

```bash
# H5 构建
npm run build:h5

# 微信小程序构建
npm run build:weapp

# 其他平台（qq/tt/alipay/swan/jd/quickapp/rn）
npm run build:{platform}
```

### 代码质量工具

```bash
# 安装 Husky hooks
npm run prepare

# 手动检查
npm run lint          # ESLint
npm run lint:style    # Stylelint
```

## 项目结构

```
行册/
├── config/              # Taro 构建配置
│   ├── index.ts         # 基础配置
│   ├── dev.ts           # 开发环境
│   └── prod.ts          # 生产环境
├── src/
│   ├── app.ts           # 应用入口
│   ├── app.config.ts    # 应用配置（路由等）
│   ├── app.scss         # 全局样式
│   ├── pages/
│   │   └── index/       # 主页面（三大视图）
│   │       ├── index.tsx
│   │       ├── index.scss
│   │       └── index.config.ts
│   ├── data/
│   │   ├── trips.json   # 行程基线数据
│   │   └── packing.ts   # 打包清单模板
│   ├── types/
│   │   └── trip.ts      # 类型定义
│   └── utils/
│       └── override.ts  # 本地存储工具
├── types/
│   └── global.d.ts      # 全局类型声明
├── openspec/
│   ├── specs/           # Capability 规格文档
│   └── config.yaml      # OpenSpec 配置
└── doc/
    ├── codemap.md       # 项目架构图
    ├── patterns.md      # 编码模式
    └── commands.md      # 命令参考
```

## 分层规则

### L0 - 配置层
- `config/**` — Taro 构建配置
- `package.json`, `tsconfig.json` — 项目和编译配置

### L1 - 应用入口层
- `src/app.ts`, `src/app.config.ts` — 应用初始化和路由配置

### L2 - 页面层
- `src/pages/index/**` — 主页面组件和视图

### L3 - 业务逻辑层
- `src/data/**` — 数据定义和模板
- `src/utils/**` — 工具函数

### L4 - 类型层
- `src/types/**`, `types/**` — TypeScript 类型定义

**依赖方向**：L2 → L3 → L4，L0/L1 被所有层依赖

## 质量标准

### 代码规范

1. **TypeScript 严格模式**：所有新代码必须使用 TypeScript，禁止 `any` 类型
2. **React Hooks 规范**：函数组件 + Hooks，禁止 class 组件
3. **不可变数据**：状态更新必须返回新对象，禁止直接修改 state
4. **组件职责单一**：每个组件只负责一个视图或一个业务逻辑

### 提交规范

- 使用 Commitlint 验证提交消息格式
- 格式：`<type>(<scope>): <subject>`
- 类型：`feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### 样式规范

- 使用 SCSS，遵循 BEM 命名规范
- Stylelint 自动检查样式代码质量
- 优先使用 CSS 变量实现主题切换

### 测试要求

- 核心业务逻辑必须有单元测试
- 组件必须有基本的渲染测试
- 目标覆盖率：≥ 80%

## 开发工作流

1. **创建新功能**：
   - 在 `openspec/specs/` 下创建或更新 spec
   - 遵循 TDD：先写测试，再实现功能
   - 提交前运行 `npm run lint` 和 `npm run lint:style`

2. **修改现有功能**：
   - 更新对应的 spec 文档
   - 确保测试通过
   - 更新 codemap.md（如有架构变化）

3. **Code Review 检查项**：
   - [ ] TypeScript 类型完整，无 `any`
   - [ ] 组件职责清晰，无过度耦合
   - [ ] 状态管理符合不可变原则
   - [ ] 测试覆盖核心场景
   - [ ] 提交消息符合规范

## 关键设计决策

1. **基线数据不可变**：`trips.json` 作为基线数据永不修改，用户自定义数据通过 `override` 机制存储在本地
2. **同步本地存储**：使用 `Taro.getStorageSync/setStorageSync` 而非异步 API，简化调用逻辑
3. **单页面多视图**：三大视图（攻略/开销/清单）在同一页面内切换，而非多页面跳转
4. **CSS 变量驱动主题**：四种主题风格通过 CSS 变量实现，避免重复样式代码

## 注意事项

- **离线优先**：应用无需服务端即可运行，所有数据来自静态 JSON 和本地存储
- **跨平台兼容**：代码需兼容微信小程序和 H5，避免使用平台特定 API
- **性能优化**：列表渲染使用 `key` 属性，避免不必要的重新渲染
- **类型安全**：所有数据和组件 props 必须有明确的 TypeScript 类型定义
