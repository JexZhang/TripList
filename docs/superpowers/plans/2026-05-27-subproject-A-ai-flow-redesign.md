# 子项目 A · AI 流程与状态展示重构 · 实施计划

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: 把 AI 攻略生成入口从「首页 → new-trip → 弹采访」改造为「首页直接拉起采访」零跳页流程；统一四主题首页/trip 页的 AI 状态展示；为云函数加上空目的地推荐与重试兜底；顺手把全项目 7 个未用 RootPortal 的 sheet 统一收口。

Architecture: 前端核心组件 6 个（AIInterview/HomeCardAIRow/TripAIStatusBar/AILoadingTheater/home 分发器/trip 页）+ 工具层 1 个（utils/ai-task.ts）+ 云函数 1 个（ai-plan-trip）。共享原则：trip 状态机驱动渲染、aiStatus 非空才显示内联条、所有底部 sheet 用 Taro RootPortal 锚定到视口。

Tech Stack: Taro 4.2 + React 18 + TypeScript 严格 + SCSS（CSS 变量主题）+ CloudBase 云函数（Node.js）。

Spec 来源：[2026-05-27-subproject-A-ai-flow-redesign.md](../specs/2026-05-27-subproject-A-ai-flow-redesign.md)

测试说明：项目当前无 lint / unit test / e2e 框架；本计划所有「验证」步骤指在「微信开发者工具」中手动冒烟，必要时真机回归。每个任务末尾的 commit 是必填动作。

---

## 1. 文件结构

### 1.1. 修改

| 路径 | 责任 |
| --- | --- |
| src/components/AIInterview/index.tsx | 5 步骤问卷 + mode prop + 草稿持久化 + RootPortal |
| src/components/AIInterview/index.scss | 5 dot 进度 + skip 按钮样式（视 frontend-design 稿）|
| src/components/TripAIStatusBar/index.tsx | 重写为内联三态组件 |
| src/components/TripAIStatusBar/index.scss | 重写：去掉 position fixed，4 主题×3 状态 |
| src/components/HomeCardAIRow/index.tsx | DOM 微调以承接 4 主题视觉 |
| src/components/HomeCardAIRow/index.scss | 重写为 4 主题×3 状态 |
| src/components/AILoadingTheater/index.tsx | PHASES 数组 + sequential setTimeout + RootPortal |
| src/components/TripActionSheet/index.tsx | 顶层 RootPortal 包裹 |
| src/components/CollaboratorsSheet/index.tsx | 顶层 RootPortal 包裹 |
| src/components/CoverPicker/index.tsx | 顶层 RootPortal 包裹 |
| src/components/ShareTypeSheet/index.tsx | 顶层 RootPortal 包裹 |
| src/components/AIPlanPreview/index.tsx | 顶层 RootPortal 包裹 |
| src/pages/home/index.tsx | interviewOpen + handleAiCreate + AIInterview 渲染 |
| src/pages/home/HomePostcard.tsx | 每张明信片卡片下方加 HomeCardAIRow |
| src/pages/home/HomeMagazine.tsx | HomeCardAIRow 扩到所有卡片 |
| src/pages/trip/index.tsx | 内联 TripAIStatusBar + 状态机 + 草稿清理 |
| src/pages/new-trip/index.tsx | 删除 AI 入口、handleAiSubmit、openAI 参数 |
| src/utils/ai-task.ts | 新增 createTripAndFireAI |
| cloudfunctions/ai-plan-trip/index.js | 主 prompt + recommendedDestinations + 3 次重试 |

### 1.2. 新增

| 路径 | 责任 |
| --- | --- |
| docs/superpowers/frontend-design/2026-05-27-ai-status-visual.md | frontend-design 输出，4 主题×3 状态视觉规格 |
| src/utils/ai-apply.ts | apply 阶段 name/destinations 合并逻辑 |
| src/data/ai-interview-create.ts | create 模式 5 步问卷数据定义 |

### 1.3. 删除

无，new-trip 仅删行不删文件。

---

## 2. 任务清单

### 2.1. Task 1：frontend-design 视觉稿（Phase 1 前置）

Files:
- 新增：docs/superpowers/frontend-design/2026-05-27-ai-status-visual.md

- [ ] 2.1.1. 调起 /frontend-design 命令

向 /frontend-design 提交以下需求文档，要求其输出 4 主题×3 状态 = 12 个视觉规格（每个含 DOM 结构示意、关键 CSS token、留白与动效要点）。涵盖组件：HomeCardAIRow（4 主题）+ TripAIStatusBar（4 主题，与 HomeCardAIRow 视觉一致但宽度铺满）。

提交给 /frontend-design 的 brief 模板：

```
组件：HomeCardAIRow + TripAIStatusBar
主题与设计语言 token：
- tegami 手帖：信封折角 / 邮戳字母 / 暖橘色描边
- magazine 刊物：报头横线 / 装订小圆点 / 黑底白字数字标号
- postcard 明信片：椭圆戳轮廓 / 虚线边 / 牛皮纸底色
- minimal 极简：极细 hairline / 等宽数字进度 / 大量留白
状态：generating / ready / error
约束：
- 走 CSS 变量（不要硬编码 hex），变量名沿用现有主题 token
- 文案固定：generating "AI 正在为你编排"；ready "AI 草稿就绪 · 点击查看"；error "AI 生成失败 · 点击重试"
- 不引入 emoji
- generating 必须有动态元素（shine / 跳点 / 旋转环之一），error 须有 red token 提示
输出到：docs/superpowers/frontend-design/2026-05-27-ai-status-visual.md
```

- [ ] 2.1.2. 验证产物

打开 docs/superpowers/frontend-design/2026-05-27-ai-status-visual.md，确认存在 4×3 共 12 段视觉规格，每段包含 DOM 草图 + token 列表 + 状态切换动效说明。

- [ ] 2.1.3. Commit

```bash
git add docs/superpowers/frontend-design/2026-05-27-ai-status-visual.md
git commit -m "docs: add AI status visual design spec (4 themes × 3 states)"
```

---

### 2.2. Task 2：AIInterview 类型与 mode 骨架

Files:
- 修改：src/components/AIInterview/index.tsx
- 新增：src/data/ai-interview-create.ts

- [ ] 2.2.1. 新增 src/data/ai-interview-create.ts，定义 create 模式 5 步问卷结构

```typescript
import type { Destination, AIPreferences } from '../types/trip'

export type CreateStepId = 'dest' | 'dates' | 'pax' | 'prefs' | 'name'

export interface CreateAnswers {
  destinations: Destination[]
  startDate: string
  endDate: string
  pax: number
  preferences: AIPreferences
  name: string
}

export const CREATE_STEPS: readonly CreateStepId[] = ['dest', 'dates', 'pax', 'prefs', 'name'] as const

export const STEP_TITLES: Record<CreateStepId, string> = {
  dest: '想去哪里？',
  dates: '什么时候出发？',
  pax: '几位同行？',
  prefs: '聊聊你的偏好',
  name: '给这趟旅程起个名字',
}

export const STEP_SKIP_HINT: Partial<Record<CreateStepId, string>> = {
  dest: '跳过 · AI 会基于偏好为你推荐',
  prefs: '跳过',
  name: '跳过 · AI 智能生成',
}

import dayjs from 'dayjs'

export function emptyCreateAnswers(): CreateAnswers {
  return {
    destinations: [],
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: dayjs().add(2, 'day').format('YYYY-MM-DD'),
    pax: 2,
    preferences: { pace: '平衡', audience: [], modelAlias: 'MiMo-V2.5' },
    name: '',
  }
}
```

- [ ] 2.2.2. 在 AIInterview/index.tsx 顶部更新 import 与 props 类型

```typescript
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Textarea, Input, RootPortal } from '@tarojs/components'
import DatePicker from '../DatePicker'
import DestinationPicker from '../DestinationPicker'
import { Picker } from '@tarojs/components'
import SparkleIcon from '../SparkleIcon'
import {
  AI_INTERVIEW,
  type InterviewAnswers,
  type InterviewQuestion,
  answersToPreferences,
} from '../../data/ai-interview'
import {
  CREATE_STEPS,
  STEP_TITLES,
  STEP_SKIP_HINT,
  emptyCreateAnswers,
  type CreateAnswers,
  type CreateStepId,
} from '../../data/ai-interview-create'
import type { AIPreferences, Destination } from '../../types/trip'
import './index.scss'

export type AIInterviewSubmit =
  | {
      mode: 'create'
      destinations: Destination[]
      startDate: string
      endDate: string
      pax: number
      preferences: AIPreferences
      name?: string
    }
  | {
      mode: 'enrich'
      preferences: AIPreferences
    }

interface Props {
  open: boolean
  mode: 'create' | 'enrich'
  tripId?: string
  onClose: () => void
  onSubmit: (data: AIInterviewSubmit) => void
}
```

- [ ] 2.2.3. 替换原 default export 函数签名

```typescript
export default function AIInterview({ open, mode, tripId, onClose, onSubmit }: Props) {
  // body 由后续步骤补全
  return null
}
```

- [ ] 2.2.4. 验证：保存后构建不报 TS 错误，未引用此组件的页面不受影响

运行：`npm run dev:weapp`
预期：编译成功；主页/trip 页加载正常（AIInterview 暂时返回 null，原入口先不动）

- [ ] 2.2.5. Commit

```bash
git add src/data/ai-interview-create.ts src/components/AIInterview/index.tsx
git commit -m "refactor(ai-interview): add mode prop and create-mode step schema"
```

---

### 2.3. Task 3：AIInterview create 模式 5 步渲染

Files:
- 修改：src/components/AIInterview/index.tsx
- 修改：src/components/AIInterview/index.scss

- [ ] 2.3.1. 在 AIInterview 函数体内加入 create 模式 state 与 step 推进逻辑

```typescript
const isCreate = mode === 'create'
const [answers, setAnswers] = useState<CreateAnswers>(emptyCreateAnswers)
const [enrichAnswers, setEnrichAnswers] = useState<InterviewAnswers>({})
const [stepIdx, setStepIdx] = useState(0)
const [textBuf, setTextBuf] = useState('')

useEffect(() => {
  if (!open) return
  if (isCreate) {
    setAnswers(emptyCreateAnswers())
  } else {
    setEnrichAnswers({})
  }
  setStepIdx(0)
  setTextBuf('')
}, [open, isCreate])

if (!open) return null
```

- [ ] 2.3.2. 拆出 create 步骤渲染函数（写在组件内部）

```typescript
const createStep = CREATE_STEPS[stepIdx]
const createDone = stepIdx >= CREATE_STEPS.length

const goNext = () => setStepIdx((s) => s + 1)

const updateAnswer = <K extends keyof CreateAnswers>(k: K, v: CreateAnswers[K]) => {
  setAnswers((a) => ({ ...a, [k]: v }))
}

const submitCreate = () => {
  onSubmit({
    mode: 'create',
    destinations: answers.destinations,
    startDate: answers.startDate,
    endDate: answers.endDate,
    pax: answers.pax,
    preferences: answers.preferences,
    name: answers.name.trim() || undefined,
  })
}

const renderCreateStep = () => {
  if (createStep === 'dest') {
    return (
      <View className='aiv-step'>
        <Text className='aiv-q'>{STEP_TITLES.dest}</Text>
        <DestinationPicker value={answers.destinations} onChange={(v) => updateAnswer('destinations', v)} />
        <View className='aiv-foot'>
          <View className='aiv-skip' onClick={goNext}>{STEP_SKIP_HINT.dest}</View>
          <View className='aiv-next' onClick={goNext}>下一步 →</View>
        </View>
      </View>
    )
  }
  if (createStep === 'dates') {
    return (
      <View className='aiv-step'>
        <Text className='aiv-q'>{STEP_TITLES.dates}</Text>
        <DatePicker
          value={{ start: answers.startDate, end: answers.endDate }}
          onChange={(v) => setAnswers((a) => ({ ...a, startDate: v.start, endDate: v.end }))}
        />
        <View className='aiv-foot'>
          <View className='aiv-next' onClick={goNext}>下一步 →</View>
        </View>
      </View>
    )
  }
  if (createStep === 'pax') {
    const PAX_OPTIONS = Array.from({ length: 99 }, (_, i) => `${i + 1} 人`)
    return (
      <View className='aiv-step'>
        <Text className='aiv-q'>{STEP_TITLES.pax}</Text>
        <Picker
          mode='selector'
          range={PAX_OPTIONS}
          value={Math.max(0, Math.min(98, answers.pax - 1))}
          onChange={(e) => updateAnswer('pax', Number(e.detail.value) + 1)}
        >
          <View className='aiv-pax-picker'>
            <Text>{answers.pax} 人</Text>
            <Text>▾</Text>
          </View>
        </Picker>
        <View className='aiv-foot'>
          <View className='aiv-next' onClick={goNext}>下一步 →</View>
        </View>
      </View>
    )
  }
  if (createStep === 'prefs') {
    return renderPrefsStep(false)
  }
  if (createStep === 'name') {
    return (
      <View className='aiv-step'>
        <Text className='aiv-q'>{STEP_TITLES.name}</Text>
        <Input
          className='aiv-input'
          value={answers.name}
          placeholder='例：京都 · 晚秋四日'
          onInput={(e) => updateAnswer('name', e.detail.value)}
        />
        <View className='aiv-foot'>
          <View className='aiv-skip' onClick={submitCreate}>{STEP_SKIP_HINT.name}</View>
          <View className='aiv-next' onClick={submitCreate}>开始生成</View>
        </View>
      </View>
    )
  }
  return null
}
```

- [ ] 2.3.3. 抽出 prefs 步骤渲染（create / enrich 共享）

```typescript
const renderPrefsStep = (isEnrich: boolean) => {
  const q = AI_INTERVIEW[stepIdx - (isEnrich ? 0 : CREATE_STEPS.indexOf('prefs'))]
  // 简化：把整个 4 步 prefs 子流程合并为一段，沿用原 AI_INTERVIEW 单步交互
  return (
    <View className='aiv-step aiv-prefs-host'>
      <PrefsSubflow
        answers={isEnrich ? enrichAnswers : (answers.preferences as unknown as InterviewAnswers)}
        onAnswers={(a) => {
          if (isEnrich) setEnrichAnswers(a)
          else updateAnswer('preferences', answersToPreferences(a))
        }}
        onDone={() => {
          if (isEnrich) {
            onSubmit({ mode: 'enrich', preferences: answersToPreferences(enrichAnswers) })
          } else {
            goNext()
          }
        }}
        onSkip={() => {
          if (isEnrich) {
            onSubmit({ mode: 'enrich', preferences: answersToPreferences({}) })
          } else {
            goNext()
          }
        }}
      />
    </View>
  )
}
```

- [ ] 2.3.4. 把原文件中既有的 AI_INTERVIEW 单步交互（pickSingle/toggleMulti/textBuf/skipFree 等）抽到子组件 PrefsSubflow

在文件末尾追加（同文件内）：

```typescript
interface PrefsSubflowProps {
  answers: InterviewAnswers
  onAnswers: (a: InterviewAnswers) => void
  onDone: () => void
  onSkip: () => void
}

function PrefsSubflow({ answers, onAnswers, onDone, onSkip }: PrefsSubflowProps) {
  const [subStep, setSubStep] = useState(0)
  const [textBuf, setTextBuf] = useState('')
  const q: InterviewQuestion | undefined = AI_INTERVIEW[subStep]

  if (subStep >= AI_INTERVIEW.length) {
    onDone()
    return null
  }
  if (!q) return null

  const pickSingle = (opt: string) => {
    onAnswers({ ...answers, [q.id]: opt })
    setTimeout(() => setSubStep((s) => s + 1), 280)
  }
  const toggleMulti = (opt: string) => {
    const prev = (answers[q.id as keyof InterviewAnswers] as string[] | undefined) || []
    const next = prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
    onAnswers({ ...answers, [q.id]: next })
  }
  const submitTextOrNumber = () => {
    onAnswers({ ...answers, [q.id]: textBuf.trim() })
    setTextBuf('')
    setSubStep((s) => s + 1)
  }
  const skipFree = () => {
    onAnswers({ ...answers, [q.id]: '' })
    setTextBuf('')
    setSubStep((s) => s + 1)
  }

  return (
    <View className='aiv-current'>
      <View className='aiv-bubble'>
        <View className='aiv-bubble-avatar'><SparkleIcon size={28} /></View>
        <Text className='aiv-bubble-text'>{q.q}</Text>
      </View>
      {q.type === 'single' && q.options && (
        <View className='aiv-chips'>
          {q.options.map((opt) => (
            <View key={opt}
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
                <View key={opt}
                  className={`aiv-chip ${arr.includes(opt) ? 'on' : ''}`}
                  onClick={() => toggleMulti(opt)}
                >{opt}</View>
              )
            })}
          </View>
          <View className='aiv-foot'>
            <View className='aiv-skip' onClick={onSkip}>跳过</View>
            <View className='aiv-next' onClick={() => setSubStep((s) => s + 1)}>下一题 →</View>
          </View>
        </>
      )}
      {(q.type === 'number' || q.type === 'free') && (
        <>
          {q.type === 'number' ? (
            <Input className='aiv-input' type='number' value={textBuf} placeholder={q.placeholder}
              onInput={(e) => setTextBuf(e.detail.value)} />
          ) : (
            <Textarea className='aiv-textarea' value={textBuf} placeholder={q.placeholder}
              onInput={(e) => setTextBuf(e.detail.value)} maxlength={500} autoHeight showConfirmBar={false} />
          )}
          <View className='aiv-foot'>
            <View className='aiv-skip' onClick={skipFree}>跳过</View>
            <View className='aiv-next' onClick={submitTextOrNumber}>下一步 →</View>
          </View>
        </>
      )}
    </View>
  )
}
```

- [ ] 2.3.5. 把组件主 return 替换为 mode 分支

```typescript
return (
  <View className='aiv-mask theme-tokens' onClick={onClose}>
    <View className='aiv-sheet' catchMove onClick={(e) => e.stopPropagation()}>
      <View className='aiv-head'>
        <View className='aiv-progress'>
          {(isCreate ? CREATE_STEPS : AI_INTERVIEW).map((_, i) => (
            <View key={i}
              className={`aiv-dot ${i < stepIdx ? 'done' : ''} ${i === stepIdx ? 'now' : ''}`}
            />
          ))}
        </View>
        <View className='aiv-close' onClick={onClose}>×</View>
      </View>

      {isCreate ? (
        createDone ? null : renderCreateStep()
      ) : (
        <PrefsSubflow
          answers={enrichAnswers}
          onAnswers={setEnrichAnswers}
          onDone={() => onSubmit({ mode: 'enrich', preferences: answersToPreferences(enrichAnswers) })}
          onSkip={() => onSubmit({ mode: 'enrich', preferences: answersToPreferences({}) })}
        />
      )}
    </View>
  </View>
)
```

- [ ] 2.3.6. 更新 SCSS：进度点宽度按 5 个均分

修改 src/components/AIInterview/index.scss 中 `.aiv-progress` 与 `.aiv-dot`，确保 5 个点时也能撑开均分（如已用 flex: 1 则无需改）。新增 `.aiv-pax-picker` 与 `.aiv-step` 的基本 padding。

- [ ] 2.3.7. 验证

运行：`npm run dev:weapp`，临时在 home 页根节点插一行测试用 `<AIInterview open mode='create' onClose={()=>{}} onSubmit={(d)=>console.log(d)} />` 验证 5 步能依次走完，console 输出 create-mode payload。验证后撤回测试改动。

- [ ] 2.3.8. Commit

```bash
git add src/components/AIInterview/
git commit -m "feat(ai-interview): implement 5-step create mode with shared prefs subflow"
```

---

### 2.4. Task 4：AIInterview 草稿持久化

Files:
- 修改：src/components/AIInterview/index.tsx

- [ ] 2.4.1. 新增 draft key 工具与读写函数（写在组件文件顶部 export default 之前）

```typescript
const DRAFT_KEY_CREATE = 'ai-interview-draft-create'
const draftKeyEnrich = (tripId: string) => `ai-interview-draft-enrich-${tripId}`

interface CreateDraft { stepIdx: number; answers: CreateAnswers }
interface EnrichDraft { answers: InterviewAnswers }

function readDraft<T>(key: string): T | null {
  try {
    const v = Taro.getStorageSync(key)
    return v ? (v as T) : null
  } catch {
    return null
  }
}
function writeDraft(key: string, value: unknown): void {
  try { Taro.setStorageSync(key, value) } catch { /* storage full, ignore */ }
}
function clearDraft(key: string): void {
  try { Taro.removeStorageSync(key) } catch { /* ignore */ }
}

export { DRAFT_KEY_CREATE, draftKeyEnrich, clearDraft }
```

- [ ] 2.4.2. mount 时回填 draft

替换 Task 3 中 useEffect 内的初始化逻辑：

```typescript
useEffect(() => {
  if (!open) return
  if (isCreate) {
    const d = readDraft<CreateDraft>(DRAFT_KEY_CREATE)
    if (d) {
      setAnswers(d.answers)
      setStepIdx(Math.min(d.stepIdx, CREATE_STEPS.length - 1))
    } else {
      setAnswers(emptyCreateAnswers())
      setStepIdx(0)
    }
  } else {
    const key = tripId ? draftKeyEnrich(tripId) : ''
    const d = key ? readDraft<EnrichDraft>(key) : null
    setEnrichAnswers(d?.answers ?? {})
    setStepIdx(0)
  }
  setTextBuf('')
}, [open, isCreate, tripId])
```

- [ ] 2.4.3. 每次 answers / stepIdx 变化时写回 draft

```typescript
useEffect(() => {
  if (!open) return
  if (isCreate) {
    writeDraft(DRAFT_KEY_CREATE, { stepIdx, answers } satisfies CreateDraft)
  } else if (tripId) {
    writeDraft(draftKeyEnrich(tripId), { answers: enrichAnswers } satisfies EnrichDraft)
  }
}, [open, isCreate, tripId, stepIdx, answers, enrichAnswers])
```

- [ ] 2.4.4. 验证

`npm run dev:weapp`，临时挂载 AIInterview，走到第 3 步关闭 sheet，重新打开 → 应回到第 3 步并保留前 2 步答案。验证后撤回测试改动。

- [ ] 2.4.5. Commit

```bash
git add src/components/AIInterview/index.tsx
git commit -m "feat(ai-interview): persist drafts across close/reopen for both modes"
```

---

### 2.5. Task 5：AIInterview RootPortal 锚定

Files:
- 修改：src/components/AIInterview/index.tsx

- [ ] 2.5.1. 把 return 的最外层 `<View className='aiv-mask'>` 包到 `<RootPortal>` 内

```typescript
return (
  <RootPortal>
    <View className='aiv-mask theme-tokens' onClick={onClose}>
      {/* ...原内容不变 */}
    </View>
  </RootPortal>
)
```

确保 `import { ... , RootPortal } from '@tarojs/components'` 已存在（Task 2 已加）。

- [ ] 2.5.2. 验证

`npm run dev:weapp` → 首页向下滚动到底部 → 临时挂一个 AIInterview 触发器 → sheet 应从视口底部滑入，而非文档底部。验证后撤回测试触发器。

- [ ] 2.5.3. Commit

```bash
git add src/components/AIInterview/index.tsx
git commit -m "fix(ai-interview): wrap sheet in RootPortal to anchor to viewport"
```

---

### 2.6. Task 6：其余 6 个 sheet 统一 RootPortal 包裹

> **⚠️ 强制要求：RootPortal 主题作用域重建**
> RootPortal 把节点挂到页面根之外，逃出了页面 `theme-tokens theme-xxx` 容器的作用域，
> 导致 mask 内所有 `var(--surface)` / `var(--ink)` / `var(--accent)` 等 CSS 变量解析失败。
> **每个 RootPortal 包裹的 sheet，必须在 mask 元素上重新声明主题 class：**
> ```tsx
> const { theme } = useTheme()
> <View className={`xxx-mask theme-tokens theme-${theme}`} …>
> ```
> 参考 TemplateImport 和 EditSpotSheet 的做法。此模式适用于所有 RootPortal sheet。

Files:
- 修改：src/components/AILoadingTheater/index.tsx
- 修改：src/components/TripActionSheet/index.tsx
- 修改：src/components/CollaboratorsSheet/index.tsx
- 修改：src/components/CoverPicker/index.tsx
- 修改：src/components/ShareTypeSheet/index.tsx
- 修改：src/components/AIPlanPreview/index.tsx

每个文件按相同模式改造：

- [ ] 2.6.1. AILoadingTheater：在 `import` 中加 `RootPortal`；把 `return (<View className='ait-mask' …>` 改为 `return (<RootPortal><View className='ait-mask' …></View></RootPortal>)`

```typescript
import { View, Text, RootPortal } from '@tarojs/components'
import { useTheme } from '../../store/theme-store'
// ...
const { theme } = useTheme()
return (
  <RootPortal>
    <View className={`ait-mask theme-tokens theme-${theme}`}>
      {/* 原 sheet 内容 */}
    </View>
  </RootPortal>
)
```

- [ ] 2.6.2. TripActionSheet：同上模式（用 `tas-mask` 等当前 className）。

- [ ] 2.6.3. CollaboratorsSheet：同上。

- [ ] 2.6.4. CoverPicker：同上。

- [ ] 2.6.5. ShareTypeSheet：同上。

- [ ] 2.6.6. AIPlanPreview：同上。

- [ ] 2.6.7. 验证

`npm run dev:weapp` → trip 页向下滚 → 依次触发 TripActionSheet（长按封面 / 操作菜单入口）、CollaboratorsSheet、CoverPicker、ShareTypeSheet。每个 sheet 都应贴视口底部弹出，不在文档底部。

- [ ] 2.6.8. Commit

```bash
git add src/components/AILoadingTheater/ src/components/TripActionSheet/ src/components/CollaboratorsSheet/ src/components/CoverPicker/ src/components/ShareTypeSheet/ src/components/AIPlanPreview/
git commit -m "fix(sheets): wrap remaining 6 sheets in RootPortal for viewport anchoring"
```

---

### 2.7. Task 7：utils/ai-task.ts 新增 createTripAndFireAI

Files:
- 修改：src/utils/ai-task.ts

- [ ] 2.7.1. 在文件顶部追加 import

```typescript
import { createTrip, updateTrip } from './db'
import { buildNewTrip } from './trip-helpers'
import type { Destination } from '../types/trip'
```

- [ ] 2.7.2. 在文件末尾追加新工具

```typescript
export interface CreateAITripInput {
  destinations: Destination[]
  startDate: string
  endDate: string
  pax: number
  name?: string
  ownerOpenid: string
  ownerNickname: string
  ownerAvatarUrl: string
}

const DRAFT_KEY_CREATE = 'ai-interview-draft-create'

/**
 * 首页 AI 创建一体化：buildNewTrip → createTrip → 落 aiTaskId+aiStatus → fireAITask → 清 create 草稿
 * 返回新 tripId
 */
export async function createTripAndFireAI(
  input: CreateAITripInput,
  preferences: AIPreferences,
): Promise<string> {
  const displayName = input.name?.trim() || 'AI 生成中…'
  const draft = buildNewTrip({
    name: displayName,
    pax: input.pax,
    startDate: input.startDate,
    endDate: input.endDate,
    destinations: input.destinations,
  })
  draft.ownerOpenid = input.ownerOpenid
  draft.ownerNickname = input.ownerNickname
  draft.ownerAvatarUrl = input.ownerAvatarUrl

  const tripId = await createTrip(draft)
  const taskId = newAITaskId()

  await updateTrip(
    tripId,
    { aiTaskId: taskId, aiStatus: 'generating', aiDraft: null, aiError: null },
    input.ownerOpenid,
  )

  fireAITask(taskId, {
    tripId,
    tripContext: {
      name: displayName,
      destinations: input.destinations,
      startDate: input.startDate,
      endDate: input.endDate,
      pax: input.pax,
    },
    preferences,
  })

  try { Taro.removeStorageSync(DRAFT_KEY_CREATE) } catch { /* ignore */ }
  return tripId
}
```

- [ ] 2.7.3. 验证：保存后 `npm run dev:weapp` 编译通过，类型无 error。

- [ ] 2.7.4. Commit

```bash
git add src/utils/ai-task.ts
git commit -m "feat(ai-task): add createTripAndFireAI helper for home-direct AI flow"
```

---

### 2.8. Task 8：home 分发器接入 AIInterview

Files:
- 修改：src/pages/home/index.tsx

- [ ] 2.8.1. 在 home/index.tsx 顶部增加 import

```typescript
import AIInterview, { type AIInterviewSubmit } from '../../components/AIInterview'
import { createTripAndFireAI } from '../../utils/ai-task'
import Taro from '@tarojs/taro'
import { useMe } from '../../store/me-store'
```

（按当前 home/index.tsx 已有 import 调整，不要重复声明）

- [ ] 2.8.2. 在 Home 函数体中新增 interviewOpen state 与 me

```typescript
const [interviewOpen, setInterviewOpen] = useState(false)
const { me } = useMe()
```

- [ ] 2.8.3. 新增 handleAiCreate

```typescript
const handleAiCreate = async (data: AIInterviewSubmit) => {
  if (data.mode !== 'create') return
  if (!me?.openid) {
    Taro.showToast({ title: '请先登录', icon: 'none' })
    return
  }
  Taro.showLoading({ title: '准备中…' })
  try {
    const tripId = await createTripAndFireAI(
      {
        destinations: data.destinations,
        startDate: data.startDate,
        endDate: data.endDate,
        pax: data.pax,
        name: data.name,
        ownerOpenid: me.openid,
        ownerNickname: me.nickname || '行迹旅人',
        ownerAvatarUrl: me.avatarUrl || '',
      },
      data.preferences,
    )
    Taro.hideLoading()
    Taro.showToast({ title: 'AI 正在生成…', icon: 'none', duration: 1000 })
    setTimeout(() => Taro.redirectTo({ url: `/pages/trip/index?id=${tripId}` }), 500)
  } catch (e) {
    Taro.hideLoading()
    console.warn('[handleAiCreate]', e)
    Taro.showToast({ title: 'AI 启动失败', icon: 'none' })
  }
}
```

- [ ] 2.8.4. 修改原 `onAITrip` 透传给 4 主题子组件的实现

把现有「跳 new-trip?openAI=1」改为：

```typescript
const onAITrip = () => setInterviewOpen(true)
```

（具体替换位置：home/index.tsx 中给 HomeTegami / HomeMagazine / HomePostcard / HomeMinimal 的 `onAITrip` prop 来源）

- [ ] 2.8.5. 在 home 分发器 return 中追加 AIInterview 渲染

```tsx
<AIInterview
  open={interviewOpen}
  mode='create'
  onClose={() => setInterviewOpen(false)}
  onSubmit={(data) => {
    if (data.mode !== 'create') return
    setInterviewOpen(false)
    void handleAiCreate(data)
  }}
/>
```

- [ ] 2.8.6. 验证

`npm run dev:weapp` → 首页点 AI CTA → AIInterview 直接弹出 → 走完 5 步 → 跳到 trip 页且 aiStatus='generating'。

- [ ] 2.8.7. Commit

```bash
git add src/pages/home/index.tsx
git commit -m "feat(home): launch AIInterview directly from home AI CTA"
```

---

### 2.9. Task 9：new-trip 页清理 AI 入口

Files:
- 修改：src/pages/new-trip/index.tsx

- [ ] 2.9.1. 删除 AI 相关 import

删除以下行：

```typescript
import AIInterview from '../../components/AIInterview'
import type { AIPreferences } from '../../types/trip'  // 若仅用于 AI，则一并删
import { newAITaskId, fireAITask } from '../../utils/ai-task'
import { useRouter } from '@tarojs/taro'  // 仅在 openAI 监听用到则一并删
```

确保 `Taro` 与其他被保留逻辑仍使用的 import 不被删除。

- [ ] 2.9.2. 删除 state 与 useEffect

```typescript
// 删除
const [interviewOpen, setInterviewOpen] = useState(false)
const router = useRouter()
useEffect(() => {
  if (router.params?.openAI === '1') { setInterviewOpen(true) }
}, [router.params])
```

- [ ] 2.9.3. 删除 handleAiSubmit 整个函数。

- [ ] 2.9.4. 删除底部 nt-submit-ai 按钮与 `<AIInterview … />` 渲染段

```tsx
{/* 删除 */}
<Button className='nt-submit-ai' disabled={!canSubmit} onClick={() => setInterviewOpen(true)}>
  ✨ AI 帮我规划
</Button>
{/* 删除 */}
<AIInterview ... />
```

- [ ] 2.9.5. 简化底部按钮行（保留「取消 + 创建」两个按钮）

最终底部应为：

```tsx
<View className='nt-foot'>
  <View className='nt-row-btns'>
    <Button className='nt-cancel' onClick={() => Taro.navigateBack()}>取消</Button>
    <Button className='nt-submit' disabled={!canSubmit || submitting} onClick={submit}>
      {submitting ? '创建中...' : '创建'}
    </Button>
  </View>
</View>
```

- [ ] 2.9.6. 验证

`npm run dev:weapp` → 4 主题切换 + 进入 new-trip 页 → 底部应只有「取消 / 创建」，无 AI 按钮；构造 URL 加 `?openAI=1` → 不再触发 AI sheet。

- [ ] 2.9.7. Commit

```bash
git add src/pages/new-trip/index.tsx
git commit -m "refactor(new-trip): remove AI entry (moved to home direct flow)"
```

---

### 2.10. Task 10：TripAIStatusBar 重写为内联三态

Files:
- 修改：src/components/TripAIStatusBar/index.tsx
- 修改：src/components/TripAIStatusBar/index.scss

- [ ] 2.10.1. 重写 index.tsx 为纯内联三态组件

```typescript
import { View, Text } from '@tarojs/components'
import SparkleIcon from '../SparkleIcon'
import './index.scss'

export type TripAIStatusBarStatus = 'generating' | 'ready' | 'error'

interface Props {
  status: TripAIStatusBarStatus
  onTap: () => void
}

const CONFIG: Record<TripAIStatusBarStatus, { text: string; cls: string }> = {
  generating: { text: 'AI 正在为你编排…',     cls: 'taisb--generating' },
  ready:      { text: 'AI 草稿就绪 · 点击查看', cls: 'taisb--ready' },
  error:      { text: 'AI 生成失败 · 点击重试', cls: 'taisb--error' },
}

export default function TripAIStatusBar({ status, onTap }: Props) {
  const c = CONFIG[status]
  return (
    <View className={`taisb ${c.cls}`} onClick={onTap}>
      {status === 'generating' && <View className='taisb-shine' />}
      <SparkleIcon size={22} className='taisb-icon' />
      <Text className='taisb-text'>{c.text}</Text>
      {status === 'generating' && (
        <View className='taisb-dots'>
          <View className='taisb-dot' />
          <View className='taisb-dot' />
          <View className='taisb-dot' />
        </View>
      )}
      {status === 'ready' && <Text className='taisb-arrow'>›</Text>}
    </View>
  )
}
```

- [ ] 2.10.2. 重写 index.scss：去掉 `position: fixed` 与相关 `bottom`/`left`/`right`/`z-index`，改为常规块级容器

按 Task 1 的 frontend-design 稿落地 4 主题×3 状态。骨架结构（具体 token 由稿决定）：

```scss
.taisb {
  display: flex;
  align-items: center;
  padding: 20rpx 28rpx;
  border-radius: 16rpx;
  margin: 16rpx 0;
  background: var(--ai-row-bg);
  color: var(--ai-row-fg);

  .taisb-icon { margin-right: 16rpx; }
  .taisb-text { flex: 1; font-size: 28rpx; }
  .taisb-arrow { color: var(--ai-row-arrow); font-size: 36rpx; }

  &.taisb--generating { /* shine 动画 token */ }
  &.taisb--ready { background: var(--ai-row-bg-ready); }
  &.taisb--error { background: var(--ai-row-bg-error); color: var(--ai-row-fg-error); }
}

/* 4 主题 hooks，覆盖 token，不在此重复声明结构 */
.theme-tegami   .taisb { /* 信封折角等装饰 */ }
.theme-magazine .taisb { /* 报头横线等 */ }
.theme-postcard .taisb { /* 椭圆戳轮廓 */ }
.theme-minimal  .taisb { /* hairline */ }
```

具体填充以 docs/superpowers/frontend-design/2026-05-27-ai-status-visual.md 为准。

- [ ] 2.10.3. 验证：保存后编译通过；trip 页旧引用点（Task 11 会改）暂时可能 TS 报错 prop 名变了 → 这是预期的，会在 Task 11 修复。

- [ ] 2.10.4. Commit

```bash
git add src/components/TripAIStatusBar/
git commit -m "refactor(trip-ai-status-bar): rewrite as inline 3-state component"
```

---

### 2.11. Task 11：trip 页接入内联条 + 草稿清理

Files:
- 修改：src/pages/trip/index.tsx

- [ ] 2.11.1. import 调整

```typescript
import TripAIStatusBar, { type TripAIStatusBarStatus } from '../../components/TripAIStatusBar'
import { draftKeyEnrich, clearDraft } from '../../components/AIInterview'
```

（如 AIInterview 未 re-export `clearDraft` / `draftKeyEnrich`，从 Task 4 文件确认；如未导出，改为：直接 `Taro.removeStorageSync(\`ai-interview-draft-enrich-${tripId}\`)`，避免新增 export 表面积）

- [ ] 2.11.2. 删除旧浮动 TripAIStatusBar 渲染段（用 grep 定位当前 `<TripAIStatusBar` 旧用法并替换）

- [ ] 2.11.3. 在攻略 tab 渲染段顶部插入内联条

定位 `activeTab === 'plan'` 渲染分支内、日期 chips 之上，加入：

```tsx
{t.aiStatus && (
  <TripAIStatusBar
    status={t.aiStatus as TripAIStatusBarStatus}
    onTap={handleInlineBarTap}
  />
)}
```

注意：`t.aiStatus` 取值集合 `generating | ready | error | null`。这里只在非 null 时渲染。

- [ ] 2.11.4. 新增 handleInlineBarTap

```typescript
const handleInlineBarTap = () => {
  if (!t || !isOwner) return
  if (t.aiStatus === 'generating') {
    setTheaterMinimized(false)
  } else if (t.aiStatus === 'ready') {
    setAiPreviewOpen(true)
  } else if (t.aiStatus === 'error') {
    setAiFormOpen(true)
  }
}
```

（state 名按 trip/index.tsx 当前实现对齐；若旧名为 aiInterviewOpen，则用 aiInterviewOpen）

- [ ] 2.11.5. apply / discard 清 enrich 草稿

在现有 `handlePreviewApply` 与 `handlePreviewDiscard` 函数末尾各加：

```typescript
if (t?._id) {
  try { Taro.removeStorageSync(`ai-interview-draft-enrich-${t._id}`) } catch { /* ignore */ }
}
```

- [ ] 2.11.6. enrich 模式触发 AIInterview 时把 tripId 传入

定位现有 AIInterview 引用（trip 页内），改为：

```tsx
<AIInterview
  open={aiFormOpen}
  mode='enrich'
  tripId={t?._id}
  onClose={() => setAiFormOpen(false)}
  onSubmit={(data) => {
    if (data.mode !== 'enrich') return
    setAiFormOpen(false)
    void handleAiRetry(data.preferences)
  }}
/>
```

`handleAiRetry` 沿用现有 enrich 触发函数名（按当前 trip/index.tsx 实际命名调整）。

- [ ] 2.11.7. 验证

`npm run dev:weapp` →
1) home AI 走完 → 跳 trip → 攻略 tab 顶部出现 generating 内联条 + Theater 自动弹起。
2) Theater 点 × 最小化 → Theater 消失但内联条仍显示 generating。
3) 等待 ready → 内联条变 ready 文案 → Preview 自动弹起；关闭 Preview → 点击内联条重弹 Preview。
4) 切到其他 tab → 内联条消失（仅在 plan tab 渲染）。
5) trip aiStatus 为 null 时 → 攻略 tab 顶部无任何空白占位。

- [ ] 2.11.8. Commit

```bash
git add src/pages/trip/index.tsx
git commit -m "feat(trip): integrate inline TripAIStatusBar with 3-state machine"
```

---

### 2.12. Task 12：HomeCardAIRow 视觉 4 主题×3 状态

Files:
- 修改：src/components/HomeCardAIRow/index.tsx
- 修改：src/components/HomeCardAIRow/index.scss

- [ ] 2.12.1. index.tsx 按 frontend-design 稿微调 DOM（保持现有 status/hint/onTap props 不动）

参照 Task 1 产出的视觉规格，若某主题需要额外 hook 节点（如 tegami 的信封折角），加在 root 内：

```tsx
<View className={`hc-ai ${c.cls}`} onClick={...}>
  <View className='hc-ai-deco' />   {/* 主题装饰位，CSS 控制可见性 */}
  {status === 'generating' && <View className='hc-ai-shine' />}
  <SparkleIcon size={22} className='hc-ai-icon' />
  <Text className='hc-ai-text'>{c.text}{hint ? ` · ${hint}` : ''}</Text>
  {status === 'generating' && (
    <View className='hc-ai-dots'>
      <View className='hc-ai-dot' /><View className='hc-ai-dot' /><View className='hc-ai-dot' />
    </View>
  )}
  {status === 'ready' && <Text className='hc-ai-arrow'>›</Text>}
</View>
```

`hc-ai-deco` 默认 `display: none`，各主题 SCSS 单独显示。

- [ ] 2.12.2. index.scss 按 frontend-design 稿重写

骨架同 TripAIStatusBar（Task 10）。4 主题×3 状态的具体 token 值从 docs/superpowers/frontend-design/2026-05-27-ai-status-visual.md 复制。

- [ ] 2.12.3. 验证

`npm run dev:weapp` → 切 4 主题，模拟 generating/ready/error（可在 trip-store 中临时手改一条 trip 的 aiStatus）→ 每主题视觉应符合设计稿。

- [ ] 2.12.4. Commit

```bash
git add src/components/HomeCardAIRow/
git commit -m "feat(home-card-ai-row): theme-specific visuals for 4 themes × 3 states"
```

---

### 2.13. Task 13：HomePostcard 与 HomeMagazine 渲染范围扩展

Files:
- 修改：src/pages/home/HomePostcard.tsx
- 修改：src/pages/home/HomeMagazine.tsx

- [ ] 2.13.1. HomePostcard：在每张印章卡片 DOM 之后插入 HomeCardAIRow

定位 `trips.map((trip) => ( … ))` 块，每个 trip item 渲染末尾追加：

```tsx
{trip.aiStatus && (
  <HomeCardAIRow
    status={trip.aiStatus === 'generating' ? 'thinking' : trip.aiStatus}
    onTap={() => onOpenTrip(trip)}
  />
)}
```

确保 `import HomeCardAIRow from '../../components/HomeCardAIRow'` 已存在；若 HomeCardAIRow 的状态枚举不接 generating（而用 thinking），按上方映射；否则直接传 `trip.aiStatus`。

- [ ] 2.13.2. HomeMagazine：把 `featAI && <HomeCardAIRow … />` 仅 featured 的逻辑改为「所有 trip 都渲染」

定位现有 `featAI` 判断，把渲染移动到非 featured 循环内，每张卡片下方都按 `trip.aiStatus` 渲染 HomeCardAIRow。featured 卡的渲染保留（视觉位置由 design 稿决定）。

- [ ] 2.13.3. 验证

`npm run dev:weapp` →
1) 切 postcard 主题，构造 generating/ready/error 三态 → 每张印章下方应显示 HomeCardAIRow，印章本体的 aiglow / ✓ 保留。
2) 切 magazine 主题，多于 1 个 trip 时非 featured 卡也显示 HomeCardAIRow。

- [ ] 2.13.4. Commit

```bash
git add src/pages/home/HomePostcard.tsx src/pages/home/HomeMagazine.tsx
git commit -m "feat(home): extend HomeCardAIRow to postcard cards and magazine non-featured cards"
```

---

### 2.14. Task 14：AILoadingTheater 字幕节奏

Files:
- 修改：src/components/AILoadingTheater/index.tsx

- [ ] 2.14.1. 删除原 STREAM_MESSAGES 常量，替换为 PHASES

```typescript
const PHASES: ReadonlyArray<ReadonlyArray<string>> = [
  ['正在阅读你的偏好…', '理解你的旅行节奏…'],
  ['搜索目的地周边亮点…', '查阅当季节庆与限定活动…', '匹配你品味的小众场所…'],
  ['为你规划最优路线…', '权衡步行与公共交通…', '避开堵车与排队高峰…'],
  ['估算每日开销…', '挑选性价比餐厅…'],
  ['排版每日行程卡…', '为你写下攻略简介…', '正在为你编排成册…'],
] as const

function flatten(): string[] {
  const out: string[] = []
  for (const p of PHASES) for (const s of p) out.push(s)
  return out
}

const FLAT_MESSAGES = flatten()
const LAST_IDX = FLAT_MESSAGES.length - 1
```

- [ ] 2.14.2. 替换原 useEffect 字幕轮播

```typescript
useEffect(() => {
  if (!open || status !== 'thinking') return
  let idx = 0
  setStreamText(FLAT_MESSAGES[0])
  let timer: ReturnType<typeof setTimeout> | null = null

  const schedule = () => {
    if (idx >= LAST_IDX) return // 停在最后一条
    const delay = 2400 + Math.floor(Math.random() * 1200)
    timer = setTimeout(() => {
      idx += 1
      setStreamText(FLAT_MESSAGES[idx])
      schedule()
    }, delay)
  }
  schedule()
  return () => { if (timer) clearTimeout(timer) }
}, [open, status])
```

- [ ] 2.14.3. 验证

`npm run dev:weapp` → 触发 AI 流程让 Theater 弹起，观察 30 秒：字幕推进 8–12 次，间隔 2.4–3.6 秒不固定，停在「正在为你编排成册…」后不再变。

- [ ] 2.14.4. Commit

```bash
git add src/components/AILoadingTheater/index.tsx
git commit -m "feat(ai-loading-theater): phased subtitle with randomized cadence, no loop"
```

---

### 2.15. Task 15：云函数 ai-plan-trip 主 prompt 调整

Files:
- 修改：cloudfunctions/ai-plan-trip/index.js

- [ ] 2.15.1. 在云函数入口允许空 destinations + 接收 userProvidedName

定位云函数当前对 `event.tripContext.destinations` 与 `event.tripContext.name` 的校验/拼接位置，在拼 prompt 之前加入分支：

```javascript
const dests = Array.isArray(event.tripContext?.destinations) ? event.tripContext.destinations : []
const userProvidedName = (event.tripContext?.name || '').trim()
const isAINameMode = !userProvidedName || userProvidedName === 'AI 生成中…'
const isAIDestMode = dests.length === 0
```

- [ ] 2.15.2. 主 prompt 拼装按分支

```javascript
let promptExtra = ''
if (isAIDestMode) {
  promptExtra += '\n用户未填写目的地，请基于 preferences / 日期 / 人数推荐 1-3 个具体目的地（含中文名 + 国家/城市），写入返回 JSON 的 `recommendedDestinations` 字段；同时按推荐目的地生成 `days`。以一个主目的地为主，可加 1-2 个邻近顺路点。'
}
if (isAINameMode) {
  promptExtra += '\n用户未指定攻略名，请在返回 JSON 中加入简短的 `name` 字段（不超过 16 字，含主目的地与季节/天数）。'
}
// 将 promptExtra 拼到现有 systemPrompt 或 userPrompt 末尾
```

- [ ] 2.15.3. 扩展返回 JSON schema 描述（在 prompt 内告诉模型期望字段）

```javascript
const schemaHint = `
返回 JSON 必须包含：
  - days: [...]                 // 必有
  - name: string                // 仅当用户未填攻略名时返回
  - recommendedDestinations: [  // 仅当用户未填目的地时返回
      { name: string, country: string, city: string }
    ]
`
// 拼到 prompt 末尾
```

- [ ] 2.15.4. 在解析 LLM 返回时把 `name` 与 `recommendedDestinations` 一起写入 aiDraft

```javascript
const draft = {
  days: parsed.days,
  name: parsed.name || undefined,
  recommendedDestinations: parsed.recommendedDestinations || undefined,
}
// 后续 updateTrip 把 draft 写到 trip.aiDraft
```

- [ ] 2.15.5. 验证（开发期）

部署云函数 → 在 home 走 AI 创建：
1) 不填目的地 → 云函数返回应含 `recommendedDestinations`
2) 不填攻略名 → 云函数返回应含 `name`
3) 用云开发控制台日志确认 prompt 中含 promptExtra 文案

- [ ] 2.15.6. Commit

```bash
git add cloudfunctions/ai-plan-trip/index.js
git commit -m "feat(ai-plan-trip): support empty destinations + AI name in main prompt"
```

---

### 2.16. Task 16：云函数 ai-plan-trip destinations 重试机制

Files:
- 修改：cloudfunctions/ai-plan-trip/index.js

- [ ] 2.16.1. 在主调用完成后插入重试分支

```javascript
async function fetchDestinationsOnly({ days, name, preferences, pax }, callLLM) {
  const summary = days.map((d) => ({ date: d.date, title: d.title })).slice(0, 12)
  const retryPrompt = `这是已生成的攻略概要：
${JSON.stringify(summary)}
名称：${name || '（待定）'}
偏好：${JSON.stringify(preferences)}
人数：${pax}

请基于此推断 1-3 个最匹配的具体目的地（中文名 + 国家/城市），仅返回 JSON：
{ "destinations": [ { "name": string, "country": string, "city": string } ] }
不要返回其他字段，不要重新生成攻略。`
  const raw = await callLLM(retryPrompt)
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed.destinations) && parsed.destinations.length > 0) {
      return parsed.destinations
    }
  } catch { /* fall through */ }
  return []
}
```

- [ ] 2.16.2. 主流程串入重试

```javascript
if (isAIDestMode) {
  let recommended = parsed.recommendedDestinations
  if (!Array.isArray(recommended) || recommended.length === 0) {
    for (let i = 0; i < 3; i++) {
      console.log(`[ai-plan-trip] destinations retry #${i + 1}`)
      const got = await fetchDestinationsOnly(
        { days: parsed.days, name: parsed.name, preferences: event.preferences, pax: event.tripContext.pax },
        callLLM,
      )
      if (got.length > 0) { recommended = got; break }
    }
  }
  if (!recommended || recommended.length === 0) {
    // 全部失败，落 error
    await db.collection('trips').doc(event.tripId).update({
      data: { aiStatus: 'error', aiError: 'AI 未能推荐目的地，请稍后重试或手动添加', aiDraft: null },
    })
    return { ok: false, error: 'no_destinations' }
  }
  draft.recommendedDestinations = recommended
}
```

- [ ] 2.16.3. 验证

人为 mock：临时把主 prompt 改为故意让 `recommendedDestinations` 不出现 → 部署 → 触发流程 → 云开发日志应见 3 次 retry 日志；若 mock 也让 retry 全空 → trip.aiStatus 应为 'error'。验证后还原 mock。

- [ ] 2.16.4. Commit

```bash
git add cloudfunctions/ai-plan-trip/index.js
git commit -m "feat(ai-plan-trip): retry destinations with focused prompt up to 3 times"
```

---

### 2.17. Task 17：apply 阶段 name / destinations 合并

Files:
- 新增：src/utils/ai-apply.ts
- 修改：src/pages/trip/index.tsx（handlePreviewApply 内调用）

- [ ] 2.17.1. 新增 src/utils/ai-apply.ts

```typescript
import type { Trip, Destination, GeneratedPlan } from '../types/trip'

interface AIDraftLite extends GeneratedPlan {
  name?: string
  recommendedDestinations?: Destination[]
}

export function mergeAIDraft(trip: Trip, draft: AIDraftLite): Partial<Trip> {
  const patch: Partial<Trip> = {
    days: draft.days,
  }
  if ((!trip.destinations || trip.destinations.length === 0) &&
      Array.isArray(draft.recommendedDestinations) &&
      draft.recommendedDestinations.length > 0) {
    patch.destinations = draft.recommendedDestinations
  }
  const isPlaceholderName = !trip.name || trip.name === 'AI 生成中…'
  if (isPlaceholderName && draft.name) {
    patch.name = draft.name
  } else if (isPlaceholderName && !draft.name) {
    patch.name = '未命名攻略'
  }
  return patch
}
```

- [ ] 2.17.2. 在 trip/index.tsx 的 handlePreviewApply 内使用

定位现有 apply 逻辑（大致是 `updateTrip(tripId, { days: aiDraft.days, aiStatus: null, aiDraft: null })` 形式），改为：

```typescript
import { mergeAIDraft } from '../../utils/ai-apply'
// ...
const patch = mergeAIDraft(t, t.aiDraft as never)
await updateTrip(t._id, { ...patch, aiStatus: null, aiDraft: null, aiError: null }, openid)
```

- [ ] 2.17.3. 验证

走 A2 分支（首页 AI、跳过目的地与攻略名）→ apply 后：
- trip.name 等于云函数返回的 `name`
- trip.destinations 等于云函数返回的 `recommendedDestinations`
- thinking 期间首页/trip 标题展示 "AI 生成中…" 占位

- [ ] 2.17.4. Commit

```bash
git add src/utils/ai-apply.ts src/pages/trip/index.tsx
git commit -m "feat(ai-apply): merge AI name and recommended destinations on apply"
```

---

### 2.18. Task 18：验收冒烟矩阵

Files:
- 仅人工验证，不改代码

- [ ] 2.18.1. A1 首页 AI 完整流（含目的地、含攻略名）→ apply 后 trip.name/destinations 与用户输入一致，days 来自 AI。

- [ ] 2.18.2. A2 推荐目的地 + AI 攻略名分支 → apply 后两者均来自云函数返回。

- [ ] 2.18.3. A3 trip 页 enrich 分支 → 只走偏好步骤，destinations/dates/pax 不变。

- [ ] 2.18.4. A4 Theater 最小化 → 内联条仍在攻略 tab 顶部显示 generating。

- [ ] 2.18.5. A5 ready 态：关闭 Preview → 内联条变 "AI 草稿就绪 · 点击查看" → 点击重弹 Preview。

- [ ] 2.18.6. A6 error 态点击 → 弹 AIInterview enrich 模式，preferences 字段回填上次填写。

- [ ] 2.18.7. A7 AIInterview sheet：首页滚到底部触发 → sheet 贴视口底部。

- [ ] 2.18.8. A7b 其余 6 个 sheet：在非顶部滚动位置依次触发 AILoadingTheater / TripActionSheet / CollaboratorsSheet / CoverPicker / ShareTypeSheet / AIPlanPreview → 全部贴视口底部。

- [ ] 2.18.9. A7c aiStatus=null 时 trip 攻略 tab 顶部无内联条占位空白。

- [ ] 2.18.10. A8 字幕节奏：Theater 打开 30 秒 → 字幕变化 8–12 次、节奏不固定、停在最后一条不循环。

- [ ] 2.18.11. A9 4 主题×3 状态视觉：HomeCardAIRow / TripAIStatusBar 与设计稿吻合。

- [ ] 2.18.12. A10 草稿回填（create）：走到步骤 4 关闭 sheet → 再次打开应回到步骤 4。

- [ ] 2.18.13. A11 草稿回填（enrich）：trip 页 AI 填几条偏好停止 → 再点 AIBadge → 已填字段保留。

- [ ] 2.18.14. A12 成功 apply 后再次首页 AI CTA → 5 步从空白开始（create 草稿已清空）。

- [ ] 2.18.15. A13 4 主题 new-trip 页底部仅「取消 / 创建」，URL openAI=1 不再触发 AI sheet。

- [ ] 2.18.16. A14 云函数 destinations 全空 3 次 → trip.aiStatus='error'，前端展示 error 态。

- [ ] 2.18.17. A15 Magazine 主题多卡片 → 非 featured 卡也显示 HomeCardAIRow。

- [ ] 2.18.18. A16 Postcard 主题 → 印章 aiglow 保留，下方新增 HomeCardAIRow 文字。

- [ ] 2.18.19. 完成所有 A 项后建 PR

```bash
git checkout -b feat/subproject-a-ai-flow
git push -u origin feat/subproject-a-ai-flow
gh pr create --title "feat(ai): subproject A · AI flow & status redesign" --body "$(cat <<'EOF'
## Summary
- 首页 AI CTA 改为直接拉起 AIInterview（5 步问卷，目的地/攻略名可选）
- TripAIStatusBar 重构为内联三态常驻条；aiStatus 为 null 时不占位
- HomeCardAIRow 4 主题×3 状态视觉差异化；HomePostcard / HomeMagazine 渲染范围扩展
- AILoadingTheater 字幕改 5 阶段、2.4-3.6s 随机、不循环
- 云函数 ai-plan-trip 支持空目的地 + AI 智能命名，destinations 兜底 3 次重试
- 7 个底部 sheet 统一用 RootPortal 锚定视口
- new-trip 页清理 AI 入口

## Test plan
- [ ] A1-A16 全量人工冒烟（见 plan 2.18 节）
EOF
)"
```

---

## 3. 自审清单

3.1. Spec § 1.1 首页直拉 AIInterview → Task 8 ✓

3.2. Spec § 1.2 空目的地 / 攻略名 AI 补全 → Task 15 + Task 17 ✓

3.3. Spec § 1.3 四主题 3 态可视化 → Task 1（设计）+ Task 10（TripAIStatusBar）+ Task 12（HomeCardAIRow）+ Task 13（渲染扩展） ✓

3.4. Spec § 1.4 字幕节奏 → Task 14 ✓

3.5. Spec § 1.5 sheet 视口锚定（含全项目 7 个） → Task 5 + Task 6 ✓

3.6. Spec § 1.6 草稿持久化 → Task 4 + Task 11.2.11.5 ✓

3.7. Spec § 5.2.5 aiStatus null 不占位 → Task 11.2.11.3 + Task 2.18.9 ✓

3.8. Spec § 5.7 createTripAndFireAI → Task 7 ✓

3.9. Spec § 5.6 new-trip 清理 → Task 9 ✓

3.10. Spec § 6.3 重试机制 token 节省 → Task 16（只传 day 标题+日期摘要） ✓

3.11. Spec § 6.4 apply 合并 → Task 17 ✓

3.12. 类型一致性：AIInterviewSubmit / TripAIStatusBarStatus / CreateAnswers 在所有调用点同名同形 ✓

3.13. 无占位词（TBD / TODO / "implement later"）：通读完毕 ✓
