# COMMANDS.md

> 命令来源仅限于项目 manifest 文件（package.json），不得从 spec.md 的 Requirements 中提取。

## 构建命令

### 微信小程序
| 命令 | 实际执行 | 用途 | 来源 |
|------|---------|------|------|
| `npm run dev:weapp` | `taro build --type weapp --watch` | 启动微信小程序开发服务器（监听模式） | [package.json:24](../package.json#L24) |
| `npm run build:weapp` | `taro build --type weapp` | 构建微信小程序生产产物 | [package.json:15](../package.json#L15) |

### H5
| 命令 | 实际执行 | 用途 | 来源 |
|------|---------|------|------|
| `npm run dev:h5` | `taro build --type h5 --watch` | 启动 H5 开发服务器（监听模式） | [package.json:28](../package.json#L28) |
| `npm run build:h5` | `taro build --type h5` | 构建 H5 生产产物 | [package.json:19](../package.json#L19) |

### 其他平台
| 命令 | 实际执行 | 用途 | 来源 |
|------|---------|------|------|
| `npm run dev:swan` | `taro build --type swan --watch` | 百度小程序开发 | [package.json:25](../package.json#L25) |
| `npm run dev:alipay` | `taro build --type alipay --watch` | 支付宝小程序开发 | [package.json:26](../package.json#L26) |
| `npm run dev:tt` | `taro build --type tt --watch` | 抖音小程序开发 | [package.json:27](../package.json#L27) |
| `npm run dev:rn` | `taro build --type rn --watch` | React Native 开发 | [package.json:29](../package.json#L29) |
| `npm run dev:qq` | `taro build --type qq --watch` | QQ 小程序开发 | [package.json:30](../package.json#L30) |
| `npm run dev:jd` | `taro build --type jd --watch` | 京东小程序开发 | [package.json:31](../package.json#L31) |
| `npm run dev:harmony-hybrid` | `taro build --type harmony-hybrid --watch` | 鸿蒙混合开发 | [package.json:32](../package.json#L32) |
| `npm run build:swan` | `taro build --type swan` | 百度小程序构建 | [package.json:16](../package.json#L16) |
| `npm run build:alipay` | `taro build --type alipay` | 支付宝小程序构建 | [package.json:17](../package.json#L17) |
| `npm run build:tt` | `taro build --type tt` | 抖音小程序构建 | [package.json:18](../package.json#L18) |
| `npm run build:rn` | `taro build --type rn` | React Native 构建 | [package.json:20](../package.json#L20) |
| `npm run build:qq` | `taro build --type qq` | QQ 小程序构建 | [package.json:21](../package.json#L21) |
| `npm run build:jd` | `taro build --type jd` | 京东小程序构建 | [package.json:22](../package.json#L22) |
| `npm run build:harmony-hybrid` | `taro build --type harmony-hybrid` | 鸿蒙混合构建 | [package.json:23](../package.json#L23) |

## 开发工具命令

| 命令 | 实际执行 | 用途 | 来源 |
|------|---------|------|------|
| `npm run prepare` | `husky` | 安装 Git hooks（npm install 后自动执行） | [package.json:13](../package.json#L13) |
| `npm run new` | `taro new` | 使用 Taro CLI 创建新页面/组件 | [package.json:14](../package.json#L14) |

## 代码检查

项目中存在以下代码质量工具配置，但未在 `package.json` 中定义直接运行的脚本：

- **Commitlint**：继承 Conventional Commits 规范，通过 Husky 的 `commit-msg` 钩子自动触发。来源：[commitlint.config.mjs:1](../commitlint.config.mjs#L1)
- **Stylelint**：继承 stylelint-config-standard 规则集，校验 SCSS/CSS 样式。来源：[stylelint.config.mjs:2-4](../stylelint.config.mjs#L2-L4)
- **ESLint**：使用 eslint-config-taro 预设，配合 eslint-plugin-react 和 eslint-plugin-react-hooks。来源：[project-config §4](../openspec/specs/project-config/spec.md)

> 如需手动运行，可执行 `npx stylelint "src/**/*.scss"` 或 `npx eslint "src/**/*.{ts,tsx}"`（需自行验证命令可用性）。

> **章节来源**
> → 详见 [project-config §4](../openspec/specs/project-config/spec.md)
