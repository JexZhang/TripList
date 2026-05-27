# Phase 5 · AI 收尾与清理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 AI 入口/流程从旧组件 (`AIPlanForm` / `AILoadingBar`) 切到新组件 (`AIInterview` / `AILoadingTheater` / `TripAIStatusBar`)；补齐"我的"页 4 张主题预览缩略图 SVG；删除旧 AI 组件和 `pages/preview/` 示例页；冒烟测试 spec § 10.5 列举的 AI 全流程分支。

**Architecture:**
- Trip 页变成 AI 流的唯一编排者：维护 `theaterMinimized` 本地态，按 `t.aiStatus + theaterMinimized` 决定渲染 `<AILoadingTheater/>` 还是 `<TripAIStatusBar/>`，`'ready'` 态走既有 `useEffect` 自动弹 Preview。
- `AILoadingTheater` 保持现 dumb API (`{open, status, onCancel, onMinimize}`)：父级 trip 页已订阅 trip-store 拿到 `aiStatus`，无需组件内重复订阅。这是相对 spec § 6.1.4 的一个最小化偏离（spec 写 `{open, tripId, onCancel, onMinimize, onComplete}` + 内部订阅），收益是组件可独立呈现且无 Provider 依赖。
- "我的"页主题缩略图改成 inline `<Image src=svg>`，删除现 `me-theme-thumb--xxx` 的纯 CSS 占位。
- Home 页 → trip 页传递无新机制：trip 页 mount 时若 `aiStatus === 'generating'` Theater 自然展开（`theaterMinimized` 初值 false）。

**Tech Stack:** Taro 4.x React + TypeScript + SCSS + 内联 SVG

**Spec:** [docs/superpowers/specs/2026-05-26-design-system-application-design.md](../specs/2026-05-26-design-system-application-design.md) § 5.2 / § 6 / § 8.4 / § 9.5 / § 10.5

**Prerequisite:** Phase 4a–4e 全部合并（4a–4b 已合并；本 plan 启动前需 4c/4d/4e 合并）

**Scope：**
- 改：
  - `src/pages/trip/index.tsx`：AI 流编排重写（form 换 interview / 引入 theater 与 statusbar / 移除 AILoadingBar 引用）
  - `src/pages/trip/TripHeader{Tegami,Magazine,Postcard,Minimal}.tsx`：移除 `AILoadingBar` 渲染段
  - `src/pages/new-trip/index.tsx`：删除 `AIPlanForm`，统一走 `AIInterview`
  - `src/pages/me/index.tsx` + `index.scss`：主题缩略图换成 SVG
  - `src/app.config.ts`：移除 `pages/preview/index` 路由
- 删：
  - `src/components/AIPlanForm/`
  - `src/components/AILoadingBar/`
  - `src/pages/preview/`
- 不改：
  - `AIInterview` / `AILoadingTheater` / `TripAIStatusBar` / `AIPlanPreview` 组件本体
  - `HomeCardAIRow` 及 4 个 Home 子组件（`HomeCardAIRow` 是 `AILoadingBar` 改造前已经独立的组件，与本 plan 无关）
  - `cloudfunctions/ai-plan-trip` 及 `utils/ai-task.ts`、`utils/db.ts` 中 AI 字段读写逻辑

**Testing reality:** 微信开发者工具冒烟 + spec § 10.5 五条主分支人工走查。无单元测试。

---

## File Structure

### 修改

| 路径 | 改动 |
| --- | --- |
| `src/pages/trip/index.tsx` | 替换 `AIPlanForm` 引用 → `AIInterview`；新增 `theaterMinimized` state；按状态渲染 `AILoadingTheater` / `TripAIStatusBar`；删除 `clearAIPlanFormDraft` 调用 |
| `src/pages/trip/TripHeaderTegami.tsx` | 删除 `AILoadingBar` import + 渲染段（连同包裹的 `.thtg-ai-bar`） |
| `src/pages/trip/TripHeaderMagazine.tsx` | 同上 |
| `src/pages/trip/TripHeaderPostcard.tsx` | 同上 |
| `src/pages/trip/TripHeaderMinimal.tsx` | 同上 |
| `src/pages/new-trip/index.tsx` | 删除 `AIPlanForm` 分支：只保留 `AIInterview`；"AI 帮我规划"按钮 → `setInterviewOpen(true)` |
| `src/pages/me/index.tsx` | `me-theme-thumb--{name}` div 改为 `<Image src={...}>` |
| `src/pages/me/index.scss` | 删除 4 个 `.me-theme-thumb--xxx` 颜色规则；保留 `.me-theme-thumb` 几何尺寸（让 Image 充满） |
| `src/app.config.ts` | 移除 `'pages/preview/index'` |

### 新增

| 路径 | 责任 |
| --- | --- |
| `src/assets/theme-preview/tegami.svg` | 200×260 抽象缩略图：3 张错位卡片 + 暖橘色块 |
| `src/assets/theme-preview/magazine.svg` | 粗线刊头 + 红色色块 + 黑色目录 |
| `src/assets/theme-preview/postcard.svg` | 椭圆盖戳 3 枚 + 牛皮纸纹 |
| `src/assets/theme-preview/minimal.svg` | 3 条 hairline + 极小数字 |

### 删除

| 路径 | 备注 |
| --- | --- |
| `src/components/AIPlanForm/index.tsx` | 已被 `AIInterview` 替代 |
| `src/components/AIPlanForm/index.scss` | 同上 |
| `src/components/AILoadingBar/index.tsx` | 已被 `AILoadingTheater` + `TripAIStatusBar` 替代 |
| `src/components/AILoadingBar/index.scss` | 同上 |
| `src/pages/preview/index.tsx` | 组件预览页，spec § 9.5 收尾删除 |
| `src/pages/preview/index.scss` | 同上 |
| `src/pages/preview/index.config.ts` | 同上 |
| `src/pages/preview/cover/` | 预览页用过的静态素材（若 grep 后无其他引用一并删；本 plan Task 8 校验） |

---

## Task 0: 基线确认

**Files:** 仅验证（git + dev:weapp）

- [ ] **Step 1: git 状态干净**

Run: `git status`
Expected: 工作区干净（除可能的未追踪 `src/assets/cover/default-cover.jpg` —— gitStatus 显示该文件被修改，本任务不动它）

Run: `git log --oneline -10`
Expected: `feat: phase4e 完成` / `feat: phase4d 完成` / `feat: phase4c 完成` 等条目在前

如果 Phase 4c/4d/4e 还没合并 → **停止**，回去执行未完成的 phase。

- [ ] **Step 2: 启动 dev:weapp，确认四主题首页/trip 页/me 页正常**

Run: `npm run dev:weapp`
Expected: webpack watch 编译通过，无 type error。

打开微信开发者工具加载 `dist`，进入：
- 首页 → 切 4 主题 → 视觉无报错
- 任意 trip → header 显示 AIBadge（compact）→ 切 4 主题正常
- 我的页 → 主题区显示 4 张"占位色块"缩略图（本 plan 后会换 SVG）

- [ ] **Step 3: 检查待删组件的全量引用**

Run:
```bash
grep -rn "AIPlanForm\|AILoadingBar" src --include="*.tsx" --include="*.ts" --include="*.scss"
```

Expected（基线引用清单，本 plan 应全部清理掉）：
- `src/pages/new-trip/index.tsx` 第 7、148 行（AIPlanForm）
- `src/pages/trip/index.tsx` 第 14、160、306 行（AIPlanForm + clearAIPlanFormDraft）
- `src/pages/trip/TripHeaderTegami.tsx` / `TripHeaderMagazine.tsx` / `TripHeaderPostcard.tsx` / `TripHeaderMinimal.tsx` 各 2 处（AILoadingBar）

记下结果，作为 Task 7 验收对照。

- [ ] **Step 4: 检查 `pages/preview/` 唯一性**

Run:
```bash
grep -rn "pages/preview\|'../preview\|/preview/index" src --include="*.tsx" --include="*.ts" --include="*.json" --include="*.config.ts"
```

Expected: 命中应仅在 `src/app.config.ts`、`src/pages/preview/index.config.ts`、`src/pages/preview/index.tsx` 内部。若有其他业务页通过 `navigateTo('/pages/preview/...')` 跳转 → 停止本 plan，重新评估。

---

## Task 1: 主题预览缩略图 SVG 资源

**Files:**
- Create: `src/assets/theme-preview/tegami.svg`
- Create: `src/assets/theme-preview/magazine.svg`
- Create: `src/assets/theme-preview/postcard.svg`
- Create: `src/assets/theme-preview/minimal.svg`

> 说明：每张 SVG 200×260 viewBox，纯静态形状，不依赖外部字体。直接画法，颜色硬编码（这里是固定缩略图素材，不需要主题 token）。

- [ ] **Step 1: tegami.svg**

Create `src/assets/theme-preview/tegami.svg`：

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260">
  <rect width="200" height="260" fill="#FFF7EC"/>
  <!-- 暖橘色块（左上） -->
  <rect x="14" y="18" width="54" height="32" rx="6" fill="#FF9A4D"/>
  <rect x="14" y="56" width="38" height="6" rx="2" fill="#E68A45" opacity="0.6"/>
  <!-- 卡片 1（最底） -->
  <rect x="34" y="88" width="132" height="60" rx="10" fill="#FFFFFF" stroke="#E6D6BA" stroke-width="1.5" transform="rotate(-3 100 118)"/>
  <line x1="48" y1="108" x2="148" y2="108" stroke="#E0CFA8" stroke-width="1.2" transform="rotate(-3 100 118)"/>
  <line x1="48" y1="120" x2="120" y2="120" stroke="#E0CFA8" stroke-width="1.2" transform="rotate(-3 100 118)"/>
  <!-- 卡片 2（中间） -->
  <rect x="30" y="118" width="138" height="62" rx="10" fill="#FFFFFF" stroke="#E6D6BA" stroke-width="1.5" transform="rotate(2 100 149)"/>
  <line x1="44" y1="138" x2="154" y2="138" stroke="#E0CFA8" stroke-width="1.2" transform="rotate(2 100 149)"/>
  <line x1="44" y1="150" x2="128" y2="150" stroke="#E0CFA8" stroke-width="1.2" transform="rotate(2 100 149)"/>
  <!-- 卡片 3（最上） -->
  <rect x="36" y="152" width="128" height="60" rx="10" fill="#FFFFFF" stroke="#E6D6BA" stroke-width="1.5"/>
  <circle cx="52" cy="170" r="8" fill="#FF9A4D"/>
  <line x1="68" y1="170" x2="146" y2="170" stroke="#C9B58E" stroke-width="1.2"/>
  <line x1="68" y1="182" x2="130" y2="182" stroke="#C9B58E" stroke-width="1.2"/>
  <!-- 底注 -->
  <text x="100" y="240" font-family="serif" font-size="10" fill="#8B7250" text-anchor="middle" letter-spacing="3">TEGAMI</text>
</svg>
```

- [ ] **Step 2: magazine.svg**

Create `src/assets/theme-preview/magazine.svg`：

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260">
  <rect width="200" height="260" fill="#F4F0E8"/>
  <!-- 双线刊头 -->
  <line x1="14" y1="20" x2="186" y2="20" stroke="#111" stroke-width="2"/>
  <text x="14" y="40" font-family="serif" font-weight="900" font-size="22" fill="#111" letter-spacing="2">XING/CE</text>
  <line x1="14" y1="50" x2="186" y2="50" stroke="#111" stroke-width="0.8"/>
  <!-- 红色色块 -->
  <rect x="14" y="64" width="172" height="80" fill="#D62E2E"/>
  <text x="22" y="106" font-family="serif" font-size="14" font-weight="700" fill="#FFFFFF" letter-spacing="2">ISSUE 01</text>
  <text x="22" y="128" font-family="serif" font-size="10" fill="#FFFFFF" letter-spacing="3" opacity="0.85">FEATURE / TRAVEL</text>
  <!-- 目录 -->
  <line x1="14" y1="158" x2="186" y2="158" stroke="#111" stroke-width="0.6"/>
  <text x="14" y="174" font-family="serif" font-size="10" fill="#111" letter-spacing="2">01 · 行 程</text>
  <text x="186" y="174" font-family="monospace" font-size="10" fill="#111" text-anchor="end">P.02</text>
  <line x1="14" y1="180" x2="186" y2="180" stroke="#111" stroke-width="0.4" opacity="0.5"/>
  <text x="14" y="196" font-family="serif" font-size="10" fill="#111" letter-spacing="2">02 · 开 销</text>
  <text x="186" y="196" font-family="monospace" font-size="10" fill="#111" text-anchor="end">P.08</text>
  <line x1="14" y1="202" x2="186" y2="202" stroke="#111" stroke-width="0.4" opacity="0.5"/>
  <text x="14" y="218" font-family="serif" font-size="10" fill="#111" letter-spacing="2">03 · 行 装</text>
  <text x="186" y="218" font-family="monospace" font-size="10" fill="#111" text-anchor="end">P.14</text>
  <!-- 底注 -->
  <text x="100" y="244" font-family="serif" font-size="10" fill="#444" text-anchor="middle" letter-spacing="3">MAGAZINE</text>
</svg>
```

- [ ] **Step 3: postcard.svg**

Create `src/assets/theme-preview/postcard.svg`：

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260">
  <!-- 牛皮纸纹底 -->
  <rect width="200" height="260" fill="#EFE6D5"/>
  <g opacity="0.18" fill="#9C7A4A">
    <rect x="0"  y="0"   width="200" height="2"/>
    <rect x="0"  y="40"  width="200" height="2"/>
    <rect x="0"  y="80"  width="200" height="2"/>
    <rect x="0"  y="120" width="200" height="2"/>
    <rect x="0"  y="160" width="200" height="2"/>
    <rect x="0"  y="200" width="200" height="2"/>
    <rect x="0"  y="240" width="200" height="2"/>
  </g>
  <!-- 上方虚线 -->
  <line x1="14" y1="24" x2="186" y2="24" stroke="#7C5E33" stroke-width="0.8" stroke-dasharray="3 3"/>
  <text x="14" y="42" font-family="serif" font-size="10" fill="#7C5E33" letter-spacing="4">POSTCARD · 2026</text>
  <!-- 椭圆戳 1 -->
  <g transform="translate(50 100) rotate(-8)">
    <ellipse cx="0" cy="0" rx="32" ry="22" fill="none" stroke="#7C5E33" stroke-width="2"/>
    <text font-family="serif" font-size="10" fill="#7C5E33" text-anchor="middle" dy="-2">入境</text>
    <text font-family="monospace" font-size="7" fill="#7C5E33" text-anchor="middle" dy="10" letter-spacing="2">10.01</text>
  </g>
  <!-- 椭圆戳 2 -->
  <g transform="translate(120 130) rotate(6)">
    <ellipse cx="0" cy="0" rx="34" ry="22" fill="none" stroke="#9C7A4A" stroke-width="2"/>
    <text font-family="serif" font-size="10" fill="#9C7A4A" text-anchor="middle" dy="-2">游览</text>
    <text font-family="monospace" font-size="7" fill="#9C7A4A" text-anchor="middle" dy="10" letter-spacing="2">10.03</text>
  </g>
  <!-- 椭圆戳 3 -->
  <g transform="translate(70 180) rotate(-3)">
    <ellipse cx="0" cy="0" rx="32" ry="20" fill="none" stroke="#7C5E33" stroke-width="2"/>
    <text font-family="serif" font-size="10" fill="#7C5E33" text-anchor="middle" dy="-2">归途</text>
    <text font-family="monospace" font-size="7" fill="#7C5E33" text-anchor="middle" dy="10" letter-spacing="2">10.07</text>
  </g>
  <!-- 下方虚线 -->
  <line x1="14" y1="226" x2="186" y2="226" stroke="#7C5E33" stroke-width="0.8" stroke-dasharray="3 3"/>
  <text x="100" y="244" font-family="serif" font-size="10" fill="#7C5E33" text-anchor="middle" letter-spacing="3">POSTCARD</text>
</svg>
```

- [ ] **Step 4: minimal.svg**

Create `src/assets/theme-preview/minimal.svg`：

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260">
  <rect width="200" height="260" fill="#FAFAF8"/>
  <!-- eyebrow -->
  <text x="20" y="40" font-family="monospace" font-size="8" fill="#888" letter-spacing="6">XING CE · 2026</text>
  <!-- 3 极小数字 -->
  <text x="20" y="78" font-family="serif" font-weight="700" font-size="22" fill="#111">04</text>
  <text x="20" y="98" font-family="monospace" font-size="8" fill="#888" letter-spacing="3">天</text>
  <text x="86" y="78" font-family="serif" font-weight="700" font-size="22" fill="#111">¥3,840</text>
  <text x="86" y="98" font-family="monospace" font-size="8" fill="#888" letter-spacing="3">人均</text>
  <!-- 3 条 hairline 行 -->
  <line x1="20" y1="130" x2="180" y2="130" stroke="#DDD" stroke-width="0.6"/>
  <text x="20" y="148" font-family="serif" font-size="11" fill="#111">01 · 行程</text>
  <text x="180" y="148" font-family="monospace" font-size="9" fill="#888" text-anchor="end">P.02</text>
  <line x1="20" y1="160" x2="180" y2="160" stroke="#DDD" stroke-width="0.6"/>
  <text x="20" y="178" font-family="serif" font-size="11" fill="#111">02 · 开销</text>
  <text x="180" y="178" font-family="monospace" font-size="9" fill="#888" text-anchor="end">P.08</text>
  <line x1="20" y1="190" x2="180" y2="190" stroke="#DDD" stroke-width="0.6"/>
  <text x="20" y="208" font-family="serif" font-size="11" fill="#111">03 · 行装</text>
  <text x="180" y="208" font-family="monospace" font-size="9" fill="#888" text-anchor="end">P.14</text>
  <line x1="20" y1="220" x2="180" y2="220" stroke="#DDD" stroke-width="0.6"/>
  <!-- 底注 -->
  <text x="100" y="244" font-family="monospace" font-size="9" fill="#888" text-anchor="middle" letter-spacing="6">MINIMAL</text>
</svg>
```

- [ ] **Step 5: 验证 SVG 大小**

Run: `wc -c src/assets/theme-preview/*.svg`
Expected: 每个 < 4KB（缩略图素材，远低于 spec § 5.1.1 的 200KB 上限）

- [ ] **Step 6: Commit**

```bash
git add src/assets/theme-preview/
git commit -m "feat(theme): 4 主题预览缩略图 SVG 资源"
```

---

## Task 2: "我的"页接入主题缩略图

**Files:**
- Modify: `src/pages/me/index.tsx`
- Modify: `src/pages/me/index.scss`

- [ ] **Step 1: 替换缩略图 DOM**

Edit `src/pages/me/index.tsx`：

把顶部 import 中加入：

```typescript
import { Image, View, Text } from '@tarojs/components'
import tegamiThumb   from '../../assets/theme-preview/tegami.svg'
import magazineThumb from '../../assets/theme-preview/magazine.svg'
import postcardThumb from '../../assets/theme-preview/postcard.svg'
import minimalThumb  from '../../assets/theme-preview/minimal.svg'
```

> 注意：把原来的 `import { View, Text } from '@tarojs/components'` 整行替换为上面带 `Image` 的版本，不要重复 import。

在 `THEME_LABELS` 常量下方新增映射：

```typescript
const THEME_THUMB: Record<ThemeName, string> = {
  tegami: tegamiThumb,
  magazine: magazineThumb,
  postcard: postcardThumb,
  minimal: minimalThumb,
}
```

把渲染中：

```typescript
<View className={`me-theme-thumb me-theme-thumb--${name}`} />
```

替换为：

```typescript
<Image
  className='me-theme-thumb'
  src={THEME_THUMB[name]}
  mode='aspectFill'
/>
```

- [ ] **Step 2: 清理 SCSS 多余规则**

Edit `src/pages/me/index.scss`，删除以下 4 行（含整行）：

```scss
.me-theme-thumb--tegami   { background: linear-gradient(135deg, #FFE9D1, #FF9A4D); }
.me-theme-thumb--magazine { background: linear-gradient(180deg, #F4F0E8 0%, #F4F0E8 60%, #D62E2E 60%, #D62E2E 100%); }
.me-theme-thumb--postcard { background: repeating-linear-gradient(45deg, #EFE6D5 0 16rpx, #D7C4A0 16rpx 18rpx); }
.me-theme-thumb--minimal  { background: #FAFAF8; border: 2rpx solid var(--line); }
```

确保 `.me-theme-thumb { ... }` 自身规则保留（控制 aspect / 边角）；如其中含 `background:` 默认色，移除该行；其余几何尺寸/`overflow:hidden`/`border-radius` 等保持不变。

> 验证：Read 当前文件，确认 `.me-theme-thumb` 块包含 `width / height / border-radius / overflow: hidden`；如果缺 `overflow: hidden` 则补一行（防止 Image aspectFill 溢出圆角）。

- [ ] **Step 3: 编译验证**

watch 自动重编。

Run: 查看 watch 进程输出
Expected: 无 SCSS 错误、无 TS 错误（webpack `:errors` 为 0）

打开微信开发者工具 → 我的页 → 应看到 4 张 SVG 缩略图，每张 200×260 5:6.5 比例无变形。

- [ ] **Step 4: Commit**

```bash
git add src/pages/me/index.tsx src/pages/me/index.scss
git commit -m "feat(me): 主题卡使用 SVG 缩略图替换 CSS 占位"
```

---

## Task 3: TripHeader 四主题移除 AILoadingBar

**Files:**
- Modify: `src/pages/trip/TripHeaderTegami.tsx`
- Modify: `src/pages/trip/TripHeaderMagazine.tsx`
- Modify: `src/pages/trip/TripHeaderPostcard.tsx`
- Modify: `src/pages/trip/TripHeaderMinimal.tsx`

> 理由：AI 进度条从 header 的内嵌 mini bar，换成全屏 `AILoadingTheater` + 最小化态 `TripAIStatusBar`（在 trip 页 header 外渲染）。Header 不再承载 AI 进度可视化。

- [ ] **Step 1: TripHeaderTegami.tsx**

Edit `src/pages/trip/TripHeaderTegami.tsx`：

删除 import：

```typescript
import AILoadingBar from '../../components/AILoadingBar'
```

删除以下整段：

```typescript
{isOwner && aiStatus && (
  <View className='thtg-ai-bar'>
    <AILoadingBar
      status={aiStatus as 'generating' | 'ready' | 'error'}
      onTap={onAIBarTap}
    />
  </View>
)}
```

- [ ] **Step 2: TripHeaderMagazine.tsx**

Edit `src/pages/trip/TripHeaderMagazine.tsx`：

删除 `import AILoadingBar ...` 行；删除包裹 `AILoadingBar` 的 `{isOwner && aiStatus && (...)}` 整段（参考第 58 行附近，结构与 Tegami 同形，包裹 div 类名为 `.thmg-ai-bar` 或类似 magazine 前缀，按当前文件实际类名删整段）。

- [ ] **Step 3: TripHeaderPostcard.tsx**

Edit `src/pages/trip/TripHeaderPostcard.tsx`：删除 import 与包裹段（参考第 78 行附近，包裹 div 类名为 `.thpp-ai-bar` 或类似 postcard 前缀）。

- [ ] **Step 4: TripHeaderMinimal.tsx**

Edit `src/pages/trip/TripHeaderMinimal.tsx`：删除 import 与包裹段（参考第 53 行附近，包裹 div 类名为 `.thmin-ai-bar` 或类似 minimal 前缀）。

- [ ] **Step 5: 验证 4 个文件**

Run:
```bash
grep -n "AILoadingBar" src/pages/trip/TripHeader*.tsx
```
Expected: 0 命中

Run:
```bash
grep -n "onAIBarTap" src/pages/trip/TripHeader*.tsx
```
Expected: 仍命中（这是 props 字段，shared-header.ts 仍定义 + 父级仍传，但 4 个 header 内部已不消费）

> `onAIBarTap` prop 在 shared-header.ts 中保留：trip 页父级仍需要 `handleBarTap` 函数（移给 TripAIStatusBar 的 onTap 使用，逻辑接管"重新展开 Theater"）。Header 不再消费这个 prop，但保留接口避免破坏 type；Task 4 中我们也不会修改 shared-header.ts。

- [ ] **Step 6: 编译验证**

watch 自动重编。
Expected: 0 TS / SCSS error。原来 4 个 header 的 ai-bar 段消失，只剩 AIBadge。

- [ ] **Step 7: Commit**

```bash
git add src/pages/trip/TripHeaderTegami.tsx src/pages/trip/TripHeaderMagazine.tsx src/pages/trip/TripHeaderPostcard.tsx src/pages/trip/TripHeaderMinimal.tsx
git commit -m "refactor(trip): 4 主题 header 移除 AILoadingBar 渲染"
```

---

## Task 4: trip 页 AI 流编排重写

**Files:**
- Modify: `src/pages/trip/index.tsx`

> 改动总结：
> 1. `AIPlanForm` → `AIInterview`
> 2. 新增 `theaterMinimized` 本地 state（默认 false）
> 3. `handleBarTap` 简化：generating → `setTheaterMinimized(false)` 即展开 Theater；ready/error 与旧逻辑同
> 4. 渲染段新增 `<AILoadingTheater/>` 与 `<TripAIStatusBar/>`
> 5. 删除 `clearAIPlanFormDraft` import 和调用（草稿现由 `AIInterview` 自管理，spec § 6.1.3 列为不再需要）

- [ ] **Step 1: 替换 imports**

Edit `src/pages/trip/index.tsx`，把：

```typescript
import AIPlanForm, { clearAIPlanFormDraft } from '../../components/AIPlanForm'
```

替换为：

```typescript
import AIInterview from '../../components/AIInterview'
import AILoadingTheater from '../../components/AILoadingTheater'
import TripAIStatusBar from '../../components/TripAIStatusBar'
```

- [ ] **Step 2: 新增 state**

在 `TripBody` 函数体的 state 声明区（紧挨 `aiPreviewOpen` 那行下方）插入：

```typescript
const [theaterMinimized, setTheaterMinimized] = useState(false)
```

- [ ] **Step 3: 重写 handleBarTap**

把现有 `handleBarTap` 函数体替换为：

```typescript
  const handleBarTap = async () => {
    if (!t || !isOwner) return
    if (t.aiStatus === 'generating') {
      // StatusBar 点击 → 重新展开 Theater
      setTheaterMinimized(false)
    } else if (t.aiStatus === 'ready') {
      setAiPreviewOpen(true)
    } else if (t.aiStatus === 'error') {
      setAiFormOpen(true)
    }
  }
```

> 说明：spec § 8.4.3 「停止生成」走 `AILoadingTheater` 的 onCancel，不再走 bar 点击；bar 点击仅做"展开 Theater"。

- [ ] **Step 4: 新增 Theater 回调**

在 `handleAiButtonTap` 函数下方插入两个新函数：

```typescript
  const handleTheaterCancel = async () => {
    const res = await Taro.showModal({
      title: '停止 AI 生成?',
      content: '已生成的部分会被舍弃, 后台运行的剩余轮次也会终止',
      confirmText: '停止',
      confirmColor: '#c43d3d',
    })
    if (res.confirm) {
      await clearAiFields()
      setTheaterMinimized(false)
    }
  }

  const handleTheaterMinimize = () => {
    setTheaterMinimized(true)
  }
```

> 说明：把旧 `handleBarTap` 中的 showModal 停止确认逻辑挪到了 Theater 的 onCancel，因为 spec 把"停止生成"按钮搬到了 Theater 内部。

- [ ] **Step 5: 调整 triggerAiTask（重置 minimize 态）**

在 `triggerAiTask` 函数体内 `setAiFormOpen(false)` 之后插入一行：

```typescript
    setTheaterMinimized(false)
```

> 理由：用户重新触发 AI 时，无论之前 Theater 是不是最小化的，都要回到全屏态。

- [ ] **Step 6: 移除 clearAIPlanFormDraft 调用**

定位 `handlePreviewApply` 内的：

```typescript
      clearAIPlanFormDraft()
```

删除该行（连同前后空白行多余的部分，保留缩进结构）。

- [ ] **Step 7: 重写渲染段中的 AIPlanForm**

定位渲染段（约第 306 行）：

```typescript
      <AIPlanForm
        open={aiFormOpen}
        onClose={() => setAiFormOpen(false)}
        onSubmit={triggerAiTask}
      />
```

替换为：

```typescript
      <AIInterview
        open={aiFormOpen}
        onClose={() => setAiFormOpen(false)}
        onSubmit={(prefs) => {
          setAiFormOpen(false)
          void triggerAiTask(prefs)
        }}
      />
      <AILoadingTheater
        open={t.aiStatus === 'generating' && !theaterMinimized}
        status='thinking'
        onCancel={handleTheaterCancel}
        onMinimize={handleTheaterMinimize}
      />
      <TripAIStatusBar
        open={t.aiStatus === 'generating' && theaterMinimized}
        onTap={() => setTheaterMinimized(false)}
      />
```

> 关于 Theater 的 status：当前 spec 流只在 'generating' 时显示 Theater，所以可固定传 `'thinking'`；'ready' 态由 useEffect 自动转 Preview，'error' 走 form 重弹（handleBarTap 已分支）。如果未来想让 Theater 显示 ready/error 的 orb，把这行改成 `status={t.aiStatus === 'ready' ? 'ready' : t.aiStatus === 'error' ? 'error' : 'thinking'}` 即可，本 plan 不做。

- [ ] **Step 8: 验证 import / 引用**

Run:
```bash
grep -n "AIPlanForm\|clearAIPlanFormDraft\|AILoadingBar" src/pages/trip/index.tsx
```
Expected: 0 命中

Run:
```bash
grep -n "AIInterview\|AILoadingTheater\|TripAIStatusBar" src/pages/trip/index.tsx
```
Expected: 各 1-2 命中（import + 渲染）

- [ ] **Step 9: 编译验证**

watch 自动重编。
Expected: 0 TS / SCSS error。

打开微信开发者工具进入 trip 页（任何已有 trip）：
- 点 header 右上 AIBadge → 应弹出 `AIInterview` 采访 sheet（多步问答）
- 完成采访 → 自动关闭 sheet → 出现全屏 `AILoadingTheater` mask（orb 三环 + 滚动文案）
- 点 Theater 右上 × → mask 消失 → header 下方出现 `TripAIStatusBar`（一行 shine + dots + 文案"AI 正在为你编排 · 点击展开"）
- 点 StatusBar → 重新弹出 Theater
- 点 Theater 底部"停止生成" → showModal → 确认 → mask 消失 → StatusBar 也消失（aiStatus 被清空）
- 等 AI 完成后 → 自动弹 AIPlanPreview（旧 useEffect 仍生效）

如果有任一项不符 → 回头核对该 Step 改动。

- [ ] **Step 10: Commit**

```bash
git add src/pages/trip/index.tsx
git commit -m "feat(trip): AI 流接入 AIInterview/AILoadingTheater/TripAIStatusBar"
```

---

## Task 5: new-trip 页清理 AIPlanForm

**Files:**
- Modify: `src/pages/new-trip/index.tsx`

> 现状：当前文件同时引用 `AIPlanForm`（按钮触发）和 `AIInterview`（URL `?openAI=1` 触发），是过渡期遗留。本 task 把按钮也切到 `AIInterview`，并删除 `AIPlanForm`。

- [ ] **Step 1: 移除 AIPlanForm import 和 state**

Edit `src/pages/new-trip/index.tsx`：

删除 import：

```typescript
import AIPlanForm from '../../components/AIPlanForm'
```

删除 state：

```typescript
  const [aiFormOpen, setAiFormOpen] = useState(false)
```

- [ ] **Step 2: 调整按钮 onClick**

把：

```typescript
        <Button className='nt-submit-ai' disabled={!canSubmit} onClick={() => setAiFormOpen(true)}>
          ✨ AI 帮我规划
        </Button>
```

替换为：

```typescript
        <Button className='nt-submit-ai' disabled={!canSubmit} onClick={() => setInterviewOpen(true)}>
          ✨ AI 帮我规划
        </Button>
```

- [ ] **Step 3: 删除 AIPlanForm 渲染段**

删除：

```typescript
      <AIPlanForm
        open={aiFormOpen}
        onClose={() => setAiFormOpen(false)}
        onSubmit={handleAiSubmit}
      />
```

`AIInterview` 渲染段保留不变。

- [ ] **Step 4: 调整 handleAiSubmit 内 setAiFormOpen 引用**

定位 `handleAiSubmit` 函数体内：

```typescript
    setAiFormOpen(false)
```

替换为：

```typescript
    setInterviewOpen(false)
```

> 这一步是为了清除函数体内对已删除 state 的引用；`AIInterview` 已通过 `onSubmit` 内回调 `setInterviewOpen(false)` 关闭过，但保留一次冗余设置无害且更稳。

- [ ] **Step 5: 验证**

Run:
```bash
grep -n "AIPlanForm\|aiFormOpen\b" src/pages/new-trip/index.tsx
```
Expected: 0 命中

Run:
```bash
grep -n "AIInterview\|interviewOpen" src/pages/new-trip/index.tsx
```
Expected: 命中 import / state / 按钮 / 渲染段，共 4-5 处

- [ ] **Step 6: 编译验证**

watch 自动重编。
Expected: 0 TS / SCSS error。

打开微信开发者工具 → 新建攻略页：
- 填表 → 点"✨ AI 帮我规划" → 弹出 `AIInterview` 采访 sheet
- 完成采访 → showLoading"准备中..." → 跳回首页 → 看到新 trip 卡处于 generating 态
- 单独验证 URL 路径：首页底部"让 AI 帮你规划"（`onAITrip` → `navigateTo('/pages/new-trip/index?openAI=1')`）→ 进入 new-trip 页 → useEffect 触发 `setInterviewOpen(true)` → 直接弹采访

- [ ] **Step 7: Commit**

```bash
git add src/pages/new-trip/index.tsx
git commit -m "refactor(new-trip): 删除 AIPlanForm，AI 入口统一走 AIInterview"
```

---

## Task 6: 移除 preview 路由

**Files:**
- Modify: `src/app.config.ts`

- [ ] **Step 1: 删路由**

Edit `src/app.config.ts`，把：

```typescript
export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/new-trip/index',
    'pages/trip/index',
    'pages/share/index',
    'pages/me/index',
    'pages/preview/index',
  ],
```

替换为：

```typescript
export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/new-trip/index',
    'pages/trip/index',
    'pages/share/index',
    'pages/me/index',
  ],
```

- [ ] **Step 2: 编译验证**

watch 自动重编（Taro 修改 app.config 会重启）。
Expected: 0 error。

打开微信开发者工具 → 验证：
- 首页/新建/trip/分享/我的 5 个入口均能进入
- preview 页应已经从开发者工具的"页面路径"下拉消失

- [ ] **Step 3: Commit**

```bash
git add src/app.config.ts
git commit -m "chore: 从 app.config 移除 preview 页路由"
```

---

## Task 7: 删除旧组件 + preview 页文件

**Files:**
- Delete: `src/components/AIPlanForm/index.tsx`
- Delete: `src/components/AIPlanForm/index.scss`
- Delete: `src/components/AILoadingBar/index.tsx`
- Delete: `src/components/AILoadingBar/index.scss`
- Delete: `src/pages/preview/` 整目录

- [ ] **Step 1: 二次确认无引用**

Run:
```bash
grep -rn "AIPlanForm\|AILoadingBar" src --include="*.tsx" --include="*.ts" --include="*.scss"
```
Expected: 0 命中

Run:
```bash
grep -rn "pages/preview" src --include="*.tsx" --include="*.ts" --include="*.config.ts" --include="*.json"
```
Expected: 0 命中

如有命中 → 停止删除，回到对应 Task 修复遗漏。

- [ ] **Step 2: 删除组件目录**

Run:
```bash
rm -rf src/components/AIPlanForm src/components/AILoadingBar
```

- [ ] **Step 3: 删除 preview 页目录**

Run:
```bash
rm -rf src/pages/preview
```

- [ ] **Step 4: 编译验证**

watch 自动重编（删除文件后 webpack 会刷新依赖图）。
Expected: 0 error。如出现 "Module not found" → grep 该模块路径，处理遗漏的 import。

- [ ] **Step 5: Commit**

```bash
git add -A src/components src/pages
git commit -m "chore: 删除旧 AIPlanForm/AILoadingBar 组件与 preview 示例页"
```

---

## Task 8: spec § 10.5 五分支冒烟矩阵

**Files:** 仅验证

> 全部在微信开发者工具上手工跑。每条对照 spec § 10.5 的描述。

- [ ] **Step 1: 分支 A · 首页入口完整流**

操作：首页底部「让 AI 帮你规划」→ 跳 new-trip → URL param `openAI=1` 自动弹 `AIInterview` → 完成采访 → `handleAiSubmit` → 回到首页 → 新 trip 卡显示 `HomeCardAIRow status='thinking'`

Expected:
- new-trip 页采访 sheet 弹出且步骤完整
- 首页卡片显示带 shine 的"AI 正在为你编排"行（HomeCardAIRow 视觉）
- 5 秒轮询触发 trips 重新拉取，aiStatus 字段更新

操作：在生成中点击该 trip 卡

Expected:
- 进入 trip 页 → 立即看到全屏 `AILoadingTheater`（orb 三环 + 滚动文案）

- [ ] **Step 2: 分支 B · trip 页 AIBadge 直接触发**

操作：进入任意无 AI 状态的 trip → 点 header AIBadge

Expected:
- 弹 `AIInterview`
- 完成采访后 trip 页直接出现全屏 Theater，**不**跳页面

- [ ] **Step 3: 分支 C · 「×」最小化 / StatusBar**

操作：Theater 打开时点右上「×」

Expected:
- Theater 消失
- TripAIStatusBar 立刻在 header 下方出现（与 trip header 颜色协调）

操作：点 StatusBar

Expected:
- Theater 重新展开
- 任务**仍在后台运行**（云函数继续；DB 字段 aiTaskId 不变）

- [ ] **Step 4: 分支 D · 「停止生成」**

操作：Theater 打开时点底部"停止生成" → modal 确认

Expected:
- modal 弹起
- 确认后 Theater 消失、TripAIStatusBar 也不再渲染（aiStatus 被清空）
- trip 数据回到无 AI 状态；header AIBadge 重新出现可再次触发

- [ ] **Step 5: 分支 E · ready 自动弹 Preview**

操作：触发 AI（trip 页入口）→ 等待真实云函数完成

Expected:
- aiStatus 变 'ready' 后：Theater 自动关闭 + StatusBar 不出现 + `AIPlanPreview` 自动弹起（沿用既有 useEffect storage key 机制）
- 应用 / 舍弃后 ai* 字段全部清空

- [ ] **Step 6: 真机回归（spec § 10.6）**

H5 build：

```bash
npm run build:h5
```

打开 `dist/index.html` 本地 server 跑一次 5 分支冒烟（H5 上 AILoadingTheater 的 mask 与 SVG 显示需正常）。

> H5 上的 Image 组件对本地 SVG 的 import 支持依赖 Taro 4.2 webpack loader 默认行为：通常 svg import 默认拿到 dataURL 或 publicPath URL；若 H5 上图片不显示，最稳兜底是把 4 张 SVG 改放到 `src/assets/theme-preview/` 的同时同名 export 一份 base64 字符串（本 plan 不预留这一步；问题出现时再处理）。

微信小程序：通过开发者工具的"真机调试"在 iOS / Android 各跑一次分支 A + B。

- [ ] **Step 7: console.log 残留检查（spec § 10.7）**

Run:
```bash
grep -rn "console\.log" src --include="*.tsx" --include="*.ts" | grep -v "console\.error\|console\.warn"
```
Expected: 0 命中。如有遗留是历史负担、不属本 plan 引入，记录到下一轮清理。

---

## Task 9: 收尾

- [ ] **Step 1: 旧组件零引用最终断言**

Run:
```bash
grep -rn "AIPlanForm\|AILoadingBar\|clearAIPlanFormDraft\|pages/preview" src --include="*.tsx" --include="*.ts" --include="*.scss" --include="*.json" --include="*.config.ts"
```
Expected: 0 命中

- [ ] **Step 2: Push**

```bash
git log --oneline -10
git push
```

Expected:
- 看到 Task 1–7 的 7 个 commit（Task 0 / 8 / 9 不产生新 commit）
- push 成功

---

## Self-Review

### 1. Spec 覆盖

| Spec 条目 | 实现位置 |
| --- | --- |
| § 5.2 主题预览缩略图 SVG（200×260，4 张） | Task 1 + Task 2 |
| § 6.1.3 `AIInterview` 替换 `AIPlanForm` | Task 4（trip 页）+ Task 5（new-trip 页） |
| § 6.1.4 `AILoadingTheater` 接入（开 / × 最小化 / 停止） | Task 4 |
| § 6.1.9 `TripAIStatusBar` 接入（最小化态） | Task 4 |
| § 6.3.1 删除旧 `AIPlanForm` | Task 7 |
| § 6.2.1 注：`AILoadingBar` 已被 `HomeCardAIRow` 替代（仅 Home 用），trip header 中残留的 AILoadingBar 删除 | Task 3 + Task 7 |
| § 8.4.1 入口 A 流程 | Task 8 Step 1（验证而非新代码 —— 既有路径已具备） |
| § 8.4.2 入口 B 流程 | Task 4 + Task 8 Step 2 |
| § 8.4.3 Theater 内部 操作（停止 / × / 自动转 Preview） | Task 4 Step 4 + Step 7 |
| § 8.4.4 首页 ready 卡 → trip 页不重弹 Theater | Task 8 Step 1 末段（验证），既有自动 Preview useEffect 已具备 |
| § 9.5 Phase 5 全部子项 | 见上述映射 |
| § 10.5 五分支验收 | Task 8 |
| § 10.7 console.log 残留 | Task 8 Step 7 |
| `pages/preview/` 收尾删除 | Task 6 + Task 7 |

**已识别的 spec 偏离**（影响小，已在 Architecture 段说明）：

- spec § 6.1.4 写 `AILoadingTheater` props 为 `{open, tripId, onCancel, onMinimize, onComplete}` 且组件内部订阅 `trip.aiStatus`。本 plan **保留**组件现有 dumb API `{open, status, onCancel, onMinimize}`：父级 trip 页（已订阅 trip-store）负责 open/status 判定与 ready 处理。
  - 理由：父级已经持有数据，组件无需重复订阅；组件保持可独立呈现（虽然 preview 页本 plan 删除，但 Storybook 风格的临时挂载场景仍可能复用）；不需要改动 Theater 自身代码，降低 Phase 5 风险面。
  - 影响：spec 验收点对应行为完全等价（'ready' → 自动转 Preview 由父级 useEffect 实现），无可见差异。

### 2. Placeholder 扫描

- 全部 SCSS / TSX 代码块均给出完整可粘贴内容。
- 无 "TBD" / "implement later" / "和上面类似"。
- `mode='aspectFill'` 等 Taro `Image` 行为为既有 API（无需说明）。
- 所有 grep 命令给出了具体 expected 命中范围。

### 3. 类型 / 命名一致性

- `theaterMinimized` 在 Task 4 全程使用；无其他名称。
- `handleTheaterCancel` / `handleTheaterMinimize` 在 Step 4 定义、Step 7 渲染时使用；命名一致。
- `setInterviewOpen` 在 new-trip 页 Step 2 / Step 4 中两处引用；命名一致（沿用既有 state）。
- `AILoadingTheater` 的 `status` prop 取值 `'thinking'`：与 `src/components/AILoadingTheater/index.tsx` 的 `TheaterStatus` 类型 `'thinking' | 'ready' | 'error'` 对齐。

### 4. 关键决策回顾

1. **不重构 `AILoadingTheater` 内部订阅** — 见 spec 偏离说明。代价是 spec 字面与代码字面不完全一致；收益是 Phase 5 改动量减半。
2. **Header 4 子组件保留 `onAIBarTap` prop（虽然内部不再消费）** — 避免触动 `shared-header.ts`；trip 页父级仍传 `handleBarTap`，由 `TripAIStatusBar` 的 onTap 间接消费。
3. **SVG 缩略图就地硬编码颜色而非 token** — 缩略图是"主题预览的缩略图"，本身要展示主题色，不应被当前激活主题的 token 漂移；4 个 SVG 的颜色对应 spec § 5.2.3 描述。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-27-phase5-ai-cleanup.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - 我每个 Task 派一个 fresh subagent，Task 之间双阶段 review，迭代快
**2. Inline Execution** - 当前 session 内顺序执行，每 2-3 task 一个 checkpoint review

**Which approach?**
