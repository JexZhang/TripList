# AI 攻略生成草稿流重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 AI 生成流从"弹窗+FAB+立即应用"重构成"草稿模型"——点 AI 立刻创建攻略并跳首页，状态显示在卡片顶部状态条，用户随时进入选择应用/重新生成/舍弃。

**Architecture:** 在 `trip` 文档上加 `aiTaskId / aiStatus / aiDraft / aiError` 四个字段做状态机；云函数 task 完成时直接写 trip（防覆盖：写前比对 taskId）；前端只 watch trip 文档，不再订阅 ai_tasks；新增 `AILoadingBar` 统一渲染卡片/页面顶部状态。所有 AI UI owner-only。

**Tech Stack:** Taro + React + TypeScript, WeChat 云函数 (Node.js), 腾讯云 TCB。

**Spec reference:** [docs/superpowers/specs/2026-05-25-ai-draft-flow-design.md](../specs/2026-05-25-ai-draft-flow-design.md)

**项目无单元测试**: 验证以手动操作 + 微信开发者工具控制台为主, 关键纯函数 (如冲突天计算) 可加 console-based smoke test。

**中间 commits 编译可能短暂红**: Task 5 把 ai-task.ts 精简后, new-trip/trip 还在 import 老符号 (watchAITask 等), 需要等 Task 9-10 完成后才会编译通过。中间 Task 6-8 涉及的是新文件 / 别处文件, 不影响这条编译链, 但走完 Task 5 之后到 Task 10 之前别上微信开发者工具编译。

---

## 文件改动地图

**修改:**
- `src/types/trip.ts` — Trip 接口增加 4 个 ai 字段
- `cloudfunctions/update-trip/index.js` — 白名单加 ai 字段, 加 owner-only 校验
- `cloudfunctions/ai-plan-trip/lib/task-store.js` — 增加 `getTripLight` 助手, 删除 result null 初始化（改 {}）
- `cloudfunctions/ai-plan-trip/index.js` — 删除 progress 循环, 增加 checkCancelled, 任务终结直接写 trip
- `src/utils/ai-task.ts` — 精简, 只保留 `startAITask`
- `src/components/AIPlanPreview/index.tsx` — 增加"舍弃"按钮, 冲突天小标, 应用前确认
- `src/components/AIPlanPreview/index.scss` — 新按钮样式
- `src/pages/new-trip/index.tsx` — submit AI → createTrip + startAITask + redirect
- `src/pages/new-trip/index.scss` — 删除 AILoading/Fab 相关样式 (若有)
- `src/pages/trip/index.tsx` — 用 trip.aiStatus 驱动 UI, 自动弹 Preview, 加停止确认
- `src/pages/home/index.tsx` — 卡片顶部加 AILoadingBar (owner-only)
- `src/pages/home/index.scss` — 状态条样式

**创建:**
- `src/components/AILoadingBar/index.tsx`
- `src/components/AILoadingBar/index.scss`

**删除:**
- `src/components/AILoading/` (整个目录)
- `src/components/AITaskFab/` (整个目录)

---

## Task 1: Trip 类型增加 AI 字段

**Files:**
- Modify: `src/types/trip.ts`

- [ ] **Step 1: 在 Trip 接口末尾追加 4 个可空字段**

定位 `interface Trip { ... }`（约第 64 行），在 `packing: PackingItem[]` 之后、闭合 `}` 之前追加：

```typescript
  // === AI 草稿流字段, 都可空; 老攻略不需要迁移 ===
  aiTaskId?: string | null
  aiStatus?: 'generating' | 'ready' | 'error' | null
  aiDraft?: GeneratedPlan | null
  aiError?: string | null
```

`GeneratedPlan` 类型已在同文件存在, 无需新导入。

- [ ] **Step 2: 提交**

```bash
git add src/types/trip.ts
git commit -m "feat(types): 给 Trip 加 AI 草稿流字段"
```

---

## Task 2: update-trip 云函数白名单加 AI 字段 + owner 校验

**Files:**
- Modify: `cloudfunctions/update-trip/index.js`

- [ ] **Step 1: 加白名单字段 + AI 字段限 owner 写入**

把整个 [cloudfunctions/update-trip/index.js](../../cloudfunctions/update-trip/index.js) 替换为：

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const ALLOWED_FIELDS = [
  'name',
  'pax',
  'startDate',
  'endDate',
  'destinations',
  'days',
  'packing',
  'aiTaskId',
  'aiStatus',
  'aiDraft',
  'aiError',
]

// 这些字段只能 owner 改 (协作者不能触发/停止/应用 AI)
const OWNER_ONLY_FIELDS = new Set(['aiTaskId', 'aiStatus', 'aiDraft', 'aiError'])

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const { tripId, patch } = event || {}
  if (!tripId || !patch || typeof patch !== 'object') {
    throw new Error('tripId and patch required')
  }

  const db = cloud.database()
  const trip = await db.collection('trips').doc(tripId).get().catch(() => null)
  if (!trip || !trip.data) throw new Error('trip not found')

  const isOwner = trip.data._openid === OPENID
  const collabIds = trip.data.collaboratorOpenids || []
  const isCollab = collabIds.includes(OPENID)
  if (!isOwner && !isCollab) {
    throw new Error('forbidden: not owner or collaborator')
  }

  const cleaned = {}
  for (const k of ALLOWED_FIELDS) {
    if (patch[k] === undefined) continue
    if (OWNER_ONLY_FIELDS.has(k) && !isOwner) {
      throw new Error(`forbidden: 协作者不能修改 ${k}`)
    }
    cleaned[k] = patch[k]
  }
  cleaned.updatedAt = Date.now()
  cleaned.updatedBy = OPENID

  // aiDraft/aiTaskId/aiStatus/aiError 写 null 是有意的 (清空草稿), 直接 update 走 dot-path 没问题
  // 因为它们的字段原本就是顶层标量/对象, 不存在嵌套, 不会有上一次"result=null"那种 502001 bug
  await db.collection('trips').doc(tripId).update({ data: cleaned })
  return { ok: true }
}
```

- [ ] **Step 2: 在微信开发者工具里上传该云函数**

操作: 微信开发者工具 → 云开发 → 云函数 → 右键 `update-trip` → 上传并部署: 云端安装依赖。

- [ ] **Step 3: 提交**

```bash
git add cloudfunctions/update-trip/index.js
git commit -m "feat(update-trip): 白名单加 AI 字段, 限 owner 写入"
```

---

## Task 3: task-store 增加 getTripLight 助手, result 初始化改 {}

**Files:**
- Modify: `cloudfunctions/ai-plan-trip/lib/task-store.js`

- [ ] **Step 1: 整体替换文件**

```js
const cloud = require('wx-server-sdk')

const COL = 'ai_tasks'

async function createTask({ taskId, openid, tripId, modelAlias, tripContext, preferences }) {
  const db = cloud.database()
  const now = Date.now()
  const data = {
    _openid: openid,
    tripId: tripId || null,
    status: 'pending',
    modelAlias,
    tripContext,
    preferences,
    // 不再写 progress (前端不订阅 ai_tasks)
    result: {},  // 初始化为空对象, 避免后续 dot-path 写入 result.xxx 时 502001
    error: null,
    meta: { turns: 0 },
    createdAt: now,
    updatedAt: now,
  }
  if (taskId) data._id = taskId
  const res = await db.collection(COL).add({ data })
  return res._id
}

async function updateTask(taskId, patch) {
  const db = cloud.database()
  await db.collection(COL).doc(taskId).update({
    data: { ...patch, updatedAt: Date.now() },
  })
}

async function getTask(taskId) {
  const db = cloud.database()
  const r = await db.collection(COL).doc(taskId).get().catch(() => null)
  return r && r.data ? r.data : null
}

/** 仅读 trips 的 _id + aiTaskId, 用于 checkCancelled. 失败返回 null. */
async function getTripLight(tripId) {
  const db = cloud.database()
  const r = await db.collection('trips')
    .doc(tripId)
    .field({ _id: true, aiTaskId: true })
    .get()
    .catch(() => null)
  return r && r.data ? r.data : null
}

/** 终结写入 trip; 若 trip.aiTaskId !== myTaskId, 放弃写入 (用户已停止或重新生成). */
async function finalizeTrip(tripId, myTaskId, patch) {
  const t = await getTripLight(tripId)
  if (!t) {
    console.warn('[finalizeTrip] trip 已不存在, taskId=', myTaskId)
    return { written: false, reason: 'trip-missing' }
  }
  if (t.aiTaskId !== myTaskId) {
    console.warn('[finalizeTrip] task superseded, current trip.aiTaskId=', t.aiTaskId, 'my=', myTaskId)
    return { written: false, reason: 'superseded' }
  }
  const db = cloud.database()
  try {
    await db.collection('trips').doc(tripId).update({
      data: { ...patch, updatedAt: Date.now() },
    })
    return { written: true }
  } catch (e) {
    console.error('[finalizeTrip] update failed', e && e.message)
    return { written: false, reason: 'db-error', error: e && e.message }
  }
}

module.exports = { createTask, updateTask, getTask, getTripLight, finalizeTrip, COL }
```

- [ ] **Step 2: 提交**

```bash
git add cloudfunctions/ai-plan-trip/lib/task-store.js
git commit -m "feat(ai-plan-trip): task-store 增加 finalizeTrip/getTripLight 助手"
```

---

## Task 4: ai-plan-trip 主逻辑：删 progress 循环, 加 checkCancelled, 写 trip

**Files:**
- Modify: `cloudfunctions/ai-plan-trip/index.js`

- [ ] **Step 1: import 加 finalizeTrip / getTripLight**

定位文件头部 import 区（约第 8 行）:

```js
const { createTask, updateTask } = require('./lib/task-store')
```

替换为:

```js
const { createTask, updateTask, getTripLight, finalizeTrip } = require('./lib/task-store')
```

- [ ] **Step 2: 修改 runLoop 签名 + 加 checkCancelled 辅助函数**

两处改动 (约第 119 行附近):

A. 把函数签名行从:

```js
async function runLoop({ taskId, tripContext, preferences, previousResult, userFeedback }) {
```

改成:

```js
async function runLoop({ taskId, tripId, tripContext, preferences, previousResult, userFeedback }) {
```

B. 在函数体最上方 (`const startTs = Date.now()` 那行之前) 插入:

```js
  // 协作式取消: 用户在 trip 上把 aiTaskId 清掉 → 本次任务下一轮 LLM 调用前主动退出, 省 token
  const checkCancelled = async () => {
    if (!tripId) return  // 没绑定 trip 的任务无法 cancel (实际新流程下都有 tripId)
    const t = await getTripLight(tripId)
    if (!t || t.aiTaskId !== taskId) {
      const err = new Error('CANCELLED')
      err.cancelled = true
      throw err
    }
  }

```

- [ ] **Step 3: planMode 调用 runLoop 时传 tripId**

定位 `planMode` 末尾的 `return await runLoop(...)`（约第 115 行）:

```js
return await runLoop({ taskId, tripContext, preferences, previousResult, userFeedback })
```

替换为:

```js
return await runLoop({ taskId, tripId, tripContext, preferences, previousResult, userFeedback })
```

- [ ] **Step 4: 主循环每轮调用前插入 checkCancelled**

定位主 for 循环（约第 168 行）:

```js
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      checkSoftTimeout()
      turns++
```

在 `checkSoftTimeout()` 后加一行:

```js
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      checkSoftTimeout()
      await checkCancelled()
      turns++
```

同样在 retry 分支（约第 243 行）的 `checkSoftTimeout()` 后加:

```js
    if (!validation.ok) {
      checkSoftTimeout()
      await checkCancelled()
      // 重试 1 次, 去掉 tools + 强制 json_object
```

- [ ] **Step 5: 删除 progress 流式写入循环**

定位 (约第 267-271 行):

```js
    // 把生成结果作为 progress 增量(每天独立 update, client 能流式看到)
    for (let i = 0; i < parsed.days.length; i++) {
      const partial = { days: parsed.days.slice(0, i + 1) }
      await updateTask(taskId, { progress: partial })
    }
```

直接整段删除。

- [ ] **Step 6: 改造任务终态写入: 写 trip + 写 task**

定位 (约第 272 行):

```js
    const _ = cloud.database().command
    await updateTask(taskId, {
      status: 'done',
      // 用 _.set() 整体覆盖, 否则 SDK 会翻译成 result.days/result.summary 的 dot-path 写入,
      // 而初始 result=null 不能创建子字段 -> -502001 "Cannot create field 'days' in element {result: null}"
      result: _.set(parsed),
      meta: { elapsedMs: Date.now() - startTs, promptTokens, completionTokens, turns },
    })
    return { ok: true }
```

替换为:

```js
    // 1. 写 task done (debug 用)
    const _ = cloud.database().command
    await updateTask(taskId, {
      status: 'done',
      result: _.set(parsed),
      meta: { elapsedMs: Date.now() - startTs, promptTokens, completionTokens, turns },
    })

    // 2. 写 trip 草稿 (前端真正订阅的字段). finalizeTrip 内部会比对 aiTaskId 防覆盖
    const writeRes = await finalizeTrip(tripId, taskId, {
      aiStatus: 'ready',
      aiDraft: _.set(parsed),
      aiError: null,
    })
    if (!writeRes.written) {
      console.warn('[plan] trip not written:', writeRes.reason)
    }
    return { ok: true, tripWritten: writeRes.written }
```

- [ ] **Step 7: 改造 catch 分支: 区分 CANCELLED, 写 trip error**

定位 catch（约第 280 行）:

```js
  } catch (e) {
    const errMsg = e.message || String(e)
    console.error('[ai-plan-trip run] failed:', errMsg, e.stack)
    try {
      await updateTask(taskId, {
        status: 'error',
        error: errMsg,
        meta: { elapsedMs: Date.now() - startTs, promptTokens, completionTokens, turns },
      })
    } catch (updErr) {
      console.error('[ai-plan-trip run] updateTask(error) FAILED:', updErr && updErr.message, 'taskId=', taskId)
    }
    return { ok: false, error: errMsg }
  }
```

替换为:

```js
  } catch (e) {
    const errMsg = e.message || String(e)
    const cancelled = e && e.cancelled === true

    if (cancelled) {
      console.warn('[ai-plan-trip run] cancelled by user after', turns, 'turns')
      try {
        await updateTask(taskId, {
          status: 'cancelled',
          meta: { elapsedMs: Date.now() - startTs, promptTokens, completionTokens, turns },
        })
      } catch (_) {}
      // 不写 trip: 用户已经把 trip.aiTaskId 清成 null 了, finalizeTrip 也会因比对失败而 abort
      return { ok: false, cancelled: true }
    }

    console.error('[ai-plan-trip run] failed:', errMsg, e.stack)
    try {
      await updateTask(taskId, {
        status: 'error',
        error: errMsg,
        meta: { elapsedMs: Date.now() - startTs, promptTokens, completionTokens, turns },
      })
    } catch (updErr) {
      console.error('[ai-plan-trip run] updateTask(error) FAILED:', updErr && updErr.message, 'taskId=', taskId)
    }

    // 写 trip error 状态 (finalizeTrip 内部会 abort 已被超越的写入)
    try {
      await finalizeTrip(tripId, taskId, {
        aiStatus: 'error',
        aiDraft: null,
        aiError: errMsg,
      })
    } catch (writeErr) {
      console.error('[ai-plan-trip run] finalizeTrip(error) FAILED:', writeErr && writeErr.message)
    }
    return { ok: false, error: errMsg }
  }
```

- [ ] **Step 8: 在微信开发者工具里上传 ai-plan-trip 云函数**

操作: 微信开发者工具 → 云开发 → 云函数 → 右键 `ai-plan-trip` → 上传并部署: 云端安装依赖。

- [ ] **Step 9: 提交**

```bash
git add cloudfunctions/ai-plan-trip/index.js cloudfunctions/ai-plan-trip/lib/task-store.js
git commit -m "feat(ai-plan-trip): 任务终结直接写 trip 草稿, 加协作式取消"
```

---

## Task 5: ai-task.ts 精简为只剩 startAITask

**Files:**
- Modify: `src/utils/ai-task.ts`

- [ ] **Step 1: 整体替换文件**

把 [src/utils/ai-task.ts](../../src/utils/ai-task.ts) 整个替换为:

```typescript
import Taro from '@tarojs/taro'
import type { AIPreferences, GeneratedPlan } from '../types/trip'

interface StartParams {
  tripId: string  // 现在必传, 新建场景在调用前先 createTrip 拿到 _id
  tripContext: {
    name: string
    destinations: unknown[]
    startDate: string
    endDate: string
    pax: number
  }
  preferences: AIPreferences
  previousResult?: GeneratedPlan
  userFeedback?: string
}

/** 客户端预生成 taskId, 用作 ai_tasks 集合的 _id */
function generateTaskId(): string {
  const ts = Date.now().toString(36)
  const rand = Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('')
  return `${ts}${rand}`.slice(0, 32)
}

/**
 * 启动 AI 任务. fire-and-forget:
 *  - 客户端生成 taskId 并立即返回
 *  - 云函数在后台跑完整个 600s timeout, 进度和终态都直接写 trip 文档
 *  - 客户端只需 watch trip 文档 (现有 trip-store 已订阅), 不再订阅 ai_tasks
 *
 * 调用方流程通常是:
 *   1. await createTrip(...)  // 拿 tripId
 *   2. const taskId = startAITask({ tripId, ... })
 *   3. await updateTrip(tripId, { aiTaskId: taskId, aiStatus: 'generating' }, openid)
 *   4. redirect 或留页, trip-store watch 会推送 aiStatus 变化
 */
export function startAITask(p: StartParams): string {
  if (!p.tripId) throw new Error('startAITask: tripId is required')
  const taskId = generateTaskId()
  ;(Taro as { cloud?: { callFunction: (args: unknown) => Promise<unknown> } }).cloud?.callFunction({
    name: 'ai-plan-trip',
    data: { _mode: 'plan', taskId, ...p },
  })?.catch((err: { errMsg?: string }) => {
    // 客户端 RPC 超时是预期的, 服务端仍在跑. log 一下就好
    console.warn('[startAITask] callFunction settled:', err?.errMsg)
  })
  return taskId
}
```

注意: 所有 `watchAITask / PENDING_TIMEOUT_MS / STREAMING_HEARTBEAT_MS / savePendingTask / loadPendingTask / clearPendingTask / getAITask / TaskWatcher` 都被删除了。下游 import 这些符号的页面在 Task 9 / Task 10 改造时统一去除。

- [ ] **Step 2: 提交（暂不验证，下游引用会先报错）**

```bash
git add src/utils/ai-task.ts
git commit -m "refactor(ai-task): 精简为 fire-and-forget 仅留 startAITask"
```

---

## Task 6: 新增 AILoadingBar 组件

**Files:**
- Create: `src/components/AILoadingBar/index.tsx`
- Create: `src/components/AILoadingBar/index.scss`

- [ ] **Step 1: 创建 index.tsx**

```typescript
import { View, Text } from '@tarojs/components'
import './index.scss'

export type AIBarStatus = 'generating' | 'ready' | 'error'

interface Props {
  status: AIBarStatus
  onTap?: () => void
}

const CONFIG: Record<AIBarStatus, { icon: string; text: string; cls: string }> = {
  generating: { icon: '⟳',  text: 'AI 生成中…',         cls: 'ai-bar--generating' },
  ready:      { icon: '✨', text: 'AI 草稿就绪 · 点击查看', cls: 'ai-bar--ready' },
  error:      { icon: '⚠',  text: 'AI 生成失败 · 点击重试', cls: 'ai-bar--error' },
}

export default function AILoadingBar({ status, onTap }: Props) {
  const c = CONFIG[status]
  return (
    <View
      className={`ai-bar ${c.cls}`}
      onClick={(e) => { e.stopPropagation(); onTap?.() }}
    >
      <Text className={`ai-bar-icon ${status === 'generating' ? 'spin' : ''}`}>{c.icon}</Text>
      <Text className='ai-bar-text'>{c.text}</Text>
    </View>
  )
}
```

- [ ] **Step 2: 创建 index.scss**

```scss
.ai-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 24rpx;
  border-radius: 14rpx;
  font-size: 24rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
}

.ai-bar--generating {
  background: #eef0f3;
  color: #555;
}
.ai-bar--ready {
  background: linear-gradient(135deg, #d8f5e0 0%, #b8ecc8 100%);
  color: #1f7a3b;
}
.ai-bar--error {
  background: linear-gradient(135deg, #ffe2e0 0%, #ffc8c4 100%);
  color: #a13030;
}

.ai-bar-icon {
  font-size: 28rpx;
  line-height: 1;
}
.ai-bar-icon.spin {
  animation: ai-bar-spin 1.2s linear infinite;
  display: inline-block;
}

@keyframes ai-bar-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/components/AILoadingBar/
git commit -m "feat(AILoadingBar): 新增 AI 状态条统一组件"
```

---

## Task 7: AIPlanPreview 改造（舍弃按钮 + 冲突提示 + 应用确认）

**Files:**
- Modify: `src/components/AIPlanPreview/index.tsx`
- Modify: `src/components/AIPlanPreview/index.scss`

- [ ] **Step 1: 改 index.tsx — 修改 imports 和 Props 接口**

定位文件顶部 import + Props:

```typescript
import { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { GeneratedPlan, GeneratedSpot, AITaskStatus, Day } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  plan: GeneratedPlan | null
  status: AITaskStatus
  generating: boolean
  /** trip 当前已有的 days, 用于检测冲突 (该天已有手动 spots). 可空表示新建场景 (一律视为无冲突) */
  existingDays?: Day[] | null
  onRegenerate: () => void
  onApply: (selectedDates: string[]) => void
  onDiscard: () => void
  onClose: () => void
}
```

变更点: 新增 `existingDays` 和 `onDiscard`; `onRegenerate` 的签名从 `(feedback: string)` 改成 `()`（重新生成入口由外层弹 AIPlanForm 收集新 preferences，不再用 textarea）。

- [ ] **Step 2: 删除 feedback textarea 状态和 UI**

找到 `const [feedback, setFeedback] = useState('')` 删掉。删除 JSX 里的 `.aip-feedback` 整段 (从 `<View className='aip-feedback'>` 到对应 `</View>` 闭合)。

- [ ] **Step 3: 增加冲突检测助手**

在 `unresolvedCount` 函数下方加:

```typescript
/** 返回 plan 中和 existingDays 在同日期有 spots 的"冲突日期"集合 */
function getConflictDates(plan: GeneratedPlan, existingDays: Day[] | null | undefined): Set<string> {
  const conflicts = new Set<string>()
  if (!existingDays) return conflicts
  const byDate = new Map(existingDays.map(d => [d.date, d]))
  for (const gd of plan.days) {
    const ed = byDate.get(gd.date)
    if (ed && ed.spots && ed.spots.length > 0) conflicts.add(gd.date)
  }
  return conflicts
}
```

- [ ] **Step 4: 在组件内计算冲突, 在每天标题下显示小标**

定位 `unres` 变量声明那行, 替换为:

```typescript
  const unres = unresolvedCount(plan)
  const conflicts = getConflictDates(plan, existingDays)
```

然后定位 `aip-day-head` 渲染块 (现在的 `Day {di+1} · {d.date}`)，在它正下方插入冲突小标:

```tsx
              <View key={`d-${d.date}`} className='aip-day'>
                <View className='aip-day-head' onClick={() => toggle(d.date)}>
                  <View className={`aip-check ${on ? 'on' : ''}`}>{on ? '✓' : ''}</View>
                  <Text className='aip-day-title'>Day {di + 1} · {d.date}</Text>
                </View>
                {conflicts.has(d.date) && (
                  <View className='aip-day-conflict'>
                    ⚠ 该天已有手动内容, 应用将覆盖
                  </View>
                )}
                {d.spots.map(...)}
              </View>
```

- [ ] **Step 5: 改 actions 区: 三个按钮 + 应用前冲突确认**

替换文件底部的 `<View className='aip-actions'>` 整段为:

```tsx
        <View className='aip-actions'>
          <View
            className='aip-btn-discard'
            onClick={onDiscard}
          >舍弃</View>
          <View
            className={`aip-btn-regen ${generating ? 'disabled' : ''}`}
            onClick={() => !generating && onRegenerate()}
          >{generating ? '生成中…' : '重新生成'}</View>
          <View
            className={`aip-btn-apply ${canApply ? '' : 'disabled'}`}
            onClick={async () => {
              if (!canApply) return
              const picked = Array.from(selected)
              const conflictedPicked = picked.filter(d => conflicts.has(d))
              if (conflictedPicked.length > 0) {
                const res = await Taro.showModal({
                  title: '覆盖确认',
                  content: `${conflictedPicked.join(', ')} 已有手动内容, 应用后会被覆盖, 继续?`,
                  confirmText: '继续',
                  confirmColor: '#c43d3d',
                })
                if (!res.confirm) return
              }
              onApply(picked)
            }}
          >应用 {selected.size > 0 ? `(${selected.size} 天)` : ''}</View>
        </View>
```

- [ ] **Step 6: 改 index.scss 加新样式**

在文件末尾追加:

```scss
.aip-day-conflict {
  margin: -4rpx 0 12rpx 56rpx;
  padding: 6rpx 14rpx;
  background: #fff4e0;
  color: #a06b1a;
  font-size: 22rpx;
  border-radius: 8rpx;
  display: inline-block;
}

.aip-btn-discard {
  flex: 1;
  text-align: center;
  padding: 22rpx 0;
  border-radius: 16rpx;
  background: #f4f4f6;
  color: #666;
  font-size: 28rpx;
  font-weight: 600;
}
```

确保 `.aip-actions` 是 `display: flex; gap: 16rpx;` (大概率已经是), 三个按钮并排即可。如果当前样式只针对两个按钮, 在 `.aip-actions` 里把按钮 flex 调整一下保证三个等宽:

定位 `.aip-actions` 块, 在大括号内追加（如尚未有）:

```scss
  display: flex;
  gap: 16rpx;
```

- [ ] **Step 7: 提交（下游引用尚未改, 此时暂未编译通过）**

```bash
git add src/components/AIPlanPreview/
git commit -m "feat(AIPlanPreview): 加舍弃按钮/冲突提示/应用确认, 移除 feedback textarea"
```

---

## Task 8: home 页卡片显示 AILoadingBar（owner-only）+ 实时刷新

**Files:**
- Modify: `src/pages/home/index.tsx`
- Modify: `src/pages/home/index.scss`

**关键背景**: home 当前只在 mount 和 `useDidShow` 时拉一次 trips 列表, 没有 watch。如果用户停在 home 等 AI 完成, 状态条永远是 `generating` 不会变 `ready`。所以本 Task 还要加一个轻量轮询: 当 trips 中存在 `aiStatus === 'generating'` 时, 启动 5s 间隔刷新; 没有就停。

- [ ] **Step 1: import AILoadingBar**

定位 home/index.tsx 顶部 import 区, 增加:

```typescript
import AILoadingBar, { type AIBarStatus } from '../../components/AILoadingBar'
```

- [ ] **Step 2: 在卡片 JSX 顶部条件渲染 AILoadingBar**

定位 `trips.map(t => { ... })` 的渲染体 (约第 152 行) 现在的结构:

```tsx
const isSeed = isSeedTripId(t._id)
const isCollab = !isSeed && t._openid !== openid
return (
  <View key={t._id} className='trip-card' ... >
    {isSeed && <View className='tc-badge tc-badge-seed'>示例</View>}
    {isCollab && <View className='tc-badge'>协作</View>}
    <Text className='tc-name'>{t.name}</Text>
    ...
```

在 `<View className='trip-card' ...>` 内部、第一个 `tc-badge` 之前插入:

```tsx
    <View key={t._id} className='trip-card' onClick={...} onLongPress={...}>
      {!isCollab && !isSeed && t.aiStatus && (
        <AILoadingBar
          status={t.aiStatus as AIBarStatus}
          onTap={() => Taro.navigateTo({ url: `/pages/trip/index?id=${t._id}` })}
        />
      )}
      {isSeed && <View className='tc-badge tc-badge-seed'>示例</View>}
      {isCollab && <View className='tc-badge'>协作</View>}
```

owner 判定: `!isCollab && !isSeed` (示例 trip 不能跑 AI; 协作者也不渲染)。状态条点击直接跳进 trip, 让 trip 页内部状态机接管。

- [ ] **Step 3: home/index.scss 调整卡片留白避免状态条贴边**

定位 `.trip-card` 块 (在 home/index.scss), 检查 padding-top。如果状态条贴卡片顶部观感不好, 给 `.ai-bar` 加 margin 即可:

```scss
.trip-card .ai-bar {
  margin: -8rpx -8rpx 16rpx -8rpx;
}
```

具体 padding 大小可以编译后视觉再调。

- [ ] **Step 4: 加 5s 轮询: 仅在有 generating trip 时启动**

在 home/index.tsx 的 TripList 组件内部, 紧跟现有的 `useDidShow` hook 之后追加:

```typescript
  // AI 任务实时刷新: 只要列表里还有 generating 的 trip, 每 5s 轮询一次
  // (home 没用 trip watch, 需要这个兜底; trip 一切完后轮询自动停)
  useEffect(() => {
    if (!openid) return
    const hasGenerating = trips.some(t => t.aiStatus === 'generating')
    if (!hasGenerating) return
    const timer = setInterval(() => {
      listMyTrips(openid)
        .then(list => setTrips([...SEED_TRIPS, ...list]))
        .catch(e => console.error('[home] ai polling failed', e))
    }, 5000)
    return () => clearInterval(timer)
  }, [openid, trips])
```

注意: 该 effect 依赖 `trips` 数组本身, 每次 setTrips 都会重跑 effect; 但只有内部条件 `hasGenerating` 才启动 interval, 所以 generating 全部完成后会自然停止。

- [ ] **Step 5: 提交**

```bash
git add src/pages/home/index.tsx src/pages/home/index.scss
git commit -m "feat(home): 卡片顶部显示 AI 状态条 + generating 期间轮询刷新"
```

---

## Task 9: new-trip 页面改造（提交 AI → createTrip + startAITask + redirect）

**Files:**
- Modify: `src/pages/new-trip/index.tsx`

- [ ] **Step 1: 删除一大坨 AI 相关 imports**

定位顶部 import 区, 替换为:

```typescript
import { useState } from 'react'
import { View, Text, Input, Button, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import dayjs from 'dayjs'
import DatePicker from '../../components/DatePicker'
import DestinationPicker from '../../components/DestinationPicker'
import AIPlanForm from '../../components/AIPlanForm'
import type { Destination, AIPreferences } from '../../types/trip'
import { buildNewTrip } from '../../utils/trip-helpers'
import { createTrip, updateTrip } from '../../utils/db'
import { useMe } from '../../store/me-store'
import { startAITask } from '../../utils/ai-task'
import './index.scss'
```

变更: 去掉 `AILoading / AIPlanPreview / AITaskFab / useEffect / useRef / planDayToDay / AITask / GeneratedPlan / 全部 watch/pending 相关`。

- [ ] **Step 2: 整体替换 NewTrip 组件实现**

从 `export default function NewTrip() {` 到文件末尾 `}` 整体替换为:

```typescript
export default function NewTrip() {
  const [name, setName] = useState('')
  const [pax, setPax] = useState(2)
  const [dates, setDates] = useState({
    start: dayjs().format('YYYY-MM-DD'),
    end: dayjs().add(2, 'day').format('YYYY-MM-DD'),
  })
  const [destinations, setDestinations] = useState<Destination[]>([])
  const PAX_OPTIONS = Array.from({ length: 99 }, (_, i) => `${i + 1} 人`)
  const { me } = useMe()
  const openid = me?.openid || ''
  const [submitting, setSubmitting] = useState(false)
  const [aiFormOpen, setAiFormOpen] = useState(false)

  const canSubmit = !!name.trim() && !!openid && pax >= 1 && !dayjs(dates.end).isBefore(dates.start)

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      const input = buildNewTrip({ name, pax, startDate: dates.start, endDate: dates.end, destinations })
      input.ownerOpenid = openid
      input.ownerNickname = me?.nickname || '行迹旅人'
      input.ownerAvatarUrl = me?.avatarUrl || ''
      const tripId = await createTrip(input)
      Taro.showToast({ title: '已创建', icon: 'success' })
      setTimeout(() => Taro.redirectTo({ url: `/pages/trip/index?id=${tripId}` }), 600)
    } catch (e) {
      console.error('createTrip failed', e)
      Taro.showToast({ title: '创建失败', icon: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleAiSubmit = async (prefs: AIPreferences) => {
    if (!canSubmit) return
    setAiFormOpen(false)
    Taro.showLoading({ title: '准备中…' })
    try {
      // 1. 用空 days 创建 trip
      const input = buildNewTrip({ name, pax, startDate: dates.start, endDate: dates.end, destinations })
      input.ownerOpenid = openid
      input.ownerNickname = me?.nickname || '行迹旅人'
      input.ownerAvatarUrl = me?.avatarUrl || ''
      const tripId = await createTrip(input)

      // 2. 启动 AI 任务
      const taskId = startAITask({
        tripId,
        tripContext: { name: input.name, destinations, startDate: dates.start, endDate: dates.end, pax },
        preferences: prefs,
      })

      // 3. 把 aiTaskId / aiStatus 写到 trip 上, 让首页卡片立即能看到状态条
      await updateTrip(tripId, { aiTaskId: taskId, aiStatus: 'generating', aiDraft: null, aiError: null }, openid)

      Taro.hideLoading()
      Taro.showToast({ title: 'AI 正在生成…', icon: 'none', duration: 1200 })
      // 跳回首页, 用户在首页看 generating 状态条
      setTimeout(() => Taro.reLaunch({ url: '/pages/home/index' }), 800)
    } catch (e: unknown) {
      Taro.hideLoading()
      console.error('[ai submit]', e)
      Taro.showToast({ title: 'AI 启动失败', icon: 'none' })
    }
  }

  return (
    <View className='new-trip theme-tegami'>
      <View className='nt-field'>
        <Text className='nt-label'>攻略名</Text>
        <Input className='nt-input' placeholder='例：南京 · 金陵四日' value={name} onInput={e => setName(e.detail.value)} />
      </View>

      <View className='nt-field'>
        <Text className='nt-label'>日期</Text>
        <DatePicker value={dates} onChange={setDates} />
      </View>

      <View className='nt-field'>
        <Text className='nt-label'>目的地</Text>
        <DestinationPicker value={destinations} onChange={setDestinations} />
      </View>

      <View className='nt-field'>
        <Text className='nt-label'>人数</Text>
        <Picker
          mode='selector'
          range={PAX_OPTIONS}
          value={Math.max(0, Math.min(98, pax - 1))}
          onChange={e => setPax(Number(e.detail.value) + 1)}
        >
          <View className='nt-pax-picker'>
            <Text className='nt-pax-value'>{pax} 人</Text>
            <Text className='nt-pax-arrow'>▾</Text>
          </View>
        </Picker>
      </View>

      <View className='nt-foot'>
        <View className='nt-row-btns'>
          <Button className='nt-cancel' onClick={() => Taro.navigateBack()}>取消</Button>
          <Button className='nt-submit' disabled={!canSubmit || submitting} onClick={submit}>
            {submitting ? '创建中...' : '创建'}
          </Button>
        </View>

        <Button className='nt-submit-ai' disabled={!canSubmit} onClick={() => setAiFormOpen(true)}>
          ✨ AI 帮我规划
        </Button>
      </View>

      <AIPlanForm
        open={aiFormOpen}
        onClose={() => setAiFormOpen(false)}
        onSubmit={handleAiSubmit}
      />
    </View>
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add src/pages/new-trip/index.tsx
git commit -m "feat(new-trip): 提交 AI 改成 createTrip + startAITask + redirect 首页"
```

---

## Task 10: trip 页面改造（watch trip.aiStatus + AILoadingBar + 自动弹 Preview）

**Files:**
- Modify: `src/pages/trip/index.tsx`

- [ ] **Step 1: 替换顶部 import 区**

```typescript
import { useEffect, useState } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import { TripProvider, useTripStore } from '../../store/trip-store'
import ItineraryView from '../../views/ItineraryView'
import BudgetView from '../../views/BudgetView'
import PackingView from '../../views/PackingView'
import MapView from '../../views/MapView'
import CollaboratorsBar from '../../components/CollaboratorsBar'
import CollaboratorsSheet from '../../components/CollaboratorsSheet'
import TripActionSheet, { type TripAction } from '../../components/TripActionSheet'
import ShareTypeSheet from '../../components/ShareTypeSheet'
import AIPlanForm from '../../components/AIPlanForm'
import AIPlanPreview from '../../components/AIPlanPreview'
import AILoadingBar from '../../components/AILoadingBar'
import { buildShareMessage, shareRef, resetShareRef } from '../../utils/share'
import { smartDeleteTrip, renameTrip, copyTripLocally, updateTrip } from '../../utils/db'
import { isSeedTripId } from '../../data/seed-trips'
import { mergePlanIntoDays } from '../../utils/trip-helpers'
import type { ShareKind } from '../../utils/cloud'
import type { AIPreferences } from '../../types/trip'
import { startAITask } from '../../utils/ai-task'
import './index.scss'
```

- [ ] **Step 2: TripBody 内部替换 AI 状态块**

定位 TripBody 内部, 从 `// === AI 相关状态 ===` (约第 50 行) **一直到 `handleAiApply` 函数结尾** (`}` 闭合, 约第 222 行) —— 包括: 所有 AI useState/useRef 声明、`const t = state.trip`、`isOwner`、`shareRef.tripName`、之前 hooks-order 修复时的 useEffect、三条早返、`stopWatch / onTaskUpdate / startHeartbeat / startAi / resumeAi / handleAiOpen / handleAiSubmit / handleAiRegenerate / handleAiApply` 全部函数。**整段替换**为:

```typescript
  // === AI 草稿流相关 ===
  const [aiFormOpen, setAiFormOpen] = useState(false)
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false)

  const t = state.trip
  const isOwner = t ? t._openid === openid : false

  shareRef.tripName = t?.name || ''

  // 进入 ready 状态首次自动弹 Preview
  // 注意: 小程序没有 sessionStorage, 用 Taro.getStorageSync (持久 storage), 但 key 含 aiTaskId,
  // 重新生成会换新 taskId 所以新 task 仍会自动弹一次。应用/舍弃后 aiTaskId 清空, 不再触发。
  useEffect(() => {
    if (!t || !isOwner) return
    if (t.aiStatus !== 'ready') return
    if (!t.aiTaskId) return
    const key = `ai-preview-shown:${t._id}:${t.aiTaskId}`
    try {
      if (!Taro.getStorageSync(key)) {
        setAiPreviewOpen(true)
        Taro.setStorageSync(key, '1')
      }
    } catch (_) {}
  }, [t?._id, t?.aiTaskId, t?.aiStatus, isOwner])

  if (state.loading) return <View className='trip-empty'>加载中...</View>
  if (state.error) return <View className='trip-empty'>{state.error}</View>
  if (!t) return <View className='trip-empty'>未找到攻略</View>

  // === AI 行为函数 ===
  const triggerAiTask = async (prefs: AIPreferences) => {
    if (!t || !isOwner) return
    setAiFormOpen(false)
    try {
      const taskId = startAITask({
        tripId: t._id,
        tripContext: {
          name: t.name,
          destinations: t.destinations,
          startDate: t.startDate,
          endDate: t.endDate,
          pax: t.pax,
        },
        preferences: prefs,
      })
      await updateTrip(t._id, {
        aiTaskId: taskId,
        aiStatus: 'generating',
        aiDraft: null,
        aiError: null,
      }, openid)
    } catch (e: unknown) {
      console.error('[ai trigger]', e)
      Taro.showToast({ title: 'AI 启动失败', icon: 'none' })
    }
  }

  const clearAiFields = async () => {
    if (!t) return
    await updateTrip(t._id, {
      aiTaskId: null,
      aiStatus: null,
      aiDraft: null,
      aiError: null,
    }, openid)
    dispatch({ type: 'UPDATE_TRIP', patch: { aiTaskId: null, aiStatus: null, aiDraft: null, aiError: null } })
  }

  const handleBarTap = async () => {
    if (!t || !isOwner) return
    if (t.aiStatus === 'generating') {
      const res = await Taro.showModal({
        title: '停止 AI 生成?',
        content: '已生成的部分会被舍弃, 后台运行的剩余轮次也会终止',
        confirmText: '停止',
        confirmColor: '#c43d3d',
      })
      if (res.confirm) await clearAiFields()
    } else if (t.aiStatus === 'ready') {
      setAiPreviewOpen(true)
    } else if (t.aiStatus === 'error') {
      // 重试 = 重新弹 form
      setAiFormOpen(true)
    }
  }

  const handleAiButtonTap = () => {
    if (!t || !isOwner) return
    if (t.aiStatus === null || t.aiStatus === undefined) setAiFormOpen(true)
    // 否则什么都不做 (用户应该点状态条)
  }

  const handlePreviewApply = async (selectedDates: string[]) => {
    if (!t || !t.aiDraft) return
    try {
      const newDays = mergePlanIntoDays(t.days, t.aiDraft, selectedDates)
      await updateTrip(t._id, {
        days: newDays,
        aiTaskId: null,
        aiStatus: null,
        aiDraft: null,
        aiError: null,
      }, openid)
      dispatch({ type: 'UPDATE_TRIP', patch: {
        days: newDays,
        aiTaskId: null,
        aiStatus: null,
        aiDraft: null,
        aiError: null,
      } })
      setAiPreviewOpen(false)
      Taro.showToast({ title: '已应用', icon: 'success' })
    } catch (e: unknown) {
      console.error('[ai apply]', e)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  const handlePreviewDiscard = async () => {
    setAiPreviewOpen(false)
    await clearAiFields()
    Taro.showToast({ title: '已舍弃', icon: 'none' })
  }

  const handlePreviewRegenerate = () => {
    // 关 Preview, 弹 Form 让用户重填 preferences. Form submit 会启动新 task 并覆盖 ai* 字段
    setAiPreviewOpen(false)
    setAiFormOpen(true)
  }
```

- [ ] **Step 3: 改 trip head 区, 加 AILoadingBar 渲染**

定位 `<View className='trip-head'>` 块。内部结构是 `<View className='th-row'>...</View>` 紧接着 `<View className='th-meta'>`。在闭合 th-row 的 `</View>` 之后、`<View className='th-meta'>` 之前插入:

```tsx
        {isOwner && t.aiStatus && (
          <View className='th-ai-bar'>
            <AILoadingBar
              status={t.aiStatus as 'generating' | 'ready' | 'error'}
              onTap={handleBarTap}
            />
          </View>
        )}
```

同时把 `<View className='th-ai-btn' onClick={handleAiOpen}>✨ AI</View>` 行改成:

```tsx
            {isOwner && (
              <View
                className={`th-ai-btn ${t.aiStatus ? 'th-ai-btn-disabled' : ''}`}
                onClick={handleAiButtonTap}
              >✨ AI</View>
            )}
```

并在 trip/index.scss 加（如果还没）:

```scss
.th-ai-btn-disabled {
  opacity: 0.4;
  pointer-events: none;
}

.th-ai-bar {
  padding: 16rpx 24rpx 0;
}
```

- [ ] **Step 4: 替换底部 JSX 里的 AIPlanForm / AIPlanPreview 调用**

定位文件底部的 `<AIPlanForm ... />` 和 `<AIPlanPreview ... />` 区域（删除任何 `<AILoading ... />` 和 `<AITaskFab ... />`），替换为:

```tsx
      <AIPlanForm
        open={aiFormOpen}
        onClose={() => setAiFormOpen(false)}
        onSubmit={triggerAiTask}
      />
      <AIPlanPreview
        open={aiPreviewOpen}
        plan={t.aiDraft || null}
        status={t.aiStatus === 'ready' ? 'done' : 'pending'}
        generating={t.aiStatus === 'generating'}
        existingDays={t.days}
        onRegenerate={handlePreviewRegenerate}
        onApply={handlePreviewApply}
        onDiscard={handlePreviewDiscard}
        onClose={() => setAiPreviewOpen(false)}
      />
```

注: 这里把 AIPlanPreview 的 `status` 显式翻译成 `'done' | 'pending'`，避免和 trip.aiStatus 的 `'generating'/'ready'/'error'` 混淆。AITaskStatus 内现有 'done' 在 Preview 内部用来判断 canApply。

- [ ] **Step 5: 提交**

```bash
git add src/pages/trip/index.tsx src/pages/trip/index.scss
git commit -m "feat(trip): 草稿流 - watch trip.aiStatus 驱动 UI, 自动弹 Preview"
```

---

## Task 11: 删除 AILoading + AITaskFab 组件与残余引用

**Files:**
- Delete: `src/components/AILoading/` (entire dir)
- Delete: `src/components/AITaskFab/` (entire dir)
- Verify: 任何 src 下还 import 这两个组件的地方

- [ ] **Step 1: 全文搜索残余 import (排除 AILoadingBar)**

运行:

```bash
grep -rn "AILoading\|AITaskFab" /Users/jinchi/Documents/行迹/src/ | grep -v "AILoadingBar"
```

预期输出: **无**。如果还有任何引用 (import / JSX / 类型), 回到对应文件删掉。

- [ ] **Step 2: 删除组件目录**

```bash
git rm -r src/components/AILoading src/components/AITaskFab
```

- [ ] **Step 3: 编译检查**

操作: 在微信开发者工具中点"重新编译"; 或在终端跑 `npm run dev:weapp` 看是否有 TypeScript/构建错误。修复任何遗漏的引用。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: 删除废弃的 AILoading 弹窗和 AITaskFab 悬浮按钮"
```

---

## Task 12: 手动验收测试

**Files:** 无（这是验证步骤）

执行环境: 微信开发者工具 + 真机调试。每条都需要操作并确认输出符合预期; 不符合则回到对应 Task 调试。

- [ ] **A. 新建场景 happy path**
  1. 进入"新建攻略"，填好名字/日期/目的地/人数
  2. 点 `✨ AI 帮我规划`，AIPlanForm 弹出
  3. 选 preferences 提交
  4. **预期**: toast "AI 正在生成…" → 跳回首页 → 该攻略卡片顶部显示灰色 `⟳ AI 生成中…` 状态条
  5. 等待生成完成（云函数 cold start + 模型时间，1-3 分钟）
  6. **预期**: 卡片状态条变绿 `✨ AI 草稿就绪 · 点击查看`
  7. 点击该卡片 → 进 trip 页 → trip head 下方出现绿色状态条 + **自动弹出 AIPlanPreview**
  8. Preview 内每天默认勾选；点 `应用 (N 天)` → toast "已应用" → 弹窗关闭 → 状态条消失 → days 内容已填充

- [ ] **B. 失败场景**
  1. 故意触发失败（比如把 deepseek key 临时改错，或断网后重新进入）
  2. **预期**: 卡片状态条变红 `⚠ AI 生成失败 · 点击重试`
  3. 进 trip 页 → 顶部红色状态条；点击 → 弹 AIPlanForm
  4. 重填提交 → 状态变 `generating`

- [ ] **C. 停止生成**
  1. 触发一次 AI 生成
  2. 在 generating 期间进入 trip 页，点击灰色状态条
  3. **预期**: 弹窗 "停止 AI 生成?"
  4. 确认 → 状态条立刻消失, trip.aiStatus 清空
  5. 在 ai_tasks 集合（云开发控制台）观察对应 task：1-2 分钟内 status 变 `cancelled`（如果当前正卡在 LLM 调用就要等那一轮跑完）

- [ ] **D. 草稿延迟决策**
  1. 触发 AI → 等 ready
  2. 进 trip 页，Preview 弹出后**点 X 关闭，不应用**
  3. 退出 trip 回首页 → 状态条还是 ready
  4. 再次进入 trip → **Preview 不再自动弹**（sessionStorage 防重）；点状态条 → Preview 重新打开

- [ ] **E. 舍弃当前方案**
  1. 在 ready 的 Preview 里点 `舍弃`
  2. **预期**: toast "已舍弃" → 状态条消失 → trip 回到普通状态

- [ ] **F. 已有 trip 优化 + 冲突警告**
  1. 找一个已经有 spots 的 trip
  2. 在 trip head 点 `✨ AI` → AIPlanForm 弹出
  3. 提交 → trip head 出现 generating 状态条
  4. 等 ready → Preview 自动弹
  5. **预期**: 在那些有手动 spots 的天，标题下方有橙色小标 `⚠ 该天已有手动内容, 应用将覆盖`
  6. 勾选包含冲突的天 → 点 `应用` → **预期**: 弹覆盖确认对话框；确认后才合并

- [ ] **G. 重新生成**
  1. 在 Preview 里点 `重新生成`
  2. **预期**: Preview 关闭 → AIPlanForm 弹出 → 用户重填 preferences
  3. 提交 → 旧草稿被清掉 → 状态条变 generating
  4. 完成后再次自动弹 Preview（因为 aiTaskId 变了，新的 sessionStorage key）

- [ ] **H. 协作者视角**
  1. 用协作者账号进首页 → **预期**: 看到的卡片没有状态条
  2. 进 trip 页 → **预期**: 没有 AI 状态条，没有 `✨ AI` 按钮
  3. （不需要主动测试触发，protect by UI 即可）

- [ ] **I. 边界: 删除有 in-progress 任务的攻略**
  1. 触发 AI 生成
  2. generating 期间长按卡片 → 删除攻略
  3. **预期**: 攻略消失；云函数日志中后续会出现 `[finalizeTrip] trip 已不存在`，但不抛错

- [ ] **J. 编译/运行时无新报错**
  - 微信开发者工具 console 无 React 报错
  - debugReact 仍然开着的话，没有 hooks 顺序违反 / 渲染异常红色错误
  - 关闭 debugReact 之前最好确认上面所有项都通过

---

## Self-Review 已完成

- 所有 spec 节点都映射到 Task: 数据模型 (T1, T2) / 云函数 (T3, T4) / 前端 utils (T5) / 状态条组件 (T6) / Preview (T7) / home (T8) / new-trip (T9) / trip (T10) / 删除清理 (T11) / 验收 (T12)
- 类型名一致: `AIBarStatus` / `Trip.aiStatus` / 三态 `generating/ready/error` 在所有任务里一致
- 无 TBD / TODO / "类似上面" 占位
- 所有代码块都给出完整可粘贴的内容
