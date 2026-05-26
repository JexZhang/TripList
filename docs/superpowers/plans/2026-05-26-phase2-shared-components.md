# Phase 2 · 共享组件库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地后续 Phase 3–5 要消费的所有共享组件 —— `BrandLogo`（钤印）、`AIBadge`、`AIInterview`、`AILoadingTheater`、`TripAIStatusBar`、`HomeCardAIRow`、`ProfileForm`（从 ProfileSetupModal 抽出）。本 Phase **不修改任何业务页面**，所有组件用一个临时预览页 `/pages/preview/index` 验证。

**Architecture:** 纯展示组件 + 一个开发期预览页。预览页通过路由可达，每个组件按 status × theme 矩阵渲染；预览页在 Phase 5 收尾时移除。新组件全部依赖 Phase 1 的 `useThemeClass / useTheme`，颜色/圆角/字体由 token 漂移。

**Tech Stack:** Taro 4.x React + TypeScript + SCSS

**Spec:** [docs/superpowers/specs/2026-05-26-design-system-application-design.md](../specs/2026-05-26-design-system-application-design.md)（参见 § 6.1 组件清单、§ 8.4 AI 流）

**Prerequisite:** Phase 1 已合并（`useThemeClass`、`useTheme`、tokens.scss、animations.scss 可用）

**Testing reality:** 无单元测试框架；本项目只发布微信小程序。通过 `/pages/preview/index` 在微信开发者工具下肉眼走查全状态，不跑任何 H5 路径。

**冒烟环境约定：** 全程使用 `npm run dev:weapp`（watch 模式编译）+ 微信开发者工具打开项目根目录预览。Task 步骤中如出现 "冒烟/预览"，默认指此流程。`dev:weapp` watch 进程在所有 Task 期间保持运行；新增页面/组件由 watch 自动重编，微信开发者工具点「编译」刷新即可。

---

## File Structure

### 新增

| 路径 | 责任 |
| --- | --- |
| `src/components/BrandLogo/index.tsx` | 钤印（红方章 + 旁注） |
| `src/components/BrandLogo/index.scss` | 钤印样式 |
| `src/components/AIBadge/index.tsx` | AI 状态徽章（共用于 trip 顶部 + home 底部 CTA） |
| `src/components/AIBadge/index.scss` | shine/dots/gradient 动效 |
| `src/components/AIInterview/index.tsx` | 采访式分步 AI 表单 sheet |
| `src/components/AIInterview/index.scss` | sheet 动画 + chip/textarea 样式 |
| `src/data/ai-interview.ts` | 题库定义 |
| `src/components/AILoadingTheater/index.tsx` | 全屏 orb 加载动画 |
| `src/components/AILoadingTheater/index.scss` | orb 三环 + 取消/最小化按钮 |
| `src/components/TripAIStatusBar/index.tsx` | trip 页顶部 AI 状态条（最小化态） |
| `src/components/TripAIStatusBar/index.scss` | 状态条 shine + dots |
| `src/components/HomeCardAIRow/index.tsx` | home 卡内 AI 状态行（thinking/ready 两态） |
| `src/components/HomeCardAIRow/index.scss` | 卡内行样式 |
| `src/components/ProfileForm/index.tsx` | 个人资料编辑表单（头像 + 昵称 + 保存） |
| `src/pages/preview/index.tsx` | 开发期组件预览页 |
| `src/pages/preview/index.scss` | 预览页样式 |
| `src/pages/preview/index.config.ts` | 预览页配置 |

### 修改

| 路径 | 改动 |
| --- | --- |
| `src/components/ProfileSetupModal/index.tsx` | 把表单逻辑替换为 `<ProfileForm/>` 复用 |
| `src/pages/me/index.tsx` | 把内联表单替换为 `<ProfileForm/>` |
| `src/app.config.ts` | 注册 `pages/preview/index` |

### 不变（明确）

- `src/components/AILoadingBar/` — Phase 2 不动；Phase 5 删
- `src/components/AIPlanForm/` — Phase 2 不动；Phase 5 删
- `src/components/AIPlanPreview/` — 保留
- 所有业务页面 (`home / trip / new-trip / share`) 在 Phase 2 不动

---

## Task 0: 前置基线检查

- [ ] **Step 1: 确认 Phase 1 已合并且无遗留改动**

Run: `cd /Users/jinchi/Documents/行册 && git status && git log --oneline -5`
Expected: 工作树干净；最新若干 commit 含 Phase 1 的 "feat(theme)" / "feat(me)" / "feat(home): AvatarEntry"

- [ ] **Step 2: 确认 Phase 1 文件已就位**

Run: `ls src/styles/tokens.scss src/styles/animations.scss src/store/theme-store.tsx src/utils/theme-class.ts src/pages/me/index.tsx`
Expected: 5 个文件全部存在

- [ ] **Step 3: weapp dev 跑一次冒烟**

Run: `npm run dev:weapp`（保持 watch 运行，后续 Task 复用）
微信开发者工具 → 编译 → 首页头像入口 → 我的页 → 四主题切换可用。

---

## Task 1: 创建预览页骨架

**Files:**
- Create: `src/pages/preview/index.tsx`
- Create: `src/pages/preview/index.scss`
- Create: `src/pages/preview/index.config.ts`
- Modify: `src/app.config.ts`

> 先建预览页，后续每个组件 Task 直接挂到这里验证。

- [ ] **Step 1: 注册路由**

Edit `src/app.config.ts`，在 `pages` 数组末尾追加 `'pages/preview/index'`：

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

Create `src/pages/preview/index.config.ts`：

```typescript
export default definePageConfig({
  navigationBarTitleText: '组件预览',
})
```

- [ ] **Step 3: 创建 preview page 骨架**

Create `src/pages/preview/index.tsx`：

```typescript
import { View, Text } from '@tarojs/components'
import { useTheme, VALID_THEMES, type ThemeName } from '../../store/theme-store'
import { useThemeClass } from '../../utils/theme-class'
import './index.scss'

export default function Preview() {
  const cls = useThemeClass('preview')
  const { theme, setTheme } = useTheme()

  return (
    <View className={cls}>
      <View className='preview-theme-bar'>
        {VALID_THEMES.map((t: ThemeName) => (
          <View
            key={t}
            className={`preview-theme-chip ${theme === t ? 'on' : ''}`}
            onClick={() => setTheme(t)}
          >{t}</View>
        ))}
      </View>

      <View className='preview-section'>
        <Text className='preview-section-title'>占位 · 后续 Task 填充</Text>
      </View>
    </View>
  )
}
```

- [ ] **Step 4: 创建 preview scss**

Create `src/pages/preview/index.scss`：

```scss
.preview {
  min-height: 100vh;
  padding: 32rpx;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
}

.preview-theme-bar {
  display: flex;
  gap: 16rpx;
  margin-bottom: 32rpx;
  flex-wrap: wrap;
}
.preview-theme-chip {
  padding: 12rpx 24rpx;
  background: var(--surface);
  border: 2rpx solid var(--line-2);
  border-radius: var(--r-pill);
  font-size: 24rpx;
  color: var(--ink-2);
}
.preview-theme-chip.on {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.preview-section {
  background: var(--surface);
  border-radius: var(--r-lg);
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-sm);
}
.preview-section-title {
  display: block;
  font-size: 26rpx;
  letter-spacing: 4rpx;
  color: var(--ink-3);
  font-family: var(--font-display);
  text-transform: uppercase;
  margin-bottom: 24rpx;
}
.preview-row {
  display: flex;
  gap: 24rpx;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 16rpx;
}
.preview-row-label {
  font-size: 22rpx;
  color: var(--ink-3);
  min-width: 120rpx;
}
```

- [ ] **Step 5: 编译 + 访问验证**

watch 自动重编；微信开发者工具点「编译」。
首页右上角头像 → 我的页（暂时手动）。preview 页未在导航树里，直接在 console 执行：

```js
wx.navigateTo({ url: '/pages/preview/index' })
```

或临时改首页头像 onTap 跳 preview。Expected: 出现主题切换 chip 行 + "占位" section；点 chip 可切主题。

- [ ] **Step 6: Commit**

```bash
git add src/pages/preview src/app.config.ts
git commit -m "feat(preview): 新增组件预览页骨架"
```

---

## Task 2: BrandLogo（钤印）

**Files:**
- Create: `src/components/BrandLogo/index.tsx`
- Create: `src/components/BrandLogo/index.scss`
- Modify: `src/pages/preview/index.tsx`

- [ ] **Step 1: 创建 BrandLogo 组件**

Create `src/components/BrandLogo/index.tsx`：

```typescript
import { View, Text } from '@tarojs/components'
import './index.scss'

type Size = 'sm' | 'md' | 'lg'

interface Props {
  size?: Size
  className?: string
}

export default function BrandLogo({ size = 'lg', className }: Props) {
  return (
    <View className={`brand-seal brand-seal--${size} ${className || ''}`}>
      <View className='brand-seal-mark'>
        <View className='brand-seal-chars'>
          <Text className='brand-seal-char'>行</Text>
          <Text className='brand-seal-char'>册</Text>
        </View>
        <View className='brand-seal-corner brand-seal-corner-tl' />
        <View className='brand-seal-corner brand-seal-corner-br' />
      </View>
      <View className='brand-seal-side'>
        <Text className='brand-seal-en'>XING · CE</Text>
        <Text className='brand-seal-cap'>旅 行 簿 · 2026</Text>
      </View>
    </View>
  )
}
```

- [ ] **Step 2: 创建样式**

Create `src/components/BrandLogo/index.scss`：

```scss
.brand-seal {
  display: inline-flex;
  align-items: center;
  gap: 20rpx;
  animation: drop-in 0.42s var(--ease-spring) both;
}

/* —— 红方章 —— */
.brand-seal-mark {
  position: relative;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4rpx;
  box-shadow: 0 4rpx 14rpx rgba(214, 46, 46, 0.25);
}

.brand-seal-chars {
  display: flex;
  flex-direction: column;
  line-height: 0.95;
  font-family: var(--font-display);
  font-weight: 900;
  letter-spacing: -2rpx;
}
.brand-seal-char {
  display: block;
}

.brand-seal-corner {
  position: absolute;
  width: 12rpx;
  height: 12rpx;
  border: 2rpx solid #fff;
}
.brand-seal-corner-tl { top: 6rpx; left: 6rpx; border-right: 0; border-bottom: 0; }
.brand-seal-corner-br { bottom: 6rpx; right: 6rpx; border-left: 0; border-top: 0; }

/* —— 旁注 —— */
.brand-seal-side {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.brand-seal-en {
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 6rpx;
  color: var(--ink);
  font-family: var(--font-display);
}
.brand-seal-cap {
  font-size: 18rpx;
  letter-spacing: 4rpx;
  color: var(--ink-3);
  font-family: var(--font-mono);
}

/* —— 尺寸 —— */
.brand-seal--sm .brand-seal-mark {
  width: 56rpx; height: 56rpx;
}
.brand-seal--sm .brand-seal-char { font-size: 24rpx; }
.brand-seal--sm .brand-seal-en   { font-size: 18rpx; }
.brand-seal--sm .brand-seal-cap  { font-size: 16rpx; }

.brand-seal--md .brand-seal-mark {
  width: 88rpx; height: 88rpx;
}
.brand-seal--md .brand-seal-char { font-size: 36rpx; }

.brand-seal--lg .brand-seal-mark {
  width: 120rpx; height: 120rpx;
}
.brand-seal--lg .brand-seal-char { font-size: 52rpx; }
.brand-seal--lg .brand-seal-en   { font-size: 24rpx; }
.brand-seal--lg .brand-seal-cap  { font-size: 20rpx; }
```

- [ ] **Step 3: 在预览页挂载**

Edit `src/pages/preview/index.tsx`，在主题切换 bar 下方、占位 section 之前，插入：

```tsx
import BrandLogo from '../../components/BrandLogo'
```

并把"占位 section"替换为：

```tsx
<View className='preview-section'>
  <Text className='preview-section-title'>BrandLogo · 钤印</Text>
  <View className='preview-row'>
    <Text className='preview-row-label'>lg</Text>
    <BrandLogo size='lg' />
  </View>
  <View className='preview-row'>
    <Text className='preview-row-label'>md</Text>
    <BrandLogo size='md' />
  </View>
  <View className='preview-row'>
    <Text className='preview-row-label'>sm</Text>
    <BrandLogo size='sm' />
  </View>
</View>
```

- [ ] **Step 4: 预览验证**

微信开发者工具 → preview 页：
- 红方章「行/册」上下排列居中，方章 4 个内角 hairline 可见
- 旁注两行：`XING · CE` / `旅 行 簿 · 2026`
- 切到 magazine 主题 → 红方章颜色变 magazine 红（#D62E2E），整体观感更冷
- 切到 minimal → 方章变墨黑（#0F0F0E）
- 切到 postcard → 方章变深红橙（#C13D2F）

- [ ] **Step 5: Commit**

```bash
git add src/components/BrandLogo src/pages/preview/index.tsx
git commit -m "feat(brand): BrandLogo 钤印组件 + 预览"
```

---

## Task 3: AIBadge

**Files:**
- Create: `src/components/AIBadge/index.tsx`
- Create: `src/components/AIBadge/index.scss`
- Modify: `src/pages/preview/index.tsx`

- [ ] **Step 1: 创建组件**

Create `src/components/AIBadge/index.tsx`：

```typescript
import { View, Text } from '@tarojs/components'
import './index.scss'

export type AIBadgeStatus = 'idle' | 'thinking' | 'ready' | 'error'
export type AIBadgeSize = 'compact' | 'lg'

interface Props {
  status?: AIBadgeStatus
  size?: AIBadgeSize
  label?: string
  onClick?: () => void
  className?: string
}

const DEFAULT_LABELS: Record<AIBadgeStatus, string> = {
  idle:     '让 AI 帮你规划',
  thinking: 'AI 正在编排…',
  ready:    '草稿就绪',
  error:    '生成失败 · 重试',
}

export default function AIBadge({
  status = 'idle',
  size = 'compact',
  label,
  onClick,
  className,
}: Props) {
  const text = label || DEFAULT_LABELS[status]
  return (
    <View
      className={`ai-badge ai-badge--${status} ai-badge--${size} ${className || ''}`}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
    >
      <View className='ai-badge-shine' />
      <Text className='ai-badge-icon'>AI</Text>
      <Text className='ai-badge-text'>{text}</Text>
      {status === 'thinking' && (
        <View className='ai-badge-dots'>
          <View className='ai-badge-dot' />
          <View className='ai-badge-dot' />
          <View className='ai-badge-dot' />
        </View>
      )}
    </View>
  )
}
```

- [ ] **Step 2: 创建样式**

Create `src/components/AIBadge/index.scss`：

```scss
.ai-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  position: relative;
  overflow: hidden;
  border-radius: var(--r-pill);
  color: #fff;
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 2rpx;
  background: linear-gradient(135deg, var(--plum) 0%, var(--accent) 100%);
  box-shadow: 0 8rpx 24rpx rgba(107, 70, 193, 0.25);
  transition: transform 0.18s var(--ease-out), box-shadow 0.22s var(--ease-out);
}
.ai-badge:active { transform: scale(0.96); }

/* status 配色 */
.ai-badge--idle     { background: linear-gradient(135deg, var(--plum), var(--accent)); }
.ai-badge--thinking { background: linear-gradient(135deg, #6B46C1, #FF7A2E); }
.ai-badge--ready    { background: linear-gradient(135deg, #4FB286, #FFC247); }
.ai-badge--error    { background: linear-gradient(135deg, var(--coral), #FF9A4D); }

/* size */
.ai-badge--compact {
  padding: 10rpx 22rpx;
  font-size: 22rpx;
}
.ai-badge--lg {
  padding: 28rpx 0;
  width: 100%;
  font-size: 32rpx;
  letter-spacing: 4rpx;
  animation: pulse-glow 3.2s ease-in-out 1.2s infinite;
}

.ai-badge-icon {
  font-size: inherit;
  line-height: 1;
}
.ai-badge-text {
  position: relative;
  z-index: 1;
}

/* shine 扫光 */
.ai-badge-shine {
  position: absolute;
  top: 0; bottom: 0;
  left: 0;
  width: 40%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  animation: shimmer 2.6s var(--ease-in-out) infinite;
  pointer-events: none;
}

/* dots */
.ai-badge-dots {
  display: inline-flex;
  gap: 6rpx;
  margin-left: 4rpx;
}
.ai-badge-dot {
  width: 8rpx; height: 8rpx;
  border-radius: 50%;
  background: #fff;
  animation: ai-thinking-dots 1.2s ease-in-out infinite;
}
.ai-badge-dot:nth-child(2) { animation-delay: 0.18s; }
.ai-badge-dot:nth-child(3) { animation-delay: 0.36s; }
```

- [ ] **Step 3: 挂到预览页**

Edit `src/pages/preview/index.tsx`，在 BrandLogo section 之后追加：

```tsx
import AIBadge from '../../components/AIBadge'
```

新增 section：

```tsx
<View className='preview-section'>
  <Text className='preview-section-title'>AIBadge · 4 status × 2 size</Text>
  <View className='preview-row'>
    <Text className='preview-row-label'>compact</Text>
    <AIBadge status='idle' size='compact' />
    <AIBadge status='thinking' size='compact' />
    <AIBadge status='ready' size='compact' />
    <AIBadge status='error' size='compact' />
  </View>
  <View className='preview-row preview-row--stack'>
    <Text className='preview-row-label'>lg (idle)</Text>
    <AIBadge status='idle' size='lg' label='让 AI 帮你规划' />
  </View>
  <View className='preview-row preview-row--stack'>
    <Text className='preview-row-label'>lg (thinking)</Text>
    <AIBadge status='thinking' size='lg' />
  </View>
</View>
```

Edit `src/pages/preview/index.scss`，追加：

```scss
.preview-row--stack {
  flex-direction: column;
  align-items: stretch;
}
.preview-row--stack > .preview-row-label {
  margin-bottom: 8rpx;
}
```

- [ ] **Step 4: 预览验证**

微信开发者工具 → preview 页：
- 4 个 compact badge 颜色不同（idle 紫橘 / thinking 紫橘 / ready 绿黄 / error 红橘）
- shine 扫光从左到右循环
- thinking 状态尾部 3 dots 跳动
- lg idle 按钮全宽，带脉冲发光（pulse-glow）
- 切换主题不影响 AIBadge 配色（status 颜色独立于 theme，符合设计稿"AI 系统色"理念）

- [ ] **Step 5: Commit**

```bash
git add src/components/AIBadge src/pages/preview/index.tsx src/pages/preview/index.scss
git commit -m "feat(ai): AIBadge 组件 + 4 status × 2 size 预览"
```

---

## Task 4: AIInterview 题库

**Files:**
- Create: `src/data/ai-interview.ts`

> 题库与组件解耦。先写数据契约，让 Task 5 的组件直接消费。

- [ ] **Step 1: 创建题库**

Create `src/data/ai-interview.ts`：

```typescript
import type { AIAudience, AIPace, AIModelAlias } from '../types/trip'

export type InterviewQType = 'single' | 'multi' | 'free' | 'number'

export interface InterviewQuestion {
  id: string
  q: string
  type: InterviewQType
  options?: readonly string[]
  placeholder?: string
}

export const AI_INTERVIEW: readonly InterviewQuestion[] = [
  {
    id: 'pace',
    q: '想要什么节奏？',
    type: 'single',
    options: ['悠闲', '平衡', '紧凑'] as const satisfies readonly AIPace[],
  },
  {
    id: 'audience',
    q: '和谁一起出行？',
    type: 'multi',
    options: ['独行', '情侣', '亲子', '老人', '朋友'] as const satisfies readonly AIAudience[],
  },
  {
    id: 'budgetCap',
    q: '人均每天预算？(可选)',
    type: 'number',
    placeholder: '例如 500，留空表示不限',
  },
  {
    id: 'freeText',
    q: '还有什么想告诉我的？',
    type: 'free',
    placeholder: '例如：喜欢拍照、不爱热门景点、想找当地特色餐厅',
  },
  {
    id: 'modelAlias',
    q: '选个 AI 模型吧',
    type: 'single',
    options: ['MiMo-V2.5', 'DeepSeek-V4-PRO', 'DeepSeek-V4-Flash'] as const satisfies readonly AIModelAlias[],
  },
]

export interface InterviewAnswers {
  pace?: AIPace
  audience?: AIAudience[]
  budgetCap?: string
  freeText?: string
  modelAlias?: AIModelAlias
}

import type { AIPreferences } from '../types/trip'

export function answersToPreferences(a: InterviewAnswers): AIPreferences {
  const budgetNum = Number(a.budgetCap)
  return {
    pace: a.pace || '平衡',
    audience: a.audience || [],
    budgetCap: a.budgetCap && budgetNum > 0 ? budgetNum : undefined,
    freeText: a.freeText?.trim() || undefined,
    modelAlias: a.modelAlias || 'MiMo-V2.5',
  }
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit 2>&1 | grep -E "ai-interview|InterviewAnswers"`
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add src/data/ai-interview.ts
git commit -m "feat(ai): AIInterview 题库与 answers→preferences 映射"
```

---

## Task 5: AIInterview 组件

**Files:**
- Create: `src/components/AIInterview/index.tsx`
- Create: `src/components/AIInterview/index.scss`
- Modify: `src/pages/preview/index.tsx`

- [ ] **Step 1: 创建组件**

Create `src/components/AIInterview/index.tsx`：

```typescript
import { useEffect, useState } from 'react'
import { View, Text, Textarea, Input } from '@tarojs/components'
import {
  AI_INTERVIEW,
  type InterviewAnswers,
  type InterviewQuestion,
  answersToPreferences,
} from '../../data/ai-interview'
import type { AIPreferences } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (prefs: AIPreferences) => void
}

export default function AIInterview({ open, onClose, onSubmit }: Props) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<InterviewAnswers>({})
  const [textBuf, setTextBuf] = useState('')

  useEffect(() => {
    if (open) {
      setStep(0)
      setAnswers({})
      setTextBuf('')
    }
  }, [open])

  if (!open) return null

  const total = AI_INTERVIEW.length
  const done = step >= total
  const q: InterviewQuestion | undefined = AI_INTERVIEW[step]

  const pickSingle = (opt: string) => {
    if (!q) return
    setAnswers((a) => ({ ...a, [q.id]: opt }))
    setTimeout(() => setStep((s) => s + 1), 280)
  }

  const toggleMulti = (opt: string) => {
    if (!q) return
    setAnswers((a) => {
      const prev = (a[q.id as keyof InterviewAnswers] as string[] | undefined) || []
      const next = prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
      return { ...a, [q.id]: next }
    })
  }

  const submitTextOrNumber = () => {
    if (!q) return
    const v = textBuf.trim()
    setAnswers((a) => ({ ...a, [q.id]: v }))
    setTextBuf('')
    setStep((s) => s + 1)
  }

  const skipFree = () => {
    if (!q) return
    setAnswers((a) => ({ ...a, [q.id]: '' }))
    setTextBuf('')
    setStep((s) => s + 1)
  }

  const finish = () => {
    onSubmit(answersToPreferences(answers))
  }

  return (
    <View className='aiv-mask theme-tokens' onClick={onClose}>
      <View className='aiv-sheet' catchMove onClick={(e) => e.stopPropagation()}>
        <View className='aiv-head'>
          <View className='aiv-progress'>
            {AI_INTERVIEW.map((_, i) => (
              <View
                key={i}
                className={`aiv-dot ${i < step ? 'done' : ''} ${i === step ? 'now' : ''}`}
              />
            ))}
          </View>
          <View className='aiv-close' onClick={onClose}>×</View>
        </View>

        <View className='aiv-history'>
          {AI_INTERVIEW.slice(0, step).map((qq) => {
            const v = answers[qq.id as keyof InterviewAnswers]
            const display = Array.isArray(v)
              ? (v.length ? v.join('、') : '随意')
              : (v || '随意')
            return (
              <View key={qq.id} className='aiv-history-row'>
                <Text className='aiv-history-q'>{qq.q}</Text>
                <Text className='aiv-history-a'>{display}</Text>
              </View>
            )
          })}
        </View>

        {!done && q && (
          <View className='aiv-current' key={step}>
            <View className='aiv-bubble'>
              <Text className='aiv-bubble-avatar'>AI</Text>
              <Text className='aiv-bubble-text'>{q.q}</Text>
            </View>

            {q.type === 'single' && q.options && (
              <View className='aiv-chips'>
                {q.options.map((opt) => (
                  <View
                    key={opt}
                    className={`aiv-chip ${answers[q.id as keyof InterviewAnswers] === opt ? 'on' : ''}`}
                    onClick={() => pickSingle(opt)}
                  >{opt}</View>
                ))}
              </View>
            )}

            {q.type === 'multi' && q.options && (
              <>
                <View className='aiv-chips'>
                  {q.options.map((opt) => {
                    const arr = (answers[q.id as keyof InterviewAnswers] as string[] | undefined) || []
                    return (
                      <View
                        key={opt}
                        className={`aiv-chip ${arr.includes(opt) ? 'on' : ''}`}
                        onClick={() => toggleMulti(opt)}
                      >{opt}</View>
                    )
                  })}
                </View>
                <View className='aiv-next' onClick={() => setStep((s) => s + 1)}>
                  下一题 →
                </View>
              </>
            )}

            {q.type === 'number' && (
              <>
                <Input
                  className='aiv-input'
                  type='number'
                  value={textBuf}
                  placeholder={q.placeholder}
                  onInput={(e) => setTextBuf(e.detail.value)}
                />
                <View className='aiv-foot'>
                  <View className='aiv-skip' onClick={skipFree}>跳过</View>
                  <View className='aiv-next' onClick={submitTextOrNumber}>下一步 →</View>
                </View>
              </>
            )}

            {q.type === 'free' && (
              <>
                <Textarea
                  className='aiv-textarea'
                  value={textBuf}
                  placeholder={q.placeholder}
                  onInput={(e) => setTextBuf(e.detail.value)}
                  maxlength={500}
                  autoHeight
                  showConfirmBar={false}
                />
                <View className='aiv-foot'>
                  <View className='aiv-skip' onClick={skipFree}>跳过</View>
                  <View className='aiv-next' onClick={submitTextOrNumber}>下一步 →</View>
                </View>
              </>
            )}
          </View>
        )}

        {done && (
          <View className='aiv-confirm'>
            <Text className='aiv-confirm-title'>我听明白了</Text>
            <Text className='aiv-confirm-sub'>将基于你的偏好为你生成行程草稿</Text>
            <View className='aiv-go' onClick={finish}>
              <Text>开始生成</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  )
}
```

- [ ] **Step 2: 创建样式**

Create `src/components/AIInterview/index.scss`：

```scss
.aiv-mask {
  position: fixed; inset: 0;
  background: rgba(43, 26, 16, 0.5);
  display: flex;
  align-items: flex-end;
  z-index: 200;
  animation: fade-in 0.22s var(--ease-out) both;
}

.aiv-sheet {
  width: 100%;
  max-height: 88vh;
  background: var(--surface);
  border-radius: var(--r-xl) var(--r-xl) 0 0;
  padding: 28rpx 32rpx 48rpx;
  box-sizing: border-box;
  overflow-y: auto;
  animation: sheet-up 0.36s var(--ease-spring) both;
}

.aiv-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}
.aiv-progress {
  display: flex;
  gap: 12rpx;
}
.aiv-dot {
  width: 14rpx; height: 14rpx;
  border-radius: 50%;
  background: var(--line-2);
  transition: background 0.22s var(--ease-out);
}
.aiv-dot.done { background: var(--accent-soft); }
.aiv-dot.now  { background: var(--accent); transform: scale(1.2); }
.aiv-close {
  width: 56rpx; height: 56rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 40rpx;
  color: var(--ink-3);
  border-radius: 50%;
}
.aiv-close:active { background: var(--accent-bg); }

/* —— 历史折叠区 —— */
.aiv-history {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 24rpx;
}
.aiv-history-row {
  display: flex;
  justify-content: space-between;
  font-size: 22rpx;
  color: var(--ink-3);
  padding: 8rpx 0;
  border-bottom: 1rpx dashed var(--line);
  animation: fade-in 0.32s var(--ease-out) both;
}
.aiv-history-a {
  color: var(--ink);
  font-weight: 600;
  font-family: var(--font-display);
  max-width: 60%;
  text-align: right;
}

/* —— 当前问题 —— */
.aiv-current {
  animation: drop-in 0.36s var(--ease-spring) both;
}
.aiv-bubble {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  margin-bottom: 24rpx;
}
.aiv-bubble-avatar {
  flex-shrink: 0;
  width: 44rpx; height: 44rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--plum), var(--accent));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
}
.aiv-bubble-text {
  font-size: 32rpx;
  line-height: 1.4;
  color: var(--ink);
  font-family: var(--font-display);
  font-weight: 600;
}

.aiv-chips {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
  margin-bottom: 24rpx;
}
.aiv-chip {
  padding: 16rpx 28rpx;
  background: var(--surface-2);
  border: 2rpx solid var(--line-2);
  border-radius: var(--r-pill);
  font-size: 28rpx;
  color: var(--ink-2);
  transition: all 0.18s var(--ease-out);
}
.aiv-chip.on {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.aiv-chip:active { transform: scale(0.96); }

.aiv-input,
.aiv-textarea {
  width: 100%;
  padding: 20rpx 24rpx;
  background: var(--accent-bg);
  border-radius: var(--r-md);
  font-size: 28rpx;
  color: var(--ink);
  box-sizing: border-box;
  margin-bottom: 16rpx;
  min-height: 80rpx;
}
.aiv-textarea {
  min-height: 160rpx;
  line-height: 1.5;
}

.aiv-foot {
  display: flex;
  gap: 24rpx;
  justify-content: flex-end;
}
.aiv-skip,
.aiv-next {
  padding: 16rpx 32rpx;
  font-size: 26rpx;
  font-weight: 600;
  border-radius: var(--r-pill);
}
.aiv-skip {
  background: var(--surface-2);
  color: var(--ink-3);
}
.aiv-next {
  background: var(--ink);
  color: #fff;
}
.aiv-next:active,
.aiv-skip:active { transform: scale(0.96); }

/* —— 完成确认 —— */
.aiv-confirm {
  text-align: center;
  padding: 24rpx 0;
  animation: pop-in 0.4s var(--ease-spring) both;
}
.aiv-confirm-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--ink);
  margin-bottom: 12rpx;
}
.aiv-confirm-sub {
  display: block;
  font-size: 24rpx;
  color: var(--ink-3);
  margin-bottom: 32rpx;
}
.aiv-go {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 28rpx 64rpx;
  background: linear-gradient(135deg, var(--plum), var(--accent));
  color: #fff;
  border-radius: var(--r-pill);
  font-size: 32rpx;
  font-weight: 700;
  letter-spacing: 4rpx;
  box-shadow: 0 12rpx 32rpx rgba(107, 70, 193, 0.3);
  animation: pulse-glow 3s ease-in-out infinite;
}
.aiv-go:active { transform: scale(0.97); }
```

- [ ] **Step 3: 挂到预览页**

Edit `src/pages/preview/index.tsx`：

- import 处加：
  ```tsx
  import AIInterview from '../../components/AIInterview'
  import { useState } from 'react'
  ```
- 在 `export default function Preview()` 内加 state：
  ```typescript
  const [aiOpen, setAiOpen] = useState(false)
  ```
- 在 AIBadge section 之后追加 section：
  ```tsx
  <View className='preview-section'>
    <Text className='preview-section-title'>AIInterview · 采访式 sheet</Text>
    <View className='preview-row preview-row--stack'>
      <AIBadge status='idle' size='lg' label='让 AI 帮你规划' onClick={() => setAiOpen(true)} />
    </View>
  </View>
  <AIInterview
    open={aiOpen}
    onClose={() => setAiOpen(false)}
    onSubmit={(prefs) => {
      console.log('[preview] interview submit', prefs)
      setAiOpen(false)
    }}
  />
  ```

- [ ] **Step 4: 预览验证**

微信开发者工具 → preview 页 → 点击「让 AI 帮你规划」：
- sheet 从底部弹起
- 5 道题逐题展开：单选 / 多选 / 数字 / 自由文本 / 单选模型
- 单选自动跳下一题（280ms）
- 多选需点「下一题」
- 已答题缩为一行 dashed 分隔
- textarea autoHeight 工作正常（输入长文本撑高）
- sheet 可上下滚（catchMove 阻止背景滚 + 内部 overflow-y）
- 完成 → 出现「开始生成」按钮
- Console 打印 `[preview] interview submit { pace, audience, ... }`
- 切到 magazine 主题 sheet 内部 chip/按钮颜色随漂移（圆角变方）

> 注：`max-height: 88vh` 在小程序需用 `vh` 兼容；若微信开发者工具显示偏差，改为 `calc(100% - 12vh)` 或具体 rpx 值。

- [ ] **Step 5: Commit**

```bash
git add src/components/AIInterview src/pages/preview/index.tsx
git commit -m "feat(ai): AIInterview 采访式 sheet"
```

---

## Task 6: AILoadingTheater

**Files:**
- Create: `src/components/AILoadingTheater/index.tsx`
- Create: `src/components/AILoadingTheater/index.scss`
- Modify: `src/pages/preview/index.tsx`

> Theater 是受控组件：`open / status` 由父级传入；内部只负责动画和操作按钮。
> 不订阅 trip watch（那是 Phase 5 才接入的事）。

- [ ] **Step 1: 创建组件**

Create `src/components/AILoadingTheater/index.tsx`：

```typescript
import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import './index.scss'

export type TheaterStatus = 'thinking' | 'ready' | 'error'

interface Props {
  open: boolean
  status?: TheaterStatus
  /** 用户点击「停止生成」时调用；父级负责真正取消任务 */
  onCancel?: () => void
  /** 用户点击右上「×」最小化时调用；不停止任务 */
  onMinimize?: () => void
}

const STREAM_MESSAGES = [
  '分析你的偏好…',
  '搜索目的地周边亮点…',
  '为你规划最优路线…',
  '估算每日开销…',
  '正在为你编排成册…',
] as const

export default function AILoadingTheater({
  open,
  status = 'thinking',
  onCancel,
  onMinimize,
}: Props) {
  const [streamText, setStreamText] = useState<string>(STREAM_MESSAGES[0])

  useEffect(() => {
    if (!open || status !== 'thinking') return
    let i = 0
    setStreamText(STREAM_MESSAGES[0])
    const t = setInterval(() => {
      i = (i + 1) % STREAM_MESSAGES.length
      setStreamText(STREAM_MESSAGES[i])
    }, 1100)
    return () => clearInterval(t)
  }, [open, status])

  if (!open) return null
  const done = status === 'ready'
  const err = status === 'error'

  return (
    <View className='ait-mask theme-tokens'>
      <View className='ait-sheet'>
        <View className='ait-close' onClick={onMinimize}>×</View>
        <View className='ait-stage'>
          <View className={`ait-orb ait-orb--${status}`}>
            <View className='ait-orb-core' />
            <View className='ait-orb-ring r1' />
            <View className='ait-orb-ring r2' />
            <View className='ait-orb-ring r3' />
            {done && <Text className='ait-orb-check'>✓</Text>}
            {err  && <Text className='ait-orb-check'>!</Text>}
          </View>
          <Text className='ait-title'>
            {done ? '已为你编排好' : err ? '生成失败' : 'AI 正在为你编排'}
          </Text>
          <Text className='ait-stream' key={streamText}>
            {done ? '即将就绪' : err ? '请稍后重试' : streamText}
          </Text>
        </View>

        {status === 'thinking' && (
          <View className='ait-cancel' onClick={onCancel}>停止生成</View>
        )}
      </View>
    </View>
  )
}
```

- [ ] **Step 2: 创建样式**

Create `src/components/AILoadingTheater/index.scss`：

```scss
.ait-mask {
  position: fixed; inset: 0;
  background: rgba(20, 12, 8, 0.75);
  z-index: 250;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fade-in 0.32s var(--ease-out) both;
}
.ait-sheet {
  width: 92%;
  max-width: 640rpx;
  position: relative;
  background: var(--surface);
  border-radius: var(--r-xl);
  padding: 64rpx 32rpx 40rpx;
  text-align: center;
  animation: pop-in 0.42s var(--ease-spring) both;
}
.ait-close {
  position: absolute;
  top: 16rpx; right: 24rpx;
  width: 56rpx; height: 56rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 44rpx;
  color: var(--ink-3);
  border-radius: 50%;
}
.ait-close:active { background: var(--accent-bg); }

/* —— Orb —— */
.ait-stage { padding: 24rpx 0 40rpx; }
.ait-orb {
  position: relative;
  width: 240rpx; height: 240rpx;
  margin: 0 auto 32rpx;
}
.ait-orb-core {
  position: absolute;
  inset: 25%;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, var(--accent-2), var(--plum));
  box-shadow: 0 0 64rpx rgba(107, 70, 193, 0.55);
  animation: float-y 2.4s ease-in-out infinite;
}
.ait-orb-ring {
  position: absolute;
  border-radius: 50%;
  border: 2rpx solid var(--accent-soft);
  opacity: 0.6;
  animation: spin 6s linear infinite;
}
.ait-orb-ring.r1 { inset: 12%; border-color: var(--plum); opacity: 0.5; }
.ait-orb-ring.r2 { inset: 5%;  border-color: var(--accent); opacity: 0.4; animation-duration: 9s; animation-direction: reverse; }
.ait-orb-ring.r3 { inset: 0;   border-color: var(--sun); opacity: 0.3; animation-duration: 12s; }

.ait-orb--ready .ait-orb-core { background: radial-gradient(circle at 30% 30%, var(--sun), var(--leaf)); }
.ait-orb--error .ait-orb-core { background: radial-gradient(circle at 30% 30%, var(--coral), var(--accent)); }

.ait-orb-check {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 80rpx;
  color: #fff;
  font-weight: 800;
  animation: pop-in 0.4s var(--ease-spring) both;
}

.ait-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--ink);
  margin-bottom: 12rpx;
}
.ait-stream {
  display: block;
  font-size: 24rpx;
  color: var(--ink-3);
  letter-spacing: 2rpx;
  animation: fade-in 0.4s var(--ease-out) both;
}

.ait-cancel {
  margin: 24rpx auto 0;
  display: inline-block;
  padding: 16rpx 48rpx;
  background: var(--surface-2);
  color: var(--ink-2);
  border-radius: var(--r-pill);
  font-size: 26rpx;
}
.ait-cancel:active { transform: scale(0.96); }
```

- [ ] **Step 3: 挂到预览页**

Edit `src/pages/preview/index.tsx`：

- import：
  ```tsx
  import AILoadingTheater, { type TheaterStatus } from '../../components/AILoadingTheater'
  ```
- state：
  ```typescript
  const [theaterStatus, setTheaterStatus] = useState<TheaterStatus | null>(null)
  ```
- 追加 section：
  ```tsx
  <View className='preview-section'>
    <Text className='preview-section-title'>AILoadingTheater · 全屏</Text>
    <View className='preview-row'>
      <View className='preview-theme-chip' onClick={() => setTheaterStatus('thinking')}>thinking</View>
      <View className='preview-theme-chip' onClick={() => setTheaterStatus('ready')}>ready</View>
      <View className='preview-theme-chip' onClick={() => setTheaterStatus('error')}>error</View>
    </View>
  </View>
  <AILoadingTheater
    open={theaterStatus !== null}
    status={theaterStatus || 'thinking'}
    onCancel={() => setTheaterStatus(null)}
    onMinimize={() => setTheaterStatus(null)}
  />
  ```

- [ ] **Step 4: 预览验证**

微信开发者工具 → preview 页 → 点 thinking：
- 全屏深色 mask 弹起
- 中央 orb：内核渐变发光 + float-y 浮动；三层 ring 不同方向旋转
- 标题「AI 正在为你编排」；循环 sub 文案每 1.1s 切换
- 底部「停止生成」可点击 → 关闭
- 右上「×」可点击 → 关闭
- 切换 ready：orb 变绿黄色 + check ✓ 弹出
- 切换 error：orb 变红 + ! + 无底部按钮

- [ ] **Step 5: Commit**

```bash
git add src/components/AILoadingTheater src/pages/preview/index.tsx
git commit -m "feat(ai): AILoadingTheater 全屏 orb 加载"
```

---

## Task 7: TripAIStatusBar

**Files:**
- Create: `src/components/TripAIStatusBar/index.tsx`
- Create: `src/components/TripAIStatusBar/index.scss`
- Modify: `src/pages/preview/index.tsx`

- [ ] **Step 1: 创建组件**

Create `src/components/TripAIStatusBar/index.tsx`：

```typescript
import { View, Text } from '@tarojs/components'
import './index.scss'

interface Props {
  /** 不展示就传 false；ready 状态由父级自动转 AIPlanPreview，不在本组件渲染 */
  open: boolean
  onTap?: () => void
}

export default function TripAIStatusBar({ open, onTap }: Props) {
  if (!open) return null
  return (
    <View className='taisb' onClick={onTap}>
      <View className='taisb-shine' />
      <Text className='taisb-icon'>AI</Text>
      <Text className='taisb-text'>AI 正在为你编排 · 点击展开</Text>
      <View className='taisb-dots'>
        <View className='taisb-dot' />
        <View className='taisb-dot' />
        <View className='taisb-dot' />
      </View>
    </View>
  )
}
```

- [ ] **Step 2: 创建样式**

Create `src/components/TripAIStatusBar/index.scss`：

```scss
.taisb {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 18rpx 28rpx;
  background: linear-gradient(135deg, var(--plum), var(--accent));
  color: #fff;
  overflow: hidden;
  font-size: 24rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
  animation: drop-in 0.36s var(--ease-spring) both;
}
.taisb-shine {
  position: absolute;
  top: 0; bottom: 0; left: 0;
  width: 40%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
  animation: shimmer 2.4s var(--ease-in-out) infinite;
  pointer-events: none;
}
.taisb-icon {
  font-size: 24rpx;
}
.taisb-text {
  flex: 1;
}
.taisb-dots {
  display: inline-flex;
  gap: 6rpx;
}
.taisb-dot {
  width: 8rpx; height: 8rpx;
  border-radius: 50%;
  background: #fff;
  animation: ai-thinking-dots 1.2s ease-in-out infinite;
}
.taisb-dot:nth-child(2) { animation-delay: 0.18s; }
.taisb-dot:nth-child(3) { animation-delay: 0.36s; }
.taisb:active { opacity: 0.92; }
```

- [ ] **Step 3: 挂到预览页**

Edit `src/pages/preview/index.tsx`：

```tsx
import TripAIStatusBar from '../../components/TripAIStatusBar'
```

新 state：
```typescript
const [statusBarOpen, setStatusBarOpen] = useState(false)
```

追加 section：
```tsx
<View className='preview-section'>
  <Text className='preview-section-title'>TripAIStatusBar · 最小化态</Text>
  <TripAIStatusBar open={statusBarOpen} onTap={() => setStatusBarOpen(false)} />
  <View className='preview-row'>
    <View className='preview-theme-chip' onClick={() => setStatusBarOpen((v) => !v)}>
      {statusBarOpen ? '隐藏' : '显示'}
    </View>
  </View>
</View>
```

- [ ] **Step 4: 预览验证**

微信开发者工具 → preview 页：
- 点「显示」→ 状态条出现，shine 扫光 + dots 跳
- 点状态条本体 → 收起（onTap）

- [ ] **Step 5: Commit**

```bash
git add src/components/TripAIStatusBar src/pages/preview/index.tsx
git commit -m "feat(ai): TripAIStatusBar 最小化状态条"
```

---

## Task 8: HomeCardAIRow

**Files:**
- Create: `src/components/HomeCardAIRow/index.tsx`
- Create: `src/components/HomeCardAIRow/index.scss`
- Modify: `src/pages/preview/index.tsx`

> 此组件用于首页卡片内部的 AI 行（thinking + ready 两态）。语义与 AILoadingBar
> 重叠，但视觉更轻、嵌入卡片内不抢戏。AILoadingBar 在 Phase 5 删除。

- [ ] **Step 1: 创建组件**

Create `src/components/HomeCardAIRow/index.tsx`：

```typescript
import { View, Text } from '@tarojs/components'
import './index.scss'

export type HomeCardAIRowStatus = 'thinking' | 'ready' | 'error'

interface Props {
  status: HomeCardAIRowStatus
  /** thinking 文案的额外信息，如 "预计 30s" */
  hint?: string
  onTap?: () => void
}

const CONFIG: Record<HomeCardAIRowStatus, { text: string; cls: string }> = {
  thinking: { text: 'AI 正在为你编排',     cls: 'hc-ai--thinking' },
  ready:    { text: 'AI 草稿就绪 · 点击查看', cls: 'hc-ai--ready' },
  error:    { text: 'AI 生成失败 · 点击重试', cls: 'hc-ai--error' },
}

export default function HomeCardAIRow({ status, hint, onTap }: Props) {
  const c = CONFIG[status]
  return (
    <View
      className={`hc-ai ${c.cls}`}
      onClick={(e) => { e.stopPropagation(); onTap?.() }}
    >
      {status === 'thinking' && <View className='hc-ai-shine' />}
      <Text className='hc-ai-icon'>AI</Text>
      <Text className='hc-ai-text'>
        {c.text}{hint ? ` · ${hint}` : ''}
      </Text>
      {status === 'thinking' && (
        <View className='hc-ai-dots'>
          <View className='hc-ai-dot' />
          <View className='hc-ai-dot' />
          <View className='hc-ai-dot' />
        </View>
      )}
      {status === 'ready' && <Text className='hc-ai-arrow'>›</Text>}
    </View>
  )
}
```

- [ ] **Step 2: 创建样式**

Create `src/components/HomeCardAIRow/index.scss`：

```scss
.hc-ai {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 12rpx 18rpx;
  border-radius: var(--r-sm);
  font-size: 22rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
  overflow: hidden;
  margin-bottom: 16rpx;
}

.hc-ai--thinking {
  background: linear-gradient(135deg, rgba(107, 70, 193, 0.10), rgba(255, 122, 46, 0.10));
  color: var(--plum);
}
.hc-ai--ready {
  background: linear-gradient(135deg, rgba(79, 178, 134, 0.12), rgba(255, 194, 71, 0.12));
  color: var(--leaf);
}
.hc-ai--error {
  background: rgba(255, 91, 91, 0.10);
  color: var(--coral);
}

.hc-ai-shine {
  position: absolute;
  top: 0; bottom: 0; left: 0;
  width: 40%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
  animation: shimmer 2.6s var(--ease-in-out) infinite;
  pointer-events: none;
}
.hc-ai-icon  { font-size: 22rpx; }
.hc-ai-text  { flex: 1; }
.hc-ai-arrow { font-size: 28rpx; line-height: 1; }

.hc-ai-dots {
  display: inline-flex;
  gap: 5rpx;
}
.hc-ai-dot {
  width: 6rpx; height: 6rpx;
  border-radius: 50%;
  background: currentColor;
  animation: ai-thinking-dots 1.2s ease-in-out infinite;
}
.hc-ai-dot:nth-child(2) { animation-delay: 0.18s; }
.hc-ai-dot:nth-child(3) { animation-delay: 0.36s; }
```

- [ ] **Step 3: 挂到预览页**

Edit `src/pages/preview/index.tsx`：

```tsx
import HomeCardAIRow from '../../components/HomeCardAIRow'
```

追加 section：
```tsx
<View className='preview-section'>
  <Text className='preview-section-title'>HomeCardAIRow · 卡内行</Text>
  <View className='preview-row preview-row--stack'>
    <HomeCardAIRow status='thinking' hint='预计 30s' />
    <HomeCardAIRow status='ready' />
    <HomeCardAIRow status='error' />
  </View>
</View>
```

- [ ] **Step 4: 预览验证**

微信开发者工具 → preview 页：
- thinking 行：紫橘半透明背景 + shine + dots
- ready 行：绿黄半透明背景 + 末尾 › 箭头
- error 行：红半透明背景
- 切换主题 → 文案颜色保持（AI 系统色），背景透明度自适应

- [ ] **Step 5: Commit**

```bash
git add src/components/HomeCardAIRow src/pages/preview/index.tsx
git commit -m "feat(ai): HomeCardAIRow 卡内行（thinking/ready/error）"
```

---

## Task 9: 抽出 ProfileForm，复用到 ProfileSetupModal + Me

**Files:**
- Create: `src/components/ProfileForm/index.tsx`
- Modify: `src/components/ProfileSetupModal/index.tsx`
- Modify: `src/pages/me/index.tsx`

> ProfileForm 是纯表单（头像选择 + 昵称输入 + 保存按钮）。
> 不带 sheet/modal 容器，调用方自行包裹。
> ProfileSetupModal 保留 sheet 容器 + skip 逻辑；Me 页直接挂表单。
> 表单样式复用 .psm-* 选择器（已在 app.scss 全局定义）。

- [ ] **Step 1: 创建 ProfileForm**

Create `src/components/ProfileForm/index.tsx`：

```typescript
import { useEffect, useState } from 'react'
import { View, Text, Button, Input, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'

interface Props {
  initialNickname?: string
  initialAvatarUrl?: string
  /** 保存按钮文案，默认「保存」 */
  submitLabel?: string
  /** 左侧次级按钮文案；不传则不显示该按钮 */
  secondaryLabel?: string
  onSecondary?: () => void
  onSubmit: (data: { nickname: string; avatarUrl: string }) => Promise<void>
}

const DEFAULT_AVATAR = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

export default function ProfileForm({
  initialNickname,
  initialAvatarUrl,
  submitLabel = '保存',
  secondaryLabel,
  onSecondary,
  onSubmit,
}: Props) {
  const [nickname, setNickname] = useState(
    initialNickname && initialNickname !== '行册旅人' ? initialNickname : '',
  )
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl || '')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setNickname(initialNickname && initialNickname !== '行册旅人' ? initialNickname : '')
    setAvatarUrl(initialAvatarUrl || '')
  }, [initialNickname, initialAvatarUrl])

  const onChooseAvatar = (e: { detail?: { avatarUrl?: string } }) => {
    const url = e?.detail?.avatarUrl
    if (url) setAvatarUrl(url)
  }

  const handleSubmit = async () => {
    const nick = nickname.trim()
    if (!nick) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    if (!avatarUrl) {
      Taro.showToast({ title: '请选择头像', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({ nickname: nick, avatarUrl })
    } catch (e) {
      console.error('[ProfileForm] submit failed', e)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        className='psm-avatar-btn'
        openType='chooseAvatar'
        onChooseAvatar={onChooseAvatar}
      >
        <Image className='psm-avatar' src={avatarUrl || DEFAULT_AVATAR} mode='aspectFill' />
        <Text className='psm-avatar-hint'>{avatarUrl ? '点击更换头像' : '点击选择微信头像'}</Text>
      </Button>

      <View className='psm-field'>
        <Text className='psm-label'>昵称</Text>
        <Input
          className='psm-input'
          type='nickname'
          placeholder='请输入昵称'
          value={nickname}
          onInput={(e) => setNickname(e.detail.value)}
        />
      </View>

      <View className='psm-actions'>
        {secondaryLabel && (
          <View className='psm-btn psm-btn-skip' onClick={onSecondary}>{secondaryLabel}</View>
        )}
        <View
          className={`psm-btn psm-btn-primary ${submitting ? 'is-disabled' : ''}`}
          onClick={submitting ? undefined : handleSubmit}
        >
          {submitting ? '保存中…' : submitLabel}
        </View>
      </View>
    </>
  )
}
```

- [ ] **Step 2: 改 ProfileSetupModal 复用 ProfileForm**

Edit `src/components/ProfileSetupModal/index.tsx`：

```typescript
import { View, Text } from '@tarojs/components'
import ProfileForm from '../ProfileForm'

interface Props {
  open: boolean
  initialNickname?: string
  initialAvatarUrl?: string
  onClose: () => void
  onSubmit: (data: { nickname: string; avatarUrl: string }) => Promise<void>
}

export default function ProfileSetupModal({
  open, initialNickname, initialAvatarUrl, onClose, onSubmit,
}: Props) {
  if (!open) return null

  const handleSubmit = async (data: { nickname: string; avatarUrl: string }) => {
    await onSubmit(data)
    onClose()
  }

  return (
    <View className='psm-mask' onClick={onClose}>
      <View className='psm-sheet' onClick={(e) => e.stopPropagation()}>
        <View className='psm-title'>完善个人信息</View>
        <View className='psm-sub'>用于在协作攻略里显示你的身份</View>
        <ProfileForm
          initialNickname={initialNickname}
          initialAvatarUrl={initialAvatarUrl}
          secondaryLabel='跳过'
          onSecondary={onClose}
          onSubmit={handleSubmit}
        />
      </View>
    </View>
  )
}
```

- [ ] **Step 3: Me 页改用 ProfileForm**

Edit `src/pages/me/index.tsx`，替换"个人资料"section 内的整段（avatar-btn / field / save-btn）为：

```tsx
import ProfileForm from '../../components/ProfileForm'
```

```tsx
<View className='me-section'>
  <Text className='me-section-title'>个人资料</Text>
  <ProfileForm
    initialNickname={me?.nickname}
    initialAvatarUrl={me?.avatarUrl}
    onSubmit={async ({ nickname, avatarUrl }) => {
      // @ts-ignore Taro.cloud
      await Taro.cloud.callFunction({
        name: 'ensure-user',
        data: { nickname, avatarUrl },
      })
      await refresh()
      Taro.showToast({ title: '已保存', icon: 'success' })
    }}
  />
</View>
```

同时把 Me 页头部不再用到的 useState（nickname / avatarUrl / saving / onChooseAvatar / handleSaveProfile）删除，保留 me / refresh / theme / setTheme 的引用。

Edit `src/pages/me/index.scss`，删除以下不再使用的选择器（已被 ProfileForm 复用的 `.psm-*` 接管）：
- `.me-avatar-btn / .me-avatar / .me-avatar-hint`
- `.me-field / .me-label / .me-input`
- `.me-save-btn` 整段

> 保留 `.me / .me-section / .me-section-title / .me-theme-*` 等主题选择卡相关样式。

- [ ] **Step 4: 类型检查 + 编译**

Run: `npx tsc --noEmit 2>&1 | tail -20`
Expected: 无新报错

观察 watch 窗口
Expected: 编译成功

- [ ] **Step 5: 冒烟**

微信开发者工具 → 编译：
- 我的页：头像 + 昵称 + 保存按钮，行为与之前一致
- 首次登录态：ProfileSetupModal 仍能弹出，「跳过」「保存」逻辑保持

- [ ] **Step 6: Commit**

```bash
git add src/components/ProfileForm src/components/ProfileSetupModal/index.tsx src/pages/me/index.tsx src/pages/me/index.scss
git commit -m "refactor(profile): 抽出 ProfileForm，Me 页与 SetupModal 复用"
```

---

## Task 10: 全组件矩阵走查

**Files:** 仅验证，不改代码

- [ ] **Step 1: watch 持续运行 + 微信开发者工具打开**

确保 `npm run dev:weapp` watch 在运行；微信开发者工具点「编译」。

- [ ] **Step 2: 访问 preview 页，按主题切换走查**

进入 preview 页（首页 → 我的页 → 临时入口；或 console `wx.navigateTo({url:'/pages/preview/index'})`），依次切到 tegami / magazine / postcard / minimal：

| 组件 | 验证点 |
| --- | --- |
| BrandLogo (3 size) | 钤印方章颜色随主题；旁注字体随 font-display |
| AIBadge × 4 status × 2 size | shine 始终扫光；thinking dots 跳动；lg 有 pulse-glow |
| AIInterview | sheet 弹起；5 道题流程走完；history 折叠正确 |
| AILoadingTheater × 3 status | orb 旋转 + float-y；ready 绿黄；error 红 |
| TripAIStatusBar | shine + dots；切换主题不影响（AI 系统色） |
| HomeCardAIRow × 3 status | 半透明背景；ready 末尾 › |

- [ ] **Step 3: 检查无 console.log 输出（除 preview 自己 console.log 的）**

微信开发者工具 Console 过滤 `[preview]` 之外的 log；应无组件内部 log。

- [ ] **Step 4: 真机预览（可选但建议）**

微信开发者工具 → 预览 → 用手机微信扫码 → preview 页：
- 动画是否流畅（小程序真机 60fps 与模拟器不同）
- shine / dots / pulse-glow 是否过度耗电（持续观察 30s）

---

## Task 11: 收尾 commit

**Files:** 无代码改动；本 Task 只走 review

- [ ] **Step 1: 确认所有组件目录都齐全**

Run: 
```bash
ls src/components/BrandLogo src/components/AIBadge src/components/AIInterview \
   src/components/AILoadingTheater src/components/TripAIStatusBar \
   src/components/HomeCardAIRow src/components/ProfileForm
```
Expected: 7 个目录都存在，每个含 index.tsx（5 个含 index.scss，ProfileForm 不带 scss）

- [ ] **Step 2: 检查未引用的旧组件保留**

Run: `grep -r "AILoadingBar\|AIPlanForm" src/pages src/views 2>/dev/null | head`
Expected: 旧组件在 home/trip 页仍被引用（Phase 5 才删）

- [ ] **Step 3: codemap 同步（可选）**

若 `docs/codemap.md` 记录了组件清单，追加：
- `src/components/BrandLogo` — 钤印 logo
- `src/components/AIBadge` — AI 状态徽章
- `src/components/AIInterview` — 采访式 AI 表单
- `src/components/AILoadingTheater` — 全屏 orb 加载
- `src/components/TripAIStatusBar` — trip 页 AI 最小化状态条
- `src/components/HomeCardAIRow` — home 卡内 AI 行
- `src/components/ProfileForm` — 个人资料表单
- `src/data/ai-interview.ts` — AI 采访题库
- `src/pages/preview/` — 开发期组件预览页（Phase 5 删除）

```bash
git add docs/codemap.md 2>/dev/null
git commit -m "docs: codemap 增补 Phase 2 共享组件" 2>/dev/null || echo "codemap 无改动跳过"
```

---

## Self-Review 结果

- ✅ Spec § 6.1.1 BrandLogo (seal) → Task 2
- ✅ Spec § 6.1.2 AIBadge → Task 3
- ✅ Spec § 6.1.3 AIInterview → Task 4 + 5
- ✅ Spec § 6.1.4 AILoadingTheater（含 onMinimize） → Task 6
- ✅ Spec § 6.1.9 TripAIStatusBar → Task 7
- ✅ Spec § 6.2.1 HomeCardAIRow → Task 8
- ✅ Spec § 6.2.2 ProfileSetupModal 表单抽出 → Task 9
- ✅ Spec § 9.2 验收（预览页覆盖各 status / 各 theme） → Task 1 + 10
- ⚠️ Spec § 6.1.5 MagFeatureCover / § 6.1.6 CoverPicker / § 6.1.7 ThemeCard
   未在本 Phase 实现。理由：
   - MagFeatureCover / CoverPicker 与首页杂志版式深度绑定 → 留 Phase 3
   - ThemeCard 在 Phase 1 已内联实现在 Me 页主题网格内，无 Phase 2 复用需求
- ✅ Spec § 12 非目标：本 Phase 未实现任何主题专属版式 / 业务页面接入

**Type consistency 检查：**
- `TheaterStatus` ('thinking' | 'ready' | 'error') ≠ `trip.aiStatus` ('generating' | 'ready' | 'error')
  → **故意不同**：Theater 组件用业务无关的"thinking"语义；Phase 5 接入时做 `'generating' → 'thinking'` 映射，避免组件依赖业务命名
- `AIBadgeStatus` ('idle' | 'thinking' | 'ready' | 'error') 多出 `idle`，覆盖"尚未触发"状态，符合 spec § 6.1.2 定义
- `HomeCardAIRowStatus` ('thinking' | 'ready' | 'error') 与 Theater 对齐

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-26-phase2-shared-components.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — 每个 Task 派一个 fresh subagent 执行，Task 间 review；适合组件类工作（边界清晰，易并行 review）
2. **Inline Execution** — 我在当前会话连跑全部 Task，每 3 Task 一个 checkpoint

**Which approach?**
