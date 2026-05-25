# AI 攻略生成 - 草稿流重构设计

- 日期: 2026-05-25
- 作者: zjc + Claude
- 状态: 待评审

## 1. 背景

当前 AI 生成流存在以下痛点:

1. **生成失败即丢失**: 失败后用户回到原页面, 已填的表单 / AI 已生成内容全部消失
2. **状态散落在弹窗**: AILoading 弹窗 + AITaskFab 悬浮条 + AIPlanPreview 三个组件相互配合, 状态机复杂, 容易出错 (本次 session 调试过的 hooks 顺序违反就是其中一例)
3. **生成成功后强制立即决策**: 用户必须当场点击"应用"才能保留 AI 结果, 退出即丢失
4. **没有"AI 优化已有攻略"入口**: 已有 trip 上虽然有 `✨ AI` 按钮, 但走的是和新建一样的"立即生成立即应用"链路, 体验割裂

## 2. 目标

1. **生成动作即创建**: 用户点 AI 提交后, 立即创建一条攻略 (即使生成尚未开始), 失败也能保留这条空白攻略让用户继续用
2. **状态可见于卡片**: 攻略卡片自身承载 AI 状态 (生成中 / 草稿就绪 / 失败), 删除 FAB 悬浮条
3. **草稿可延迟决策**: AI 完成后产出的是"草稿", 不污染攻略正式数据, 用户在任何时间进入攻略都能选择应用 / 重新生成 / 舍弃
4. **已有攻略可优化**: 在已有 trip 上点 ✨ AI, 走和新建一致的草稿流, 用户感知统一
5. **owner-only**: 协作者不参与 AI 流程, 只看到攻略本身

## 3. 数据模型

`Trip` 文档新增四个可空字段, 不需要迁移老攻略:

```ts
interface Trip {
  // 原有字段 ...

  aiTaskId?: string | null
  aiStatus?: 'generating' | 'ready' | 'error' | null
  aiDraft?: GeneratedPlan | null
  aiError?: string | null
}
```

### 3.1. 状态流转

| 阶段 | aiTaskId | aiStatus | aiDraft | aiError |
|---|---|---|---|---|
| 普通攻略 | null | null | null | null |
| 触发 AI 后 | <taskId> | generating | null | null |
| 生成成功 | <taskId> | ready | <GeneratedPlan> | null |
| 生成失败 | <taskId> | error | null | <msg> |
| 用户应用 / 舍弃 | null | null | null | null |
| 用户重新生成 | <newTaskId> | generating | null | null |

注: 任务终结后 `aiTaskId` 保留, 与 `aiStatus !== null` 共同表示"草稿等待处理"; 只有用户应用 / 舍弃后才一起清空。

## 4. 云函数 (ai-plan-trip) 改动

### 4.1. 职责调整

- task 完成时由云函数直接写 trip, 不再依赖前端订阅 `ai_tasks` 集合
- 删除现有的"流式 progress 写入循环" (前端不再展示生成进度, 该循环无用)
- 保留 `ai_tasks` 集合用于服务端日志 / 调试 / 错误溯源, 但前端不订阅

### 4.2. 写入 trip 的时机与防覆盖保护

任务终结时:

1. 先 `getTrip(tripId)` 读取当前 trip
2. 检查 `trip.aiTaskId === currentTaskId`
   - 不一致 → 用户已"停止"或"重新生成" → 放弃写入, log "[ai] task superseded, aborting write"
3. 一致 → 根据 task 终态写入:
   - `done` → `updateTrip(tripId, { aiStatus: 'ready', aiDraft: parsed, aiError: null })`
   - `error` → `updateTrip(tripId, { aiStatus: 'error', aiDraft: null, aiError: msg })`

注: trip 可能在云函数运行中被删除, `updateTrip` 会失败, catch 后 log 即可, 不抛。

### 4.3. 协作式取消 (省 token)

微信 SCF 没有外部 kill API, 用户点"停止生成"无法立即中断当前正在飞行的 LLM 调用。但可以让云函数在每轮调用之间主动检查"是否已被取消", 早退避免后续轮次继续烧 token。

实现:

```js
async function checkCancelled(tripId, myTaskId) {
  const t = await getTripLight(tripId)  // 只读 _id + aiTaskId 字段
  if (!t || t.aiTaskId !== myTaskId) {
    const err = new Error('CANCELLED')
    err.cancelled = true
    throw err
  }
}
```

插入位置:

- 进入主循环每一轮 LLM 调用之前
- 每次 tool call 完成之后, 即将开始下一轮之前

捕获处理:

- 主 catch 内识别 `err.cancelled === true`:
  - **不写 trip** (用户已经把字段清成 null, 写入也会因 4.2 节的 taskId 比对而 abort, 这里直接跳过更明确)
  - 只在 `ai_tasks` 集合里 update task status='cancelled' + log "[ai] cancelled by user after N turns"
  - 返回 `{ ok: false, cancelled: true }`

代价 / 效果:

- 每轮多一次 DB get (~50ms, 可忽略)
- 取消延迟 = 当前正在飞行的那次 LLM 调用剩余时间 (最长 ~60s)
- 当前飞行那一轮 token 仍会烧完, 但后续轮次 (多轮 tool call 场景下 2~3 轮 + 最终生成) 全部省下

### 4.3. 入参变化

`startAITask` 新增必填参数 `tripId`。新建场景前端需要先 `createTrip` 拿到 _id 再调起任务。

## 5. 前端流程

### 5.1. 新建场景 (new-trip 页)

```
填表单 → 点 [✨ AI 帮我规划] → AIPlanForm 收集 preferences
  → 提交:
      1. buildNewTrip(...) + createTrip → 拿到 tripId
      2. startAITask({ tripId, tripContext, preferences })
      3. updateTrip(tripId, { aiTaskId, aiStatus: 'generating' })
      4. Taro.redirectTo('/pages/home/index')
```

### 5.2. 首页 (home 页)

每张卡片 (owner 视角) 顶部根据 `trip.aiStatus` 渲染状态条:

| aiStatus | 状态条文案 | 视觉 |
|---|---|---|
| generating | ✨ AI 生成中… | 灰色背景 + 旋转 icon |
| ready | ✨ AI 草稿就绪 · 点击查看 | 绿色背景 |
| error | ⚠ AI 生成失败 · 点击重试 | 红色背景 |
| null | (不显示) | - |

协作者视角 (`t._openid !== openid`): 不渲染状态条 (无论 aiStatus 是什么)。

整张卡片仍然可点 → 进入 trip 页, 状态条不拦截事件。

### 5.3. Trip 页

进入时根据 `aiStatus` 决定顶部 UI 和自动行为:

#### 5.3.1. generating (owner)

- 顶部固定 AILoadingBar: "✨ AI 生成中…"
- 用户可正常浏览 / 编辑其他天 (不阻塞编辑)
- 点击状态条 → 确认弹窗 "停止 AI 生成并舍弃草稿?"
  - 确认 → `updateTrip({ aiTaskId: null, aiStatus: null })` (云函数后续写入会因 taskId 不一致而 abort)
  - 取消 → 不动

#### 5.3.2. ready (owner)

- 顶部固定 AILoadingBar: "✨ AI 草稿就绪 · 点击查看"
- **首次进入时自动弹 AIPlanPreview** (用 sessionStorage key `ai-preview-shown:${tripId}:${aiTaskId}` 防重弹; 用户关闭后同一 task 不再自动弹, 但状态条点击可手动打开)
- 点击状态条 → 打开 AIPlanPreview

#### 5.3.3. error (owner)

- 顶部固定 AILoadingBar: "⚠ AI 生成失败 · 点击重试"
- 点击 → 弹 AIPlanForm 重新触发 (用户可以改一次 preferences 再跑)
- 也可以长按 / 二级菜单显示 aiError 详情 (本期可省略)

#### 5.3.4. null

- 不显示 AILoadingBar
- trip head 的 `✨ AI` 按钮可点 (owner)

### 5.4. AIPlanPreview 改动

#### 5.4.1. 三个出口按钮

```
[ 舍弃当前方案 ]    [ 重新生成 ]    [ 应用 N 天 ]
```

- 应用: 走原 mergePlanIntoDays 逻辑, 写完后清空 `aiTaskId / aiStatus / aiDraft / aiError`
- 重新生成: 弹 AIPlanForm 让用户重新填 preferences → 触发新 task → 旧 aiDraft 立即清空, 进入 generating (新 task 的 aiTaskId 不同, sessionStorage 旧 key 自然失效, 新 task 下次进入会自动弹 Preview)
- 舍弃: 直接清空所有 ai* 字段, trip 回到普通状态

#### 5.4.2. 冲突提示

对每个草稿天遍历对应 `trip.days[date].spots`:
- 若该天已存在 spots 且不为空 → 在天标题下方显示小标 `⚠ 该天已有 N 个手动条目, 应用将覆盖`
- 点击 [应用] 时, 若选中的天集合里有任何冲突天 → 弹一次 `Taro.showModal` 确认 "Day X, Day Y 已有手动内容, 应用后会被覆盖, 继续?"

### 5.5. 优化已有 trip

trip head 的 `✨ AI` 按钮 (owner-only, 仅 `aiStatus === null` 时亮起):

```
点 ✨ AI → AIPlanForm 收集 preferences
  → 提交:
      1. startAITask({ tripId: t._id, tripContext, preferences })
      2. updateTrip(t._id, { aiTaskId, aiStatus: 'generating' })
  → 保持在 trip 页, 顶部出现 AILoadingBar
```

后续流转 (ready / error / 应用 / 舍弃 / 重新生成) 和 5.3 完全一致。

## 6. 组件改动清单

### 6.1. 新增

- **AILoadingBar**: 顶部状态条组件, 在 home 卡片顶部 + trip 页顶部都用
  - Props: `status: 'generating' | 'ready' | 'error'`, `error?: string`, `onTap?: () => void`
  - 内部不做业务逻辑, 只负责渲染 + 派发 tap

### 6.2. 改造

- **AIPlanPreview**: 增加"舍弃当前方案"按钮; 增加冲突天小标 + 应用前确认弹窗
- **AIPlanForm**: 不动 (新建 / 优化两种场景共用)

### 6.3. 删除

- `src/components/AILoading/` (生成中的全屏弹窗)
- `src/components/AITaskFab/` (悬浮按钮)
- `src/utils/ai-task.ts` 里的 `savePendingTask / loadPendingTask / clearPendingTask` 以及配套的 sessionStorage 持久化逻辑
- new-trip 和 trip 页里的 `watchAITask` 调用以及 `watcherRef / heartbeatTimerRef / pendingTimerRef / elapsedTimerRef / fabVisible / aiLoadingOpen` 等所有相关状态
- 云函数 ai-plan-trip 里写 `progress` 的循环

## 7. 边界情况

| 场景 | 处理 |
|---|---|
| 用户停止 AI 生成, 之后云函数才完成 | 云函数写入前对比 `trip.aiTaskId !== myTaskId`, abort 写入 |
| 用户停止 AI 生成, 云函数还在多轮循环中 | 每轮 LLM 调用前 `checkCancelled` (4.3), 抛 CANCELLED 早退, 省下后续轮次 token; 当前飞行的那次 LLM 调用无法中断, token 会烧完 |
| 用户在 generating 期间删除攻略 | 云函数最终 updateTrip 失败, catch 后 log |
| 协作者并发触发 AI | UI 不暴露入口, 协作者点击状态条无效; 即使绕过, 后端不做硬限制 (本期不防御性编程) |
| 同一 trip 已有 generating 任务时再次点 ✨ AI | UI 不允许 (按钮只在 aiStatus=null 时亮), 不需要后端守卫 |
| AI 返回的 plan.days 日期和 trip.days 日期不匹配 | 现有 `mergePlanIntoDays` 已经按 date 匹配, 不匹配的天忽略, 沿用 |

## 8. Out of scope (本次不做)

- 草稿历史 / 多版本对比
- 优化场景的 "想改进什么" 文本框 (后续可在 AIPlanForm 加)
- 协作者触发 AI 的权限管理
- 失败时的具体错误分类与重试策略
- 首页卡片显示 "X/N 天" 进度

## 9. 验收标准

- [ ] new-trip 提交 AI 表单后立即跳转到首页, 看到该攻略卡片显示 "AI 生成中…"
- [ ] 首页卡片状态条随 trip.aiStatus 实时变化 (利用现有 trips watch)
- [ ] 失败时攻略不删除, 状态条显示 "AI 生成失败 · 点击重试"
- [ ] 首次进入 ready 状态的 trip 自动弹 Preview; 关闭后再进入不再自动弹
- [ ] Preview 三个按钮 (应用 / 舍弃 / 重新生成) 都正确清理 / 重置 ai* 字段
- [ ] 点击 generating 状态条出现停止确认弹窗, 停止后云函数即使完成也不会覆盖
- [ ] 停止后云函数在下一轮 LLM 调用前早退, ai_tasks 记录 status='cancelled'
- [ ] 已有 trip 上 ✨ AI 按钮触发的优化, 走完 ready → 应用 流程, 行为和新建一致
- [ ] 协作者视角下, 不论 aiStatus 是什么, 都不看到任何 AI 相关 UI
- [ ] AILoading / AITaskFab 组件及相关代码已删除
