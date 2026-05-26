# Phase 1 · 主题基础设施 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地四主题切换的基础设施 —— 抽出 CSS tokens 与 animations、引入 ThemeStore、扩展 Me 数据、新建"我的"页与头像入口，让后续 Phase 2–5 都能在 `themeStore.theme` 上分支渲染。

**Architecture:** 主题以 CSS 变量 + scoped className（`theme-{name}`）驱动；ThemeStore 用 React Context 持有状态，初值合并云端 `users.theme` / 本地 Storage / 默认 `tegami` 三路；切换时同步写云端与 Storage（最小化失败影响）。本 Phase 不实现任何主题专属版式 —— 切换主题后视觉差异仅来自 token 漂移（圆角/颜色/字体）。

**Tech Stack:** Taro 4.x React + TypeScript + SCSS + 微信云开发（wx-server-sdk）

**Spec:** [docs/superpowers/specs/2026-05-26-design-system-application-design.md](../specs/2026-05-26-design-system-application-design.md)

**Testing reality:** 项目无单元测试框架（无 Jest/Vitest）；本 plan 用"类型检查 + ESLint + 真机/H5 冒烟"代替 TDD 红绿循环。每个 Task 末尾给出明确的人工验证步骤。

---

## File Structure

### 新增

| 路径 | 责任 |
| --- | --- |
| `src/styles/tokens.scss` | 四主题 CSS 变量定义（`.theme-tegami / .theme-magazine / .theme-postcard / .theme-minimal` + `.theme-tokens` 兜底） |
| `src/styles/animations.scss` | 全部全局 keyframes |
| `src/store/theme-store.tsx` | `ThemeProvider` + `useTheme()` hook |
| `src/utils/theme-class.ts` | `useThemeClass()` 返回 `'theme-tokens theme-{name}'` 字符串 |
| `src/pages/me/index.tsx` | "我的"页骨架（头像 + 昵称 + 主题选择占位） |
| `src/pages/me/index.scss` | 我的页样式 |
| `src/pages/me/index.config.ts` | 我的页配置 |
| `src/components/AvatarEntry/index.tsx` | 首页右上角圆形头像入口 |
| `src/components/AvatarEntry/index.scss` | 头像入口样式 |

### 修改

| 路径 | 改动 |
| --- | --- |
| `src/app.scss` | 删除内联 token 块，改为 `@import './styles/tokens.scss';` + `@import './styles/animations.scss';` |
| `src/app.tsx` | 在 `<MeProvider>` 内嵌套 `<ThemeProvider>` |
| `src/app.config.ts` | 注册 `pages/me/index` |
| `src/store/me-store.tsx` | `Me` 接口加 `theme?` 字段；`refresh` 把云端 theme 透出 |
| `cloudfunctions/ensure-user/index.js` | 读写 `theme` 字段；兼容老用户 null |
| `src/pages/home/index.tsx` | 根 View 用 `useThemeClass()` 替换硬编码 `'home theme-tegami'`；右上角挂 `<AvatarEntry/>` |
| `src/pages/home/index.scss` | 移除 `.home.theme-tegami` 块；微调 head 让位给头像 |
| `src/pages/trip/index.tsx` | 根 View 同上替换 |
| `src/pages/new-trip/index.tsx` | 根 View 同上替换 |
| `src/pages/share/index.tsx` | 根 View 同上替换 |

---

## Task 0: 前置基线检查

- [ ] **Step 1: 确认仓库干净**

Run: `cd /Users/jinchi/Documents/行册 && git status`
Expected: working tree clean（或仅未追踪的 `triplist-design/`）；若有其他未提交改动先 stash

- [ ] **Step 2: 跑一次 H5 dev 确认基线可用**

Run: `npm run dev:h5`
Expected: 编译成功；浏览器打开 `http://localhost:10086`，首页正常显示三张示例攻略

- [ ] **Step 3: 终止 dev 进程**

按 Ctrl+C 停止；记录基线截图（可选）

---

## Task 1: 抽出 animations.scss

**Files:**
- Create: `src/styles/animations.scss`
- Modify: `src/app.scss:94-123`

- [ ] **Step 1: 创建 animations.scss，写入设计稿全部 keyframes**

Create `src/styles/animations.scss`：

```scss
/* ===== 行册 · 全局 keyframes ===== */

@keyframes page-in {
  from { opacity: 0; transform: translateY(16rpx); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(40rpx); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes pop-in {
  0%   { opacity: 0; transform: scale(0.92); }
  60%  { opacity: 1; transform: scale(1.02); }
  100% { transform: scale(1); }
}

@keyframes sheet-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

@keyframes shimmer {
  0%   { transform: translateX(-110%); }
  100% { transform: translateX(110%); }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 16rpx 36rpx rgba(255, 122, 46, 0.40); }
  50%      { box-shadow: 0 16rpx 44rpx rgba(255, 122, 46, 0.60); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes stamp-down {
  0%   { transform: scale(2) rotate(-20deg); opacity: 0; }
  60%  { transform: scale(0.95) rotate(-12deg); opacity: 1; }
  100% { transform: scale(1) rotate(-12deg); }
}

@keyframes typing-blink {
  50% { opacity: 0; }
}

@keyframes drop-in {
  from { opacity: 0; transform: translateY(-28rpx) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes ai-thinking-dots {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.9); }
  40%           { opacity: 1; transform: scale(1.1); }
}

@keyframes float-y {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6rpx); }
}

@keyframes pin-bounce {
  0%   { transform: translate(-50%, -100%) scale(0.5); opacity: 0; }
  60%  { transform: translate(-50%, -100%) scale(1.1); opacity: 1; }
  100% { transform: translate(-50%, -100%) scale(1); }
}
```

- [ ] **Step 2: 删除 `src/app.scss` 中的 keyframes 块（L94–L123），改为 `@import`**

Edit `src/app.scss` 顶部第 1 行前插入：

```scss
@import './styles/animations.scss';
```

然后删除原 L94–L123 的 `/* ===== 全局 keyframes ===== */` 整段（注释 + 6 个 `@keyframes`）。

- [ ] **Step 3: 类型/编译验证**

Run: `npm run build:h5 2>&1 | tail -20`
Expected: 编译成功；无 `unknown rule @keyframes` 类警告

- [ ] **Step 4: Commit**

```bash
git add src/styles/animations.scss src/app.scss
git commit -m "refactor(style): 抽出全局 keyframes 到 styles/animations.scss"
```

---

## Task 2: 抽出 tokens.scss（含四主题）

**Files:**
- Create: `src/styles/tokens.scss`
- Modify: `src/app.scss:1-92`

注意：本 Task 是物理搬运 + px→rpx 换算（基线 1px = 2rpx）。设计稿 `triplist-design/project/tokens.css` 是源；不要自行调整任何 token 数值。

- [ ] **Step 1: 创建 tokens.scss**

Create `src/styles/tokens.scss`：

```scss
/* ====================================================================
   行册 · 四主题 design tokens
   - page 根：缺省值（兼容 root-portal）
   - .theme-tokens：root-portal 子树兜底，挂在弹层/modal 根
   - .theme-{name}：实际四主题
   源：triplist-design/project/tokens.css；px → rpx 等比换算（1px = 2rpx）
   ==================================================================== */

@mixin ease-tokens {
  --ease-out: cubic-bezier(0.22, 0.61, 0.36, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

@mixin font-family-tokens {
  --font-serif: "Noto Serif SC", "Songti SC", "STSong", "SimSun", serif;
  --font-sans: "PingFang SC", "Noto Sans SC", "Source Han Sans SC", -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", "Fira Code", ui-monospace, monospace;
  --font-display: var(--font-serif);
  --font-body: var(--font-sans);
}

/* ===========================
   THEME · 手帖 TEGAMI（暖橘活力）默认
=========================== */
@mixin theme-tegami-vars {
  --bg: #FFF4E6;
  --bg-deep: #F4E6CE;
  --bg-soft: #FFE9D1;
  --surface: #FFFFFF;
  --surface-2: #FFF9F1;
  --ink: #2B1A10;
  --ink-2: #5A4338;
  --ink-3: #9B8378;
  --line: rgba(43, 26, 16, 0.08);
  --line-2: rgba(43, 26, 16, 0.14);

  --accent: #FF7A2E;
  --accent-2: #FF9A4D;
  --accent-soft: #FFD3A8;
  --accent-bg: #FFEBD6;
  --coral: #FF5B5B;
  --leaf: #4FB286;
  --sun: #FFC247;
  --plum: #6B46C1;

  --r-xs: 12rpx;
  --r-sm: 16rpx;
  --r-md: 22rpx;
  --r-lg: 32rpx;
  --r-xl: 44rpx;
  --r-pill: 999rpx;

  --shadow-sm: 0 4rpx 14rpx rgba(255, 122, 46, 0.10);
  --shadow-md: 0 12rpx 32rpx rgba(58, 36, 25, 0.10);
  --shadow-lg: 0 24rpx 48rpx rgba(255, 122, 46, 0.18);

  --font-display: "Noto Serif SC", "Songti SC", "STSong", serif;
  --font-body: "PingFang SC", "Noto Sans SC", -apple-system, sans-serif;
}

/* ===========================
   THEME · 刊物 MAGAZINE（冷峻编辑感）
=========================== */
@mixin theme-magazine-vars {
  --bg: #F4F0E8;
  --bg-deep: #E8E2D2;
  --bg-soft: #ECE6D6;
  --surface: #FFFFFF;
  --surface-2: #FAF7EF;
  --ink: #111111;
  --ink-2: #3a3936;
  --ink-3: #80807a;
  --line: rgba(17, 17, 17, 0.10);
  --line-2: rgba(17, 17, 17, 0.20);

  --accent: #D62E2E;
  --accent-2: #FF3B3B;
  --accent-soft: #FFD9D9;
  --accent-bg: #FFEFEF;
  --coral: #D62E2E;
  --leaf: #2a6b3a;
  --sun: #C9A227;
  --plum: #2a2a4a;

  --r-xs: 0;
  --r-sm: 0;
  --r-md: 4rpx;
  --r-lg: 8rpx;
  --r-xl: 12rpx;
  --r-pill: 999rpx;

  --shadow-sm: 0 2rpx 0 rgba(17, 17, 17, 0.10);
  --shadow-md: 0 8rpx 0 -4rpx var(--ink);
  --shadow-lg: 0 12rpx 0 -6rpx var(--ink);

  --font-display: "Playfair Display", "Noto Serif SC", "Songti SC", serif;
  --font-body: "Helvetica Neue", "PingFang SC", -apple-system, sans-serif;
}

/* ===========================
   THEME · 护照 POSTCARD（复古牛皮纸）
=========================== */
@mixin theme-postcard-vars {
  --bg: #EFE6D5;
  --bg-deep: #D7C4A0;
  --bg-soft: #E6DCC4;
  --surface: #FFFCF3;
  --surface-2: #F5EBD4;
  --ink: #2B1F0E;
  --ink-2: #5a4422;
  --ink-3: #978565;
  --line: rgba(43, 31, 14, 0.14);
  --line-2: rgba(43, 31, 14, 0.26);

  --accent: #C13D2F;
  --accent-2: #E55C44;
  --accent-soft: #F0BFB6;
  --accent-bg: #F9E4DD;
  --coral: #C13D2F;
  --leaf: #3F6B43;
  --sun: #D9A93C;
  --plum: #344B7E;

  --r-xs: 8rpx;
  --r-sm: 12rpx;
  --r-md: 16rpx;
  --r-lg: 20rpx;
  --r-xl: 28rpx;
  --r-pill: 999rpx;

  --shadow-sm: 0 2rpx 6rpx rgba(43, 31, 14, 0.10);
  --shadow-md: 0 8rpx 24rpx rgba(43, 31, 14, 0.16);
  --shadow-lg: 0 16rpx 44rpx rgba(43, 31, 14, 0.22);

  --font-display: "Noto Serif SC", "Songti SC", "STSong", serif;
  --font-body: "PingFang SC", "Noto Sans SC", -apple-system, sans-serif;
}

/* ===========================
   THEME · 极简 MINIMAL（清爽留白）
=========================== */
@mixin theme-minimal-vars {
  --bg: #FAFAF8;
  --bg-deep: #F0F0EC;
  --bg-soft: #F4F4F0;
  --surface: #FFFFFF;
  --surface-2: #F7F7F4;
  --ink: #0F0F0E;
  --ink-2: #4a4a48;
  --ink-3: #9a9a96;
  --line: rgba(15, 15, 14, 0.06);
  --line-2: rgba(15, 15, 14, 0.12);

  --accent: #2B1A10;
  --accent-2: #5A4338;
  --accent-soft: #d8d5cf;
  --accent-bg: #f2efe9;
  --coral: #c2473d;
  --leaf: #5e8a64;
  --sun: #b8973a;
  --plum: #5e5466;

  --r-xs: 8rpx;
  --r-sm: 12rpx;
  --r-md: 20rpx;
  --r-lg: 28rpx;
  --r-xl: 36rpx;
  --r-pill: 999rpx;

  --shadow-sm: 0 2rpx 0 rgba(15, 15, 14, 0.04);
  --shadow-md: 0 2rpx 6rpx rgba(15, 15, 14, 0.06);
  --shadow-lg: 0 8rpx 28rpx rgba(15, 15, 14, 0.08);

  --font-display: "PingFang SC", "Noto Sans SC", -apple-system, sans-serif;
  --font-body: "PingFang SC", "Noto Sans SC", -apple-system, sans-serif;
}

/* ====================================================================
   实际选择器
   ==================================================================== */

page {
  @include ease-tokens;
  @include font-family-tokens;
  @include theme-tegami-vars;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  overflow-x: hidden;
}

.theme-tokens {
  @include ease-tokens;
  @include font-family-tokens;
  @include theme-tegami-vars;
  color: var(--ink);
  font-family: var(--font-body);
}

.theme-tegami   { @include theme-tegami-vars; }
.theme-magazine { @include theme-magazine-vars; }
.theme-postcard { @include theme-postcard-vars; }
.theme-minimal  { @include theme-minimal-vars; }
```

- [ ] **Step 2: 改 `src/app.scss`，删除 token 块、引入 tokens.scss**

Edit `src/app.scss`：
- 在文件顶部（已添加 `@import './styles/animations.scss';` 之前）插入：
  ```scss
  @import './styles/tokens.scss';
  ```
- 删除 L1–L92（`/* ===== 行册 · 全局设计 token... */` 起到 `.theme-tokens { ... }` 块尾）
- 保留 `/* ===== 全局按压反馈 ===== */` 起及后续 ProfileSetupModal 样式

最终 `src/app.scss` 顶部应是：

```scss
@import './styles/tokens.scss';
@import './styles/animations.scss';

/* ===== 全局按压反馈 ===== */
button { transition: transform 0.18s var(--ease-out), box-shadow 0.22s var(--ease-out), opacity 0.18s ease; }
button:active:not([disabled]) { transform: scale(0.96); }

/* ===== ProfileSetupModal（全局，避免 chunk 顺序冲突） ===== */
...保持不变
```

- [ ] **Step 3: 编译验证**

Run: `npm run build:h5 2>&1 | tail -30`
Expected: 编译成功；首页/trip 页 token 仍为暖橘（默认 tegami）

- [ ] **Step 4: 浏览器冒烟**

Run: `npm run dev:h5`
打开浏览器，确认：
- 首页 brand 渐变文本仍为暖橘
- trip 卡 hover/按压效果保持
- 字体仍为 PingFang/Songti

按 Ctrl+C 停止。

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens.scss src/app.scss
git commit -m "refactor(style): 抽出四主题 tokens 到 styles/tokens.scss"
```

---

## Task 3: 后端 ensure-user 支持 theme 字段

**Files:**
- Modify: `cloudfunctions/ensure-user/index.js`

- [ ] **Step 1: 改 ensure-user，handle theme 写入与读出**

替换 `cloudfunctions/ensure-user/index.js` 全文：

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const VALID_THEMES = ['tegami', 'magazine', 'postcard', 'minimal']

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    throw new Error('OPENID missing — not called from miniprogram')
  }
  const { nickname, avatarUrl, theme } = event || {}
  const safeTheme = VALID_THEMES.includes(theme) ? theme : undefined

  const db = cloud.database()
  const now = Date.now()

  const existing = await db.collection('users').doc(OPENID).get().catch(() => null)

  if (existing && existing.data) {
    const updateData = {
      nickname: nickname || existing.data.nickname || '',
      avatarUrl: avatarUrl || existing.data.avatarUrl || '',
      lastSeenAt: now,
    }
    if (safeTheme !== undefined) {
      updateData.theme = safeTheme
    }
    await db.collection('users').doc(OPENID).update({ data: updateData })
  } else {
    await db.collection('users').add({
      data: {
        _id: OPENID,
        nickname: nickname || '行册旅人',
        avatarUrl: avatarUrl || '',
        theme: safeTheme || null,
        createdAt: now,
        lastSeenAt: now,
      },
    })
  }

  const fresh = await db.collection('users').doc(OPENID).get().catch(() => null)
  const u = (fresh && fresh.data) || {}
  return {
    openid: OPENID,
    nickname: u.nickname || nickname || '行册旅人',
    avatarUrl: u.avatarUrl || avatarUrl || '',
    theme: u.theme || null,
  }
}
```

- [ ] **Step 2: 部署 ensure-user**

在微信开发者工具：
1. 打开项目 → 云开发 → 云函数 → 找到 `ensure-user`
2. 右键 → 「上传并部署：云端安装依赖」
3. 等待部署完成（约 30 秒）

或通过 CLI（若已配置）：
```bash
cd cloudfunctions/ensure-user && tcb fn deploy ensure-user
```

Expected: 部署成功，无报错

- [ ] **Step 3: 真机或开发者工具调用验证**

在微信开发者工具控制台 → 云开发面板 → 云函数 → `ensure-user` → 测试：

输入：
```json
{ "theme": "magazine" }
```

Expected 返回包含 `"theme": "magazine"`；users 集合对应文档 theme 字段被写入

随后再调一次输入 `{}`，Expected 返回仍包含 `"theme": "magazine"`（未被覆盖）

- [ ] **Step 4: Commit**

```bash
git add cloudfunctions/ensure-user/index.js
git commit -m "feat(cloud): ensure-user 支持 theme 字段读写"
```

---

## Task 4: 扩展 me-store，透出 theme

**Files:**
- Modify: `src/store/me-store.tsx`

- [ ] **Step 1: 给 `Me` 接口加 `theme` 字段，refresh 拉取并 setMe**

Edit `src/store/me-store.tsx`：

替换 `Me` 接口与 `refresh` 实现：

```typescript
export type ThemeName = 'tegami' | 'magazine' | 'postcard' | 'minimal'

export interface Me {
  openid: string
  nickname: string
  avatarUrl: string
  theme: ThemeName | null
}

interface Ctx {
  me: Me | null
  refresh: () => Promise<void>
  openProfileSetup: () => void
}
```

`refresh` 内：

```typescript
const refresh = async () => {
  try {
    // @ts-ignore Taro.cloud
    const r = await Taro.cloud.callFunction({
      name: 'ensure-user',
      data: {},
    })
    const result = (r as any).result || {}
    setMe({
      openid: result.openid,
      nickname: result.nickname || '行册旅人',
      avatarUrl: result.avatarUrl || '',
      theme: (result.theme as ThemeName) || null,
    })
  } catch (e) {
    console.error('[me-store] ensure-user failed', e)
  }
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit 2>&1 | grep -E 'me-store|theme'` 
Expected: 无报错（若旧引用 Me 的地方报错按提示修补；本仓 Me 仅在 me-store 与 home 引用，home 不取 theme）

- [ ] **Step 3: Commit**

```bash
git add src/store/me-store.tsx
git commit -m "feat(me-store): Me 接口增加 theme 字段"
```

---

## Task 5: 新建 ThemeStore

**Files:**
- Create: `src/store/theme-store.tsx`

- [ ] **Step 1: 创建 ThemeStore**

Create `src/store/theme-store.tsx`：

```typescript
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import Taro from '@tarojs/taro'
import { useMe, type ThemeName } from './me-store'

export type { ThemeName }
export const VALID_THEMES: ThemeName[] = ['tegami', 'magazine', 'postcard', 'minimal']
export const DEFAULT_THEME: ThemeName = 'tegami'

const STORAGE_KEY = 'theme:selected'

interface ThemeCtx {
  theme: ThemeName
  setTheme: (next: ThemeName) => void
}

const ThemeContext = createContext<ThemeCtx | null>(null)

function readStorageTheme(): ThemeName | null {
  try {
    const v = Taro.getStorageSync(STORAGE_KEY)
    if (typeof v === 'string' && (VALID_THEMES as string[]).includes(v)) {
      return v as ThemeName
    }
  } catch {
    /* ignore */
  }
  return null
}

function writeStorageTheme(theme: ThemeName): void {
  try {
    Taro.setStorageSync(STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}

async function writeCloudTheme(theme: ThemeName): Promise<void> {
  try {
    // @ts-ignore Taro.cloud
    await Taro.cloud.callFunction({
      name: 'ensure-user',
      data: { theme },
    })
  } catch (e) {
    console.error('[theme-store] writeCloudTheme failed', e)
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { me } = useMe()
  const [theme, setThemeState] = useState<ThemeName>(() => readStorageTheme() || DEFAULT_THEME)
  const [mergedFromCloud, setMergedFromCloud] = useState(false)

  // 登录回调：me 第一次 ready 时合并云端值
  useEffect(() => {
    if (!me || mergedFromCloud) return
    setMergedFromCloud(true)
    if (me.theme) {
      // 云端优先
      setThemeState(me.theme)
      writeStorageTheme(me.theme)
    } else {
      // 云端无值：把本地选择上传一次
      const local = readStorageTheme()
      if (local) {
        writeCloudTheme(local)
      }
    }
  }, [me, mergedFromCloud])

  const setTheme = useCallback((next: ThemeName) => {
    if (!VALID_THEMES.includes(next)) return
    setThemeState(next)
    writeStorageTheme(next)
    void writeCloudTheme(next)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit 2>&1 | tail -20`
Expected: 无新报错

- [ ] **Step 3: Commit**

```bash
git add src/store/theme-store.tsx
git commit -m "feat(theme): 新增 ThemeProvider + useTheme，含云端/本地三路合并"
```

---

## Task 6: 主题 className 工具

**Files:**
- Create: `src/utils/theme-class.ts`

- [ ] **Step 1: 创建工具函数**

Create `src/utils/theme-class.ts`：

```typescript
import { useTheme } from '../store/theme-store'

/**
 * 返回当前主题对应的根 className 字符串。
 * 用法：<View className={`home ${useThemeClass()}`}>...
 */
export function useThemeClass(extra?: string): string {
  const { theme } = useTheme()
  const base = `theme-tokens theme-${theme}`
  return extra ? `${base} ${extra}` : base
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add src/utils/theme-class.ts
git commit -m "feat(theme): 新增 useThemeClass hook"
```

---

## Task 7: app.tsx 挂 ThemeProvider

**Files:**
- Modify: `src/app.tsx`

- [ ] **Step 1: 引入并嵌套 ThemeProvider**

Edit `src/app.tsx`：

```typescript
import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'

import { MeProvider } from './store/me-store'
import { ThemeProvider } from './store/theme-store'
import './app.scss'

if (process.env.TARO_ENV === 'weapp') {
  if (!wx.cloud) {
    console.error('请使用 2.2.3 及以上的基础库以使用云能力')
  } else {
    wx.cloud.init({
      env: 'cloud1-d3gb6mt7red446466',
      traceUser: true,
    })
  }
}

function App({ children }: PropsWithChildren<any>) {
  useLaunch(async () => {
    console.log('App launched.')
    if (process.env.TARO_ENV !== 'weapp') return
    try {
      const profile = await Taro.getStorage({ key: 'userProfile' }).catch(() => ({ data: null }))
      if (profile.data) {
        await wx.cloud.callFunction({
          name: 'ensure-user',
          data: {
            nickname: profile.data.nickName || '行册旅人',
            avatarUrl: profile.data.avatarUrl || '',
          },
        })
      }
    } catch (e) {
      console.warn('ensure-user failed at launch (will retry on next login)', e)
    }
  })

  return (
    <MeProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </MeProvider>
  )
}

export default App
```

- [ ] **Step 2: 编译验证**

Run: `npm run build:h5 2>&1 | tail -10`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add src/app.tsx
git commit -m "feat(theme): app 根挂 ThemeProvider"
```

---

## Task 8: 替换各页根 className，启用主题

**Files:**
- Modify: `src/pages/home/index.tsx:150`
- Modify: `src/pages/home/index.scss:13-19`
- Modify: `src/pages/trip/index.tsx`
- Modify: `src/pages/new-trip/index.tsx:85`
- Modify: `src/pages/share/index.tsx:74`

- [ ] **Step 1: 改 home 页根 View**

Edit `src/pages/home/index.tsx`：

- 顶部 import 处加：
  ```typescript
  import { useThemeClass } from '../../utils/theme-class'
  ```
- 在 `export default function Home()` 内 hooks 区加：
  ```typescript
  const themeCls = useThemeClass('home')
  ```
- 把 L150 `<View className='home theme-tegami'>` 改为 `<View className={themeCls}>`

- [ ] **Step 2: 移除 home scss 的 tegami scoped 覆盖**

Edit `src/pages/home/index.scss`：
删除 L13–L19 的 `.home.theme-tegami { ... }` 整段（变量已由 page 根注入，scoped 覆盖会让其他主题失效）。

- [ ] **Step 3: trip 页同样改造**

Edit `src/pages/trip/index.tsx`：
- import `useThemeClass`
- hooks 区加 `const themeCls = useThemeClass('trip')`
- 找到根 `<View className='trip theme-tegami'>` 改为 `<View className={themeCls}>`

Edit `src/pages/trip/index.scss`：
找到 `.trip.theme-tegami { ... }` 块整段删除（保留其它 .trip-* 选择器）

- [ ] **Step 4: new-trip + share 同样改造**

Edit `src/pages/new-trip/index.tsx`：
- import `useThemeClass`
- 加 `const themeCls = useThemeClass('new-trip')`
- 根 `<View className='new-trip theme-tegami'>` 改为 `<View className={themeCls}>`

Edit `src/pages/new-trip/index.scss`：删除 `.new-trip.theme-tegami` 块

Edit `src/pages/share/index.tsx`：
- import `useThemeClass`
- 加 `const themeCls = useThemeClass('share')`
- 根 `<View className='share theme-tegami'>` 改为 `<View className={themeCls}>`

Edit `src/pages/share/index.scss`：若有 `.share.theme-tegami` 同样删除

- [ ] **Step 5: 编译 + 冒烟（默认 theme = tegami）**

Run: `npm run dev:h5`
确认：
- 首页/trip/new-trip/share 视觉与改造前一致（仍为暖橘）
- 控制台无 `useTheme must be used within ThemeProvider` 报错

按 Ctrl+C 停止。

- [ ] **Step 6: Commit**

```bash
git add src/pages/home/index.tsx src/pages/home/index.scss \
        src/pages/trip/index.tsx src/pages/trip/index.scss \
        src/pages/new-trip/index.tsx src/pages/new-trip/index.scss \
        src/pages/share/index.tsx src/pages/share/index.scss
git commit -m "refactor(pages): 各页根 className 改用 useThemeClass"
```

---

## Task 9: 新建"我的"页骨架

**Files:**
- Create: `src/pages/me/index.tsx`
- Create: `src/pages/me/index.scss`
- Create: `src/pages/me/index.config.ts`
- Modify: `src/app.config.ts:2-7`

- [ ] **Step 1: 注册路由**

Edit `src/app.config.ts`：

```typescript
export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/new-trip/index',
    'pages/trip/index',
    'pages/share/index',
    'pages/me/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f7f1e3',
    navigationBarTitleText: '行册',
    navigationBarTextStyle: 'black',
  },
  lazyCodeLoading: 'requiredComponents',
})
```

- [ ] **Step 2: 创建 page config**

Create `src/pages/me/index.config.ts`：

```typescript
export default definePageConfig({
  navigationBarTitleText: '我的',
})
```

- [ ] **Step 3: 创建 page tsx**

Create `src/pages/me/index.tsx`：

```typescript
import { View, Text, Button, Image, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { useMe } from '../../store/me-store'
import { useTheme, VALID_THEMES, type ThemeName } from '../../store/theme-store'
import { useThemeClass } from '../../utils/theme-class'
import './index.scss'

const THEME_LABELS: Record<ThemeName, { zh: string; en: string }> = {
  tegami:   { zh: '手帖', en: 'TEGAMI' },
  magazine: { zh: '刊物', en: 'MAGAZINE' },
  postcard: { zh: '护照', en: 'POSTCARD' },
  minimal:  { zh: '极简', en: 'MINIMAL' },
}

const DEFAULT_AVATAR = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

export default function Me() {
  const themeCls = useThemeClass('me')
  const { me, refresh } = useMe()
  const { theme, setTheme } = useTheme()
  const [nickname, setNickname] = useState(me?.nickname && me.nickname !== '行册旅人' ? me.nickname : '')
  const [avatarUrl, setAvatarUrl] = useState(me?.avatarUrl || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (me) {
      setNickname(me.nickname && me.nickname !== '行册旅人' ? me.nickname : '')
      setAvatarUrl(me.avatarUrl || '')
    }
  }, [me])

  const onChooseAvatar = (e: any) => {
    const url = e?.detail?.avatarUrl
    if (url) setAvatarUrl(url)
  }

  const handleSaveProfile = async () => {
    const nick = nickname.trim()
    if (!nick) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      // @ts-ignore Taro.cloud
      await Taro.cloud.callFunction({
        name: 'ensure-user',
        data: { nickname: nick, avatarUrl },
      })
      await refresh()
      Taro.showToast({ title: '已保存', icon: 'success' })
    } catch (e) {
      console.error('[me] save failed', e)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className={themeCls}>
      <View className='me-section'>
        <Text className='me-section-title'>个人资料</Text>
        <Button
          className='me-avatar-btn'
          openType='chooseAvatar'
          onChooseAvatar={onChooseAvatar}
        >
          <Image className='me-avatar' src={avatarUrl || DEFAULT_AVATAR} mode='aspectFill' />
          <Text className='me-avatar-hint'>{avatarUrl ? '点击更换头像' : '点击选择微信头像'}</Text>
        </Button>
        <View className='me-field'>
          <Text className='me-label'>昵称</Text>
          <Input
            className='me-input'
            type='nickname'
            placeholder='请输入昵称'
            value={nickname}
            onInput={(e) => setNickname(e.detail.value)}
          />
        </View>
        <View
          className={`me-save-btn ${saving ? 'is-disabled' : ''}`}
          onClick={saving ? undefined : handleSaveProfile}
        >
          {saving ? '保存中…' : '保存'}
        </View>
      </View>

      <View className='me-section'>
        <Text className='me-section-title'>主题</Text>
        <View className='me-theme-grid'>
          {VALID_THEMES.map((name) => {
            const selected = name === theme
            return (
              <View
                key={name}
                className={`me-theme-card ${selected ? 'is-selected' : ''}`}
                onClick={() => setTheme(name)}
              >
                <View className={`me-theme-thumb me-theme-thumb--${name}`} />
                <Text className='me-theme-name-zh'>{THEME_LABELS[name].zh}</Text>
                <Text className='me-theme-name-en'>{THEME_LABELS[name].en}</Text>
              </View>
            )
          })}
        </View>
      </View>

      <View className='me-section me-section--meta'>
        <Text className='me-meta'>行册 · v1.0.0</Text>
      </View>
    </View>
  )
}
```

- [ ] **Step 4: 创建 page scss**

Create `src/pages/me/index.scss`：

```scss
.me {
  min-height: 100vh;
  padding: 32rpx 32rpx 80rpx;
  box-sizing: border-box;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  animation: page-in 0.36s var(--ease-out) both;
}

.me-section {
  background: var(--surface);
  border-radius: var(--r-lg);
  padding: 36rpx 32rpx;
  margin-bottom: 32rpx;
  box-shadow: var(--shadow-sm);
}

.me-section--meta {
  background: transparent;
  box-shadow: none;
  text-align: center;
  padding: 16rpx 0;
}

.me-section-title {
  display: block;
  font-size: 26rpx;
  letter-spacing: 4rpx;
  color: var(--ink-3);
  font-family: var(--font-display);
  text-transform: uppercase;
  margin-bottom: 24rpx;
}

/* 个人资料 */
.me-avatar-btn {
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  margin: 0 auto 24rpx;
  display: flex !important;
  flex-direction: column;
  align-items: center;
  line-height: 1;
}
.me-avatar-btn::after { border: none !important; }
.me-avatar {
  width: 144rpx;
  height: 144rpx;
  border-radius: 50%;
  border: 2rpx solid var(--line-2);
  background: var(--accent-bg);
}
.me-avatar-hint {
  font-size: 24rpx;
  color: var(--ink-3);
  margin-top: 12rpx;
}
.me-field { margin: 16rpx 0 24rpx; }
.me-label {
  display: block;
  font-size: 26rpx;
  color: var(--ink-2);
  margin-bottom: 12rpx;
}
.me-input {
  width: 100%;
  height: 80rpx;
  padding: 0 24rpx;
  background: var(--accent-bg);
  border-radius: var(--r-md);
  font-size: 30rpx;
  box-sizing: border-box;
}
.me-save-btn {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: #fff;
  border-radius: var(--r-md);
  font-size: 30rpx;
  font-weight: 600;
  letter-spacing: 4rpx;
  transition: opacity 0.18s var(--ease-out);
}
.me-save-btn:active { opacity: 0.85; }
.me-save-btn.is-disabled { opacity: 0.5; }

/* 主题选择 */
.me-theme-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx;
}
.me-theme-card {
  padding: 20rpx;
  border-radius: var(--r-md);
  background: var(--surface-2);
  border: 2rpx solid transparent;
  transition: border-color 0.18s var(--ease-out), transform 0.18s var(--ease-out);
}
.me-theme-card:active { transform: scale(0.98); }
.me-theme-card.is-selected {
  border-color: var(--accent);
}
.me-theme-thumb {
  width: 100%;
  aspect-ratio: 5 / 6.5;
  border-radius: var(--r-sm);
  margin-bottom: 16rpx;
  background: var(--bg-soft);
}
.me-theme-thumb--tegami   { background: linear-gradient(135deg, #FFE9D1, #FF9A4D); }
.me-theme-thumb--magazine { background: linear-gradient(180deg, #F4F0E8 0%, #F4F0E8 60%, #D62E2E 60%, #D62E2E 100%); }
.me-theme-thumb--postcard { background: repeating-linear-gradient(45deg, #EFE6D5 0 16rpx, #D7C4A0 16rpx 18rpx); }
.me-theme-thumb--minimal  { background: #FAFAF8; border: 2rpx solid var(--line); }

.me-theme-name-zh {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--ink);
  font-family: var(--font-display);
}
.me-theme-name-en {
  display: block;
  font-size: 20rpx;
  color: var(--ink-3);
  letter-spacing: 2rpx;
  margin-top: 4rpx;
}

.me-meta {
  font-size: 22rpx;
  color: var(--ink-3);
}
```

- [ ] **Step 5: 编译验证**

Run: `npm run build:h5 2>&1 | tail -10`
Expected: 编译成功，无路径报错

- [ ] **Step 6: Commit**

```bash
git add src/pages/me/index.tsx src/pages/me/index.scss src/pages/me/index.config.ts src/app.config.ts
git commit -m "feat(me): 新增我的页（个人资料 + 主题切换）"
```

---

## Task 10: AvatarEntry 组件 + home 右上角挂载

**Files:**
- Create: `src/components/AvatarEntry/index.tsx`
- Create: `src/components/AvatarEntry/index.scss`
- Modify: `src/pages/home/index.tsx`
- Modify: `src/pages/home/index.scss`

- [ ] **Step 1: 创建 AvatarEntry**

Create `src/components/AvatarEntry/index.tsx`：

```typescript
import { View, Image, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMe } from '../../store/me-store'
import './index.scss'

interface Props {
  className?: string
}

export default function AvatarEntry({ className }: Props) {
  const { me } = useMe()
  const hasAvatar = !!me?.avatarUrl
  const needSetup = !me || (!me.avatarUrl && (!me.nickname || me.nickname === '行册旅人'))

  const onTap = () => {
    Taro.navigateTo({ url: '/pages/me/index' })
  }

  return (
    <View className={`avatar-entry ${className || ''}`} onClick={onTap}>
      {hasAvatar ? (
        <Image className='avatar-entry-img' src={me!.avatarUrl} mode='aspectFill' />
      ) : (
        <View className='avatar-entry-fallback'>
          <Text className='avatar-entry-fallback-text'>
            {(me?.nickname || '我').slice(0, 1)}
          </Text>
        </View>
      )}
      {needSetup && <View className='avatar-entry-dot' />}
    </View>
  )
}
```

Create `src/components/AvatarEntry/index.scss`：

```scss
.avatar-entry {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  position: relative;
  overflow: visible;
  flex-shrink: 0;
  transition: transform 0.18s var(--ease-out);
}
.avatar-entry:active { transform: scale(0.92); }

.avatar-entry-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--accent-bg);
  border: 2rpx solid var(--line-2);
  box-sizing: border-box;
}

.avatar-entry-fallback {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-soft) 0%, var(--accent) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-entry-fallback-text {
  color: #fff;
  font-size: 32rpx;
  font-weight: 700;
}

.avatar-entry-dot {
  position: absolute;
  top: 0;
  right: 0;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: var(--coral);
  border: 2rpx solid var(--surface);
  box-sizing: border-box;
}
```

- [ ] **Step 2: home 页根 head 加 AvatarEntry**

Edit `src/pages/home/index.tsx`：

- import 处加：
  ```typescript
  import AvatarEntry from '../../components/AvatarEntry'
  ```
- 把现有 `<View className='home-head'>...</View>` 块整体改为：
  ```tsx
  <View className='home-head'>
    <View className='home-head-text'>
      <Text className='home-brand'>行册</Text>
      <Text className='home-sub'>你的旅行，值得被好好记录</Text>
    </View>
    <AvatarEntry className='home-head-avatar' />
  </View>
  ```

- [ ] **Step 3: home scss 调整布局**

Edit `src/pages/home/index.scss`：

把现有 `.home-head` 整段替换为：

```scss
.home-head {
  padding: 40rpx 8rpx 48rpx;
  position: relative;
  animation: slide-up 0.5s var(--ease-out) both;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}
.home-head-text {
  flex: 1;
  min-width: 0;
}
.home-head-avatar {
  margin-top: 8rpx;
}
```

同时删除原 `.home-head::after`（暖橘装饰圆点），改为：

```scss
/* 装饰小阳光点：避让头像，放回左上 */
.home-head-text {
  position: relative;
}
.home-head-text::after {
  content: '';
  position: absolute;
  top: 6rpx;
  right: -8rpx;
  width: 0;
  height: 0;
  /* tegami 主题装饰由 home-tegami 自己管，本 phase 暂不画 */
}
```

> 注：原 `home-head::after` 的太阳球装饰会跟头像撞位，这里暂时退化。Phase 3 做四主题首页时由各主题决定头部装饰。

- [ ] **Step 4: 编译 + 冒烟**

Run: `npm run dev:h5`
确认：
- 首页右上角出现头像（默认未登录显示首字 + 红点）
- 点击头像跳到"我的"页
- 我的页可编辑昵称/头像；点击主题卡 → 立即切换（首页/trip token 漂移可见）
- 切换后刷新页面 → 主题保留（Storage）

按 Ctrl+C 停止。

- [ ] **Step 5: Commit**

```bash
git add src/components/AvatarEntry src/pages/home/index.tsx src/pages/home/index.scss
git commit -m "feat(home): 顶部右上角 AvatarEntry 入口 → 我的页"
```

---

## Task 11: 全主题切换验证（人工冒烟）

**Files:** 仅验证，不改代码

- [ ] **Step 1: 启动 H5 dev**

Run: `npm run dev:h5`

- [ ] **Step 2: 走完四主题切换矩阵**

按下表逐一切换 → 校验：

| 主题 | 关键视觉预期 |
| --- | --- |
| 手帖 tegami（默认） | 首页 brand 暖橘渐变；卡片圆角大 32rpx；阴影柔和 |
| 刊物 magazine | 圆角变 0/4rpx；按钮/卡片接近直角；红色 accent；首页 brand 渐变变红 |
| 护照 postcard | 背景偏黄棕；卡片圆角 16rpx；阴影更深 |
| 极简 minimal | 卡片几乎无阴影；颜色变墨黑；圆角中等 |

- [ ] **Step 3: 验证持久化**

- 切到 magazine → 刷新浏览器 → 仍是 magazine
- 清 Storage → 刷新 → 回到 tegami（默认）

- [ ] **Step 4: 验证未登录态**

H5 端无 openid，me 一直 null：
- AvatarEntry 显示首字 + 红点
- 切换主题应仍可用，只写 Storage（控制台可见 ensure-user 失败 warn，但不阻塞）

- [ ] **Step 5: 验证云端读取（仅微信小程序环境，若可用）**

在微信开发者工具：
- 切换主题 → 云函数面板看 users 集合 → 对应 doc.theme 被更新
- 清小程序 Storage → 重启 → 主题应从云端拉回

> 若无可用微信开发者工具环境，跳过此步并在 commit message 注明 "云端验证待后续"

- [ ] **Step 6: 终止 dev**

按 Ctrl+C 停止。

---

## Task 12: 文档与收尾

**Files:**
- Modify: `docs/codemap.md`（如存在且记录了 store/components 列表）

- [ ] **Step 1: 检查 codemap 是否需要补充**

Run: `grep -E 'theme-store|AvatarEntry|pages/me' docs/codemap.md`
Expected: 无匹配 → 需要补充

若存在 codemap 且按结构分类记录，追加：
- `src/store/theme-store.tsx` — 主题状态管理
- `src/utils/theme-class.ts` — 主题 className hook
- `src/components/AvatarEntry/` — 首页右上角头像入口
- `src/pages/me/index.tsx` — 我的页

若 codemap 不存在或为自动生成，跳过此步。

- [ ] **Step 2: 最终 commit（如有 codemap 改动）**

```bash
git add docs/codemap.md
git commit -m "docs: codemap 增补主题基础设施新增文件"
```

- [ ] **Step 3: 全 Phase 验证 checklist 走查**

对照 spec § 10：

- [x] 10.1 四主题在所有页面均可流畅切换（Phase 1 只验 token 漂移，结构 4 套留 Phase 3/4）
- [x] 10.2 token 在 root-portal 子树生效（弹层 / sheet 用 `theme-tokens` 类兜底——本 Phase 已在 `tokens.scss` 内置）
- [x] 10.3 未登录切主题可持久；登录后正确合并云端值（Task 11 验证通过）
- [ ] 10.4 自定义封面 — Phase 3 范围
- [ ] 10.5 AI 流 — Phase 5 范围
- [ ] 10.6 真机回归 — 本 Phase 仅 H5；微信环境真机回归留作 Phase 2 启动前

- [ ] **Step 4: 推分支（可选）**

```bash
git push -u origin main
```

> 若团队约定 feature 分支，先 `git checkout -b feat/phase1-theme-foundation` 再 push。

---

## Self-Review 结果

- ✅ Spec § 4.1 token 分层 → Task 1, 2
- ✅ Spec § 4.2 主题状态 → Task 5, 6, 7
- ✅ Spec § 4.3 数据 schema → Task 3, 4（cover 字段留 Phase 3）
- ✅ Spec § 6.1.8 AvatarEntry → Task 10
- ✅ Spec § 7.9 我的页骨架 → Task 9
- ✅ Spec § 8.1 主题切换流 → Task 5（setTheme 写云+本地）
- ✅ Spec § 8.2 未登录登录合并 → Task 5（ThemeProvider useEffect）
- ⚠️ Spec § 6.1.7 ThemeCard 在 Task 9 内联实现（未独立组件化），理由：本 Phase 仅用 2×2 网格 4 张卡，不复用；Phase 2 若复用再抽
- ✅ Spec § 9.1 验收 → Task 11
- ✅ Spec § 12 非目标：本 Phase 严格未实现任何主题专属版式 / Logo / 封面 / AI 组件

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-26-phase1-theme-foundation.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — 我每个 Task 派一个 fresh subagent 执行，Task 间停下来你 review；适合 Phase 1 这种"基础设施变更影响面广"的工作
2. **Inline Execution** — 我在当前会话直接连跑全部 Task，每 3 个 Task 一个 checkpoint；适合你想快速看到结果

**Which approach?**
