# 子项目 A · AI 流程与状态展示重构

> Spec 范围：基于 brainstorming 拆分得到的 7 个子项目中的第一个。覆盖 12 条诉求中的 #1、#4、#5、#6，并修正部分诉求与既有实现的事实偏差。
>
> 上层 design system 文档：[2026-05-26-design-system-application-design.md](./2026-05-26-design-system-application-design.md)

---

## 1. 目标

1.1. 把 AI 攻略生成入口从"首页 → 跳 new-trip → 弹采访"改为"首页直接拉起采访"，让 AI 创建流程零跳页完成。

1.2. 让 AI 攻略名称、空目的地由云函数智能补全，降低用户填写门槛。

1.3. 让 AI 生成状态在四个主题首页、trip 页攻略 tab 上都有清晰、常驻、主题化的可视化，覆盖 `generating / ready / error` 三态。

1.4. 保留并提升 AI 加载剧场 (`AILoadingTheater`) 的真实感（字幕节奏、文案多样性），消除"机械循环感"。

1.5. 让 AIInterview 及全项目所有底部弹出 sheet 的位置始终锚定在用户当前视口底部（修复当前由 transform 父容器导致的 fixed 失效问题），参照今早已修复的清单模板 sheet（`TemplateImport`）方案统一。

1.6. 让 AIInterview 在异常路径（停止、失败、重试）下保留用户已填字段，避免重新走一遍。

---

## 2. 范围

### 2.1. 涵盖

2.1.1. 首页 AI CTA 入口流程改造（诉求 #1）

2.1.2. trip 页攻略 tab 内联常驻 AI 状态条（诉求 #4 前半）

2.1.3. AILoadingTheater 字幕节奏与文案优化（诉求 #4 后半）

2.1.4. 四主题首页 AI 状态展示统一化与差异化（诉求 #5）

2.1.5. 所有主题 new-trip 页删除 "AI 帮我规划" 按钮（诉求 #6）

2.1.6. 云函数 `ai-plan-trip` 支持空目的地推荐 + 重试机制 + 智能生成攻略名

2.1.7. AIInterview 草稿持久化

2.1.8. 全项目 sheet 视口锚定修复（AIInterview + 其他 6 个未使用 RootPortal 的 sheet）

### 2.2. 不涵盖

2.2.1. 主包 <2MB 分包（子项目 G）

2.2.2. 出行前/中/后差异化（子项目 E）

2.2.3. emoji 清理与四主题整套设计语言（子项目 F）—— 本子项目产出的 4 主题×3 状态视觉稿会喂给 F 复用

2.2.4. 我的页头像昵称、主题选择 UX（子项目 B）

2.2.5. 护照印章 / 日期按钮 / 刊物封面排序（子项目 C、D）

2.2.6. H5 / 支付宝 / 其他平台兼容性：本子项目只验证微信小程序

---

## 3. 现状事实勘误（与诉求原文不一致之处）

3.1. 诉求 #5 称"只有手帖主题在主题页面可以看见 AI 状态"，实际：

| 主题 | `HomeCardAIRow` 渲染 | 备注 |
| --- | --- | --- |
| 手帖 tegami | 是，全部卡片 | OK |
| 刊物 magazine | 是，但仅 featured trip 卡 | 其他卡片缺失 |
| 极简 minimal | 是，全部卡片 | OK |
| 明信片 postcard | 否 | 仅在印章上加 `aiglow` 光晕 + `✓`，无文字状态 |

3.2. 诉求 #4 称"loading bar 不应该删除"，实际 Phase 5 已经把 `AILoadingBar` 组件与 4 个 TripHeader 中的引用全部删除。本子项目不会复活 `AILoadingBar`，而是把现有 `TripAIStatusBar` 从"仅最小化时浮动显示"重构为"`aiStatus` 非空就常驻内联显示"，达成诉求语义。

3.3. AIInterview sheet "出现在最下方需要滚回去看" 的现象：CSS 上 `position: fixed; inset: 0; align-items: flex-end` 与今早修复后的 `TemplateImport` 完全一致，TemplateImport 表现正常。差别在 TemplateImport 已用 Taro `RootPortal` 把节点挂到页面根，绕开祖先 `transform` 容器（CSS transform 会重定义 fixed 包含块）。

3.4. 当前项目 sheet 类组件共 11 个；用 `RootPortal` 的只有 4 个，剩余 7 个仍然存在/可能存在同样问题：

| 组件 | 已用 RootPortal | 备注 |
| --- | --- | --- |
| TemplateImport | 是 | 今早已修，作为参照实现 |
| EditSpotSheet | 是 | — |
| DestinationPicker | 是 | — |
| SpotSearch | 是 | — |
| AIInterview | 否 | 本子项目 5.1 修复 |
| AILoadingTheater | 否 | 全屏剧场，受同问题影响 |
| TripActionSheet | 否 | trip 页操作菜单 |
| CollaboratorsSheet | 否 | 协作者列表 |
| CoverPicker | 否 | 封面选择 |
| ShareTypeSheet | 否 | 分享类型 |
| AIPlanPreview | 否 | AI 草稿预览 |

本子项目把上述 7 个未修组件一并按 `TemplateImport` 方案统一收口。

---

## 4. 架构

### 4.1. 入口流向

```
[首页 AI CTA] ──→ home/index.tsx 拉起 <AIInterview mode='create'> (RootPortal)
                                             │
                                             ▼
                              [5 步采访：dest / date / pax / prefs / name]
                                             │
                                             ▼
                              utils/ai-task.ts: createTripAndFireAI(input, prefs)
                                             │
                                             ▼
                              Taro.redirectTo('/pages/trip/index?id=…')
                                             │
                                             ▼
                              [trip 页] AILoadingTheater (open) + 内联条 (open)
                                             │
                                             ▼
                              aiStatus = 'ready' ─→ AIPlanPreview 自动弹起
                                             │
                                             ▼
                              用户 apply ─→ aiStatus 清空，内联条隐藏

[trip 页 AIBadge] ──→ trip/index.tsx 拉起 <AIInterview mode='enrich'>
                                             │
                                             ▼
                              [1 步采访：prefs]
                                             │
                                             ▼
                              fireAITask + trip.aiStatus='generating'
                                             │
                                             ▼
                              同上 Theater + 内联条 + Preview 流
```

### 4.2. 状态机（trip 页 AI 流）

| state | open Theater | 显示内联条 | 触发 Preview |
| --- | --- | --- | --- |
| `aiStatus = null` | no | no | no |
| `generating` & `!theaterMinimized` | yes | yes | no |
| `generating` & `theaterMinimized` | no | yes | no |
| `ready` | no | yes | yes（首次自动弹；用户关闭后内联条变"草稿就绪 · 点击查看"，点击重弹） |
| `error` | no | yes | no（用户点击内联条 → 重弹 AIInterview enrich，带草稿回填） |

### 4.3. 跨页数据流

4.3.1. home → trip 跳转携带 `?id=<tripId>`；trip 页 mount 时从 trip-store 拉取 trip，按 4.2 状态机渲染。

4.3.2. 不新增任何 props/EventBus 通信。home 页采访完成后 `Taro.redirectTo` 跳 trip 页，trip 页 mount 自然进入 generating 态 → Theater 自动展开（`theaterMinimized` 初值 false）。

---

## 5. 组件改造清单

### 5.1. AIInterview（核心改造）

5.1.1. 新增 `mode: 'create' | 'enrich'` prop（必填），默认无；调用方必传。

5.1.2. `create` 模式步骤定义：

| # | 字段 | 必填 | 控件 | 跳过文案 |
| --- | --- | --- | --- | --- |
| 1 | 目的地 destinations | 否 | DestinationPicker | "跳过 · AI 会基于偏好为你推荐" |
| 2 | 日期 dates | 是 | DatePicker | — |
| 3 | 人数 pax | 是 | Picker (1–99) | — |
| 4 | 偏好 preferences | 否 | 现有 chips/输入 | "跳过" |
| 5 | 攻略名 name | 否 | Input | "跳过 · AI 智能生成" |

5.1.3. `enrich` 模式只渲染步骤 4。

5.1.4. `onSubmit` 回调签名（discriminated union）：

```typescript
type AIInterviewSubmit =
  | {
      mode: 'create'
      destinations: Destination[]  // 允许 []
      startDate: string
      endDate: string
      pax: number
      preferences: AIPreferences
      name?: string                // undefined / '' 表示请 AI 生成
    }
  | {
      mode: 'enrich'
      preferences: AIPreferences
    }

interface AIInterviewProps {
  open: boolean
  mode: 'create' | 'enrich'
  tripId?: string  // enrich 模式必传；用于 draft key 隔离
  onClose: () => void
  onSubmit: (data: AIInterviewSubmit) => void
}
```

5.1.5. **草稿持久化（A.3.1）**：

5.1.5.1. AIInterview 内部用 `Taro.setStorageSync/getStorageSync` 持久化所有字段 + 当前步骤索引。

5.1.5.2. Draft key：
- `create` 模式：单一全局 key `ai-interview-draft-create`
- `enrich` 模式：`ai-interview-draft-enrich-<tripId>`

5.1.5.3. mount 时若 draft 存在 → 回填所有字段 + 跳到 draft 记录的步骤索引。

5.1.5.4. 每次步骤推进、字段变更都同步 storage。

5.1.5.5. 清空时机：
- `create` 草稿：调用方在 `createTripAndFireAI` 成功后清空（通过工具函数内置）
- `enrich` 草稿：调用方在 apply 或 discard Preview 时清空（在 trip 页 `handlePreviewApply` / `handlePreviewDiscard` 中调用）

5.1.5.6. 不清空场景：用户从 Theater 点"停止生成"、AI 返回 error、用户关闭 sheet 未提交。下次打开同 mode/tripId 的 AIInterview 时草稿仍生效。

5.1.6. **Sheet 锚定修复**：参照 `TemplateImport` 已落地的方案，用 Taro `RootPortal` 把 mask 根节点挂到页面根，绕过祖先 `transform` 容器（详见 § 5.8 全局收口）。

### 5.2. TripAIStatusBar（重构为内联常驻条）

5.2.1. 命名保留（不改名），但语义从"最小化态的浮动条"变为"`aiStatus` 非空时的内联常驻条"。

5.2.2. Props：

```typescript
interface TripAIStatusBarProps {
  status: 'generating' | 'ready' | 'error'
  onTap: () => void
}
```

5.2.3. CSS：去掉 `position: fixed`，改为常规块级元素，由调用方在 trip 页攻略 tab 内决定挂载位置（spec 5.4 详述）。

5.2.4. 三态视觉（具体设计稿由 frontend-design 出，本 spec 给语义约束）：

| status | 文案 | 视觉提示 | 点击行为 |
| --- | --- | --- | --- |
| `generating` | "AI 正在为你编排…" | shine 动画 + 3 个跳动点 | 展开 Theater（`setTheaterMinimized(false)`） |
| `ready` | "AI 草稿就绪 · 点击查看" | 静态高亮 + 右箭头 | 重弹 AIPlanPreview |
| `error` | "AI 生成失败 · 点击重试" | 红边 + 警示符号 | 弹 AIInterview enrich 模式（带草稿回填） |

5.2.5. trip 页渲染时：仅当 `t.aiStatus != null` 渲染 TripAIStatusBar；**`aiStatus` 为 null 时整个组件不进入 DOM，不占位、不留任何 margin/padding 空白**（通过外层条件渲染实现，组件内部不做"空态占位"分支）。

### 5.3. AILoadingTheater（字幕节奏）

5.3.1. 文案改造：

```typescript
// 5 阶段，每阶段 2-3 条候选；按顺序消费，不循环
const PHASES: ReadonlyArray<ReadonlyArray<string>> = [
  // Phase 1: 分析
  ['正在阅读你的偏好…', '理解你的旅行节奏…'],
  // Phase 2: 搜索
  ['搜索目的地周边亮点…', '查阅当季节庆与限定活动…', '匹配你品味的小众场所…'],
  // Phase 3: 路线
  ['为你规划最优路线…', '权衡步行与公共交通…', '避开堵车与排队高峰…'],
  // Phase 4: 估算
  ['估算每日开销…', '挑选性价比餐厅…'],
  // Phase 5: 编排
  ['排版每日行程卡…', '为你写下攻略简介…', '正在为你编排成册…'],
] as const
```

5.3.2. 消费策略：

```
i = 0; phaseIdx = 0; itemIdx = 0
loop:
  show PHASES[phaseIdx][itemIdx]
  schedule next tick: 2400ms + random(0, 1200)ms
  itemIdx++
  if itemIdx >= PHASES[phaseIdx].length:
    itemIdx = 0
    phaseIdx++
    if phaseIdx >= PHASES.length:
      phaseIdx = PHASES.length - 1
      itemIdx = PHASES[phaseIdx].length - 1
      // 停在最后一条，不再切换
      break loop
```

5.3.3. 间隔随机：`setTimeout` 而非 `setInterval`，每次重新计算 `2400 + Math.random() * 1200`。

5.3.4. 不依赖云函数实际进度（云函数无 stream）；用户视觉感受"AI 在按阶段工作"即可。

### 5.4. trip 页 (`src/pages/trip/index.tsx`)

5.4.1. 新增 `theaterMinimized` 已在 Phase 5 实现，保留。

5.4.2. 渲染：

```tsx
{/* 全屏剧场 */}
<AILoadingTheater
  open={t.aiStatus === 'generating' && !theaterMinimized}
  status='thinking'
  onCancel={handleTheaterCancel}
  onMinimize={handleTheaterMinimize}
/>

{/* 攻略 tab 内联常驻条（仅在攻略 tab 激活时渲染） */}
{activeTab === 'plan' && t.aiStatus && (
  <View className='trip-ai-inline'>
    <TripAIStatusBar
      status={t.aiStatus as 'generating' | 'ready' | 'error'}
      onTap={handleInlineBarTap}
    />
  </View>
)}
```

5.4.3. 内联条挂载位置：在攻略 tab 的"**日期 chips 之上、攻略卡片标题之下**"。具体 DOM 节点位置由实施期对照当前 `index.tsx` 攻略 tab 区域确定。

5.4.4. `handleInlineBarTap`：

```typescript
const handleInlineBarTap = () => {
  if (!t || !isOwner) return
  if (t.aiStatus === 'generating') {
    setTheaterMinimized(false)
  } else if (t.aiStatus === 'ready') {
    setAiPreviewOpen(true)
  } else if (t.aiStatus === 'error') {
    setAiFormOpen(true)  // 触发 AIInterview enrich
  }
}
```

5.4.5. `handlePreviewApply` / `handlePreviewDiscard` 中**新增**清空 enrich 草稿调用：`Taro.removeStorageSync(\`ai-interview-draft-enrich-${t._id}\`)`。

5.4.6. `handleTheaterCancel`（停止生成）：**不**清空草稿，让用户重试时仍能回填。

### 5.5. home 页 (`src/pages/home/index.tsx` + 4 个主题分发子组件)

5.5.1. `src/pages/home/index.tsx`（分发器）：

5.5.1.1. 新增 `interviewOpen` state。

5.5.1.2. 新增 `handleAiCreate(data)` 处理 AIInterview create 模式提交，调用 `utils/ai-task.ts` 新增的 `createTripAndFireAI`，跳转 trip 页。

5.5.1.3. `onAITrip` 传给四个主题子组件改为 `() => setInterviewOpen(true)`。

5.5.1.4. 在 home 页根节点渲染：

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

5.5.2. `HomeMagazine.tsx`：把 `featAI && <HomeCardAIRow status={featAI} />` 扩展到**全部** trip 卡片，而非仅 featured。featured 卡片单独保留一份在大封面位置。

5.5.3. `HomePostcard.tsx`：在每个印章卡片下方新增 `HomeCardAIRow` 渲染（与其他主题一致），保留印章上现有的 `aiglow` / `✓` 微动效作为补充。

5.5.4. `HomeTegami.tsx` / `HomeMinimal.tsx`：DOM 不动，仅承接 5.5.5 的 frontend-design 视觉稿带来的 CSS 变更。

5.5.5. **HomeCardAIRow 视觉差异化**：本 spec 不固化每主题视觉细节，**实施 Phase 1 必须先调 `/frontend-design`** 出 4 主题×3 状态共 12 个视觉稿，再进入 SCSS 实现。约束：

| 主题 | 设计语言 token |
| --- | --- |
| tegami 手帖 | 信封折角 / 邮戳字母 / 暖橘色描边 |
| magazine 刊物 | 报头横线 / 装订小圆点 / 黑底白字数字标号 |
| postcard 明信片 | 椭圆戳轮廓 / 虚线边 / 牛皮纸底色 |
| minimal 极简 | 极细 hairline / 等宽数字进度 / 大量留白 |

5.5.6. 状态文案保持一致：generating "AI 正在为你编排"、ready "AI 草稿就绪 · 点击查看"、error "AI 生成失败 · 点击重试"。视觉差异仅在视觉元素层。

### 5.6. new-trip 页 (`src/pages/new-trip/index.tsx`)

5.6.1. 删除：

- `import AIInterview from '../../components/AIInterview'`
- `interviewOpen` state
- `useEffect` 监听 `router.params.openAI`
- `handleAiSubmit` 函数
- `nt-submit-ai` 按钮
- 底部 `<AIInterview … />` 渲染段
- 与 `ai-task.ts` 相关的 import（`newAITaskId`, `fireAITask`）

5.6.2. 保留：手动新建逻辑（`submit` / `name` / `dates` / `destinations` / `pax`），变成纯手动新建入口。

5.6.3. 副作用确认：`src/pages/home/shared.tsx` 中 `onAITrip` 仍然存在，但 4 主题子组件触发它后由 home 分发器拉起 AIInterview，**不再** `navigateTo('/pages/new-trip?openAI=1')`。

### 5.7. utils/ai-task.ts

5.7.1. 新增工具：

```typescript
export interface CreateAITripInput {
  destinations: Destination[]
  startDate: string
  endDate: string
  pax: number
  name?: string  // 空 → 占位 "AI 生成中…"
  ownerOpenid: string
  ownerNickname: string
  ownerAvatarUrl: string
}

/**
 * 完成一次首页 AI 创建：创建 trip → 落 aiTaskId/aiStatus='generating' → fireAITask → 清空 create 草稿
 * 返回新建的 tripId；失败抛错由调用方 toast
 */
export async function createTripAndFireAI(
  input: CreateAITripInput,
  preferences: AIPreferences,
): Promise<string>
```

5.7.2. 内部流程：

1. `buildNewTrip` (`name` 空时用 "AI 生成中…" 占位)
2. `createTrip(input)`
3. `newAITaskId()` + `updateTrip(tripId, { aiTaskId, aiStatus: 'generating', aiDraft: null, aiError: null }, openid)`
4. `fireAITask(taskId, { tripId, tripContext, preferences })`
5. `Taro.removeStorageSync('ai-interview-draft-create')`
6. return `tripId`

### 5.8. 全项目 sheet 视口锚定收口

5.8.1. 适用组件（7 个）：`AIInterview`、`AILoadingTheater`、`TripActionSheet`、`CollaboratorsSheet`、`CoverPicker`、`ShareTypeSheet`、`AIPlanPreview`。

5.8.2. 参照实现：`src/components/TemplateImport/index.tsx` 今早修复后的写法。所有上述组件按同一套结构改造：

5.8.2.1. 顶层用 `<RootPortal>` 包裹整个 mask + sheet 节点，确保 portal 目标是页面根而非组件挂载点。

5.8.2.2. mask 节点保持 `position: fixed; inset: 0;`；sheet 节点保持 `align-items: flex-end` / `bottom: 0` 的现有约定。

5.8.2.3. `open === false` 时仍然渲染 RootPortal 容器但内部返回 `null`，避免每次开关重新创建 portal 引起闪烁（与 TemplateImport 保持一致即可）。

5.8.3. 验证标准：在攻略 tab、清单 tab、地图 tab 等不同滚动位置触发各 sheet 时，sheet 顶边均贴在视口底部弹出，不被任何祖先 `transform` 容器拉到文档底部。

5.8.4. 若某组件改造后出现层级问题（z-index 冲突 / 多 sheet 叠加），在实施 plan 中单点收敛（不在本 spec 预先约束 z-index 值）。

5.8.5. 不在本子项目范围内的组件（`TemplateImport` / `EditSpotSheet` / `DestinationPicker` / `SpotSearch`）已落地相同方案，不再改动。

---

## 6. 云函数 `ai-plan-trip` 改造

### 6.1. 入参变更

6.1.1. 允许 `tripContext.destinations` 为空数组（已经允许？实施期 grep 校验）。

6.1.2. 入参新增可选 `userProvidedName?: string`。若 `userProvidedName` 为空，模型需在主结果里返回 `name` 字段。

### 6.2. 主 prompt 改造

6.2.1. 当 `destinations` 非空：照旧生成 `days`；若 `userProvidedName` 空则一并返回 `name`，否则不返回。

6.2.2. 当 `destinations` 为空：

- 在主 prompt 中增加指令"请基于 preferences / 日期 / 人数推荐 1–3 个具体目的地（含中文名 + 国家/城市），写入 `recommendedDestinations` 字段；同时按推荐目的地生成 `days`"
- 软约束："以一个主目的地为主，可加 1–2 个邻近顺路点"
- 若 `userProvidedName` 空，照常生成 `name`

6.2.3. 主调用返回 JSON schema 扩展：

```json
{
  "days": [...],
  "name": "京都 · 晚秋四日",
  "recommendedDestinations": [
    { "name": "京都", "country": "日本", "city": "京都府" }
  ]
}
```

`recommendedDestinations` 仅在用户未填目的地时返回；否则字段缺省。

### 6.3. 重试机制（destinations 兜底）

6.3.1. 触发条件：用户未填 destinations **且** 主调用返回的 `recommendedDestinations` 为空数组或缺失。

6.3.2. 重试 prompt：**独立、精简、单任务**。输入：

- 主调用已生成的 `days` 摘要（每个 day 的 `title` + `date`，**不传 items**）
- `name`
- `preferences`
- `pax`

约束指令大致："这是已生成的攻略概要：[摘要]。请基于此推断 1–3 个最匹配的具体目的地（中文名 + 国家/城市），仅返回 JSON `{ destinations: [...] }`，不要返回其他字段，不要重新生成攻略。"

6.3.3. 重试上限：**3 次**，每次同一 prompt（不堆叠纠偏指令）。

6.3.4. 任一次返回 `destinations` 非空数组 → 视为成功，把其结果写入 `recommendedDestinations` 字段返回。

6.3.5. 3 次全空 → 云函数把 trip 落库：

```typescript
{
  aiStatus: 'error',
  aiError: 'AI 未能推荐目的地，请稍后重试或手动添加',
  aiDraft: null,  // 已生成的 days 整体丢弃
}
```

6.3.6. Token 节省说明：重试 prompt 只传 day 标题 + 日期摘要，不传完整 items，节省 ~70% input token。

### 6.4. apply 阶段（前端 `AIPlanPreview` 流程）

6.4.1. apply 时 `trip.destinations` 合并策略：

- 若用户原本填了 destinations → 保持不变
- 若用户原本未填 destinations 且 `aiDraft.recommendedDestinations` 非空 → 写入 `trip.destinations = recommendedDestinations`

6.4.2. apply 时 `trip.name` 合并：

- 若 trip 当前 name 是 "AI 生成中…" 占位 **且** `aiDraft.name` 非空 → 替换为 `aiDraft.name`
- 否则保持现 name 不变

6.4.3. 上述合并写入逻辑放在 `handlePreviewApply` 内或 `utils/ai-apply.ts` 新增辅助函数中。

---

## 7. 文件清单（实施时改 / 新增）

### 7.1. 修改

| 路径 | 改动 |
| --- | --- |
| `src/components/AIInterview/index.tsx` | 新增 `mode` prop + 5 步条件渲染 + 草稿持久化 + RootPortal 包裹 |
| `src/components/AILoadingTheater/index.tsx` | 顶层 `RootPortal` 包裹（除字幕改造外） |
| `src/components/TripActionSheet/index.tsx` | 顶层 `RootPortal` 包裹 |
| `src/components/CollaboratorsSheet/index.tsx` | 顶层 `RootPortal` 包裹 |
| `src/components/CoverPicker/index.tsx` | 顶层 `RootPortal` 包裹 |
| `src/components/ShareTypeSheet/index.tsx` | 顶层 `RootPortal` 包裹 |
| `src/components/AIPlanPreview/index.tsx` | 顶层 `RootPortal` 包裹 |
| `src/components/AIInterview/index.scss` | 步骤进度点扩到 5；name 步骤"跳过"按钮样式 |
| `src/components/TripAIStatusBar/index.tsx` | 重写：去掉浮动逻辑，纯内联组件；按 status 渲染三态 |
| `src/components/TripAIStatusBar/index.scss` | 重写：去掉 `position: fixed`；按 frontend-design 稿出 4 主题 × 3 状态 |
| `src/components/HomeCardAIRow/index.tsx` | DOM 微调以承接 4 主题视觉差异（按 frontend-design 稿） |
| `src/components/HomeCardAIRow/index.scss` | 按 frontend-design 稿重写为 4 主题 × 3 状态 |
| `src/components/AILoadingTheater/index.tsx` | 字幕清单改 5 阶段 / 不循环；间隔 2400-3600ms 随机 |
| `src/pages/home/index.tsx` | 新增 `interviewOpen` + `handleAiCreate` + AIInterview 渲染 |
| `src/pages/home/HomePostcard.tsx` | 新增 `HomeCardAIRow` 渲染（每卡片下方） |
| `src/pages/home/HomeMagazine.tsx` | `HomeCardAIRow` 扩展到全部卡片（非仅 featured） |
| `src/pages/trip/index.tsx` | 内联条挂载到攻略 tab 顶部；`handleInlineBarTap` 替代旧 bar tap；apply/discard 清 enrich 草稿；删除 `TripAIStatusBar` 旧浮动渲染 |
| `src/pages/new-trip/index.tsx` | 删除 AI 按钮、AIInterview 引用、`openAI=1` 处理、`handleAiSubmit` |
| `src/utils/ai-task.ts` | 新增 `createTripAndFireAI(input, preferences)` 工具 |
| `cloudfunctions/ai-plan-trip/index.ts`（或 `.js`） | 主 prompt 调整；新增重试分支；返回 schema 扩展 |

### 7.2. 新增

| 路径 | 责任 |
| --- | --- |
| `docs/superpowers/frontend-design/2026-05-27-ai-status-visual.md` | frontend-design 阶段产出的 4 主题×3 状态视觉稿（由 /frontend-design 生成） |
| `src/utils/ai-apply.ts`（可选） | 若 apply 合并逻辑较长，从 trip/index.tsx 抽出 |

### 7.3. 删除

无（new-trip 页只是删行，不删文件）。

---

## 8. 错误处理

| 场景 | 行为 |
| --- | --- |
| 首页采访中 `createTrip` 失败 | `Taro.showToast('创建失败')`；AIInterview 保留在最后一步不关闭；草稿仍在 |
| 首页采访中 `fireAITask` 失败 | trip 已落库，redirect 到 trip 页；trip 页内联条显示 `error` 态 |
| 云函数 destinations 重试 3 次仍空 | 见 6.3.5；前端首页/trip 页内联条均显示 error 态 |
| 云函数返回 `name` 为空且用户未填 | apply 时 fallback 到占位名 `"未命名攻略"` |
| `AIInterview` enrich 模式收到 destinations/date/pax 字段 | 类型层用 union 阻断；运行时若错传则忽略 |
| Sheet 锚定 RootPortal 兜底无效 | 实施期收敛：确认祖先 transform 容器并移除（home/trip 页根节点不应该有 transform） |
| 草稿 storage 写入失败（小程序存储满） | 静默失败，AIInterview 仍能在内存运行；下次打开无回填 |

---

## 9. 测试矩阵（人工冒烟）

全部在微信开发者工具 + 微信小程序真机上验证。

| # | 分支 | 操作 | 期望 |
| --- | --- | --- | --- |
| A1 | 首页 AI 完整流（含目的地） | 首页 → AI CTA → 5 步走完（destinations 填、name 填）→ redirect trip 页 → Theater 弹起 → ready → Preview 自动弹 → apply | trip.name = 用户填的；trip.destinations = 用户选的；days 来自 AI |
| A2 | 首页 AI 推荐目的地分支 | 首页 → AI CTA → 步骤 1 跳过 → 2/3 填 → 4 填偏好 → 5 跳过名字 → 提交 | apply 后 trip.name = 云函数生成；trip.destinations = `recommendedDestinations`；首页 thinking 期间显示占位名"AI 生成中…" |
| A3 | trip 页 enrich 分支 | trip 页 → AIBadge → 只看到偏好步骤 → 提交 → 内联条 + Theater 出现 | trip.destinations/date/pax 不变；内联条常驻 |
| A4 | Theater 最小化 → 内联条仍在 | A1 中 Theater 弹出 → 点 × → Theater 消失但攻略 tab 顶部内联条仍显示 generating | 内联条不依赖 minimized 态 |
| A5 | ready 态点击重弹 Preview | A1 ready 时关闭 Preview（既不 apply 也不 discard）→ trip 页内联条变 ready 文案 → 点击 | Preview 重新弹起 |
| A6 | error 态点击重试 | 触发 AI 后云函数失败 → 首页 HomeCardAIRow / trip 页内联条 显示 error → 点击 | trip 页：弹 AIInterview enrich 模式，**preferences 字段回填上次填的内容** |
| A7 | sheet 锚定 · AIInterview | 首页滚到底部 → 点 AI CTA → sheet 从视口底部滑入 | sheet 贴视口底；不被外层 transform 推到文档底部 |
| A7b | sheet 锚定 · 其余 6 个 sheet | 在各 tab 滚到非顶部位置时依次触发 AILoadingTheater / TripActionSheet / CollaboratorsSheet / CoverPicker / ShareTypeSheet / AIPlanPreview | 每个都贴视口底；与 TemplateImport 行为一致 |
| A7c | TripAIStatusBar 空态不占位 | trip 页 `aiStatus = null` 状态切到攻略 tab | 攻略 tab 顶部日期 chips 紧贴标题，无内联条占位空白 |
| A8 | 字幕节奏 | Theater 打开 30 秒 | 字幕变化 8–12 次；无重复循环；视感 2.4–3.6 秒一次；30 秒后停在最后一条 |
| A9 | 4 主题 ×3 状态视觉 | 4 主题切换 × 模拟 generating/ready/error | 每主题 HomeCardAIRow / 内联条均显示各自视觉元素（按 frontend-design 稿） |
| A10 | 草稿回填（create 模式） | 首页 → AI CTA → 走到步骤 4 中途关闭 sheet → 再点 AI CTA | 自动回到步骤 4，前 3 步已填的目的地/日期/人数均保留 |
| A11 | 草稿回填（enrich 模式） | trip 页 AI → preferences 填几个 → 停止 → 再点 AIBadge | 直接进入 preferences 步骤，已填字段保留 |
| A12 | 草稿清空（成功 apply） | A1 走完到 apply → 再次首页 AI CTA | 5 步从空白开始（create 草稿被 createTripAndFireAI 清空） |
| A13 | new-trip 页无 AI 按钮 | 4 主题切换 + 进入 new-trip 页 | 底部只有"取消 + 创建"两个按钮，无 AI 按钮；URL `openAI=1` 不再触发 sheet |
| A14 | 云函数重试机制 | mock 云函数主 prompt 返回空 `recommendedDestinations`（开发期可在 prompt 中故意制造）| 云端日志可见 3 次重试 prompt 调用；前端最终 ready；若全空则 error |
| A15 | Magazine 全卡片 AI 状态 | 创建 2 个 trip，其中非 featured 那个 `aiStatus='generating'` | featured 卡和非 featured 卡都显示 `HomeCardAIRow` |
| A16 | Postcard 印章下方 AI 状态 | 任一明信片主题 trip 处于 generating | 印章本体仍有 `aiglow`；印章下方新增 `HomeCardAIRow` 文字 |

---

## 10. 自审检查清单

10.1. 与 design system spec § 6.1.3 一致：AIInterview 替代 AIPlanForm ✓

10.2. 与 design system spec § 6.1.4 一致：AILoadingTheater 保留 ✓

10.3. 与 design system spec § 6.1.9 一致：TripAIStatusBar 保留 ✓（但语义从浮动改为内联，需在实施 plan README 中标注此偏离）

10.4. 未引入 `console.log`：实施期 hook 检查

10.5. 未硬编码主题色：HomeCardAIRow / TripAIStatusBar 仍走 CSS 变量，frontend-design 稿出主题 token 而非 hex

10.6. Immutability：trip-store 更新仍走 spread 模式

10.7. 无 emoji：本 spec 不引入新 emoji；现有 `nt-submit-ai` 按钮的 `✨` emoji 随按钮删除一并消失

10.8. 类型严格：`AIInterviewSubmit` 用 discriminated union，无 `any`

---

## 11. 已识别偏离

11.1. design system spec 写 `AILoadingTheater` 的 props 为 `{open, tripId, onCancel, onMinimize, onComplete}` 且组件内部订阅 `trip.aiStatus`。本 spec **沿用** Phase 5 已落地的 dumb API `{open, status, onCancel, onMinimize}`，由父级 trip 页订阅。理由与 Phase 5 一致：组件保持可独立呈现且无 Provider 依赖；功能等价。

11.2. design system spec § 6.1.9 的 `TripAIStatusBar` 定义为"最小化态浮动 status bar"。本 spec 改为"`aiStatus` 非空时内联常驻条"，覆盖三态。理由：诉求 #4 明确"即便用户关闭 AILoadingTheater 也能看见 AI 生成中状态"，原浮动条仅在 `theaterMinimized=true` 显示不满足该语义。实施 plan README 中标注。

---

## 12. 后续 plan 入口

本 spec 完成 + 用户审查通过后，调用 superpowers:writing-plans 生成实施计划：

12.1. Phase 1：调用 `/frontend-design` 出 4 主题×3 状态视觉稿，落地 `docs/superpowers/frontend-design/2026-05-27-ai-status-visual.md`。

12.2. Phase 2：AIInterview mode 改造 + 草稿持久化 + RootPortal 锚定；同 Phase 内顺手把其余 6 个 sheet（AILoadingTheater/TripActionSheet/CollaboratorsSheet/CoverPicker/ShareTypeSheet/AIPlanPreview）按 TemplateImport 方案统一包裹 RootPortal。

12.3. Phase 3：utils/ai-task.ts 新增 `createTripAndFireAI`；home 分发器接入 AIInterview。

12.4. Phase 4：new-trip 页清理 AI 入口。

12.5. Phase 5：TripAIStatusBar 重构为内联条 + trip 页接入。

12.6. Phase 6：HomeCardAIRow 视觉重写（按 frontend-design 稿）；HomePostcard / HomeMagazine 渲染范围扩展。

12.7. Phase 7：AILoadingTheater 字幕节奏。

12.8. Phase 8：云函数 `ai-plan-trip` 改造（主 prompt + 重试分支 + apply 合并）。

12.9. Phase 9：A1–A16 冒烟矩阵全量验收。
