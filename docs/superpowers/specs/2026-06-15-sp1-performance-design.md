# SP-1 · 全小程序性能优化 设计文档

> 日期：2026-06-15 ｜ 子方案：SP-1（隶属"整份优化报告"拆分的第一个子方案）
> 状态：设计待评审

## 0. 背景与目标

用户反馈：**每次进入首页都要等一会才能看到攻略列表**。经系统性体检（三路并行代码审查 + 人工复核，剔除臆测结论），确认首屏卡顿的主因是**列表请求串行等待 `ensure-user`** 等加载链路问题，并顺带梳理出冗余云调用、编辑卡顿与少量渲染微优化。

本子方案目标：**显著降低首页首屏可见延迟**，并清理与之相关的冗余云调用与编辑期主线程开销。不追求一次做完整份优化报告（分包/包体积、架构重构等在后续 SP-2~SP-5）。

### 验收口径（体感）
- 进入首页**立即**看到内容（本地种子 + 上次缓存的列表），真实列表在后台回填。
- 同一次会话内重复进出首页不再发起重复全量请求。
- 打开攻略详情页不再额外等待一次 `ensure-user`。
- 编辑长行程（多天多景点）时输入不卡顿。

## 1. 范围

纳入：**A 首屏延迟（全套）**、**B 冗余云调用（B1/B2/B3）**、**C 编辑卡顿（C1/C3）**、**D 渲染微优化（D1/D3/D4，选做）**。
A5 采用**方案一（修依赖轮询）**，watch 推送方案明确延后到 SP-3。

不纳入（延后）：
- A5 改 `watch` 推送 → SP-3。
- B2 跨设备配额强一致 → 接受 SWR 弱一致。
- C2（`withSyncedDays`）→ 复核为 O(天数) 浅拷，开销可忽略，**不动**。
- D2 各 View 的 useMemo 批量优化 → SP-5（架构）。
- 包体积/资源（`default-cover.jpg`、`trips.json`、`cache.enable`）→ SP-2。
- trip-store 增量保存 → SP-3 评估。

---

## 2. A · 首屏加载性能（`src/pages/home/index.tsx`）

将首页数据加载重构为单一入口 `loadTrips()`，并配合缓存与初值改造。

### A1 解除 `openid` 串行依赖（并行化）
- **问题**：加载 effect 开头 `if (!openid) return`（`home/index.tsx:39`），`openid` 来自 `me-store` 的 `ensure-user`，导致 `ensure-user → list-my-trips` 两个云函数**串行**堆在关键路径。
- **依据**：`cloudfunctions/list-my-trips/index.js:5` 从 `cloud.getWXContext()` 取 `OPENID`，`db.ts` 的 `listMyTrips` 调用**不传任何参数**。客户端**无需等待** `ensure-user`。
- **做法**：`loadTrips()` 在挂载时**无条件**发起 `listMyTrips()`，与 `ensure-user` 并行。`openid` 仅用于后续的归属判断（重命名/删除/复制等交互），不阻塞首屏。

### A2 立即渲染本地种子
- **问题**：`SEED_TRIPS` 为静态本地数据，却只在网络 `.then` 里才 `setTrips([...SEED_TRIPS, ...list])`（`:42`），初值 `trips=[]` 导致等待期空屏。
- **做法**：`trips` 初值直接为 `SEED_TRIPS`；网络返回后合并为 `[...SEED_TRIPS, ...list]`。

### A3 Storage 缓存（stale-while-revalidate）
- **做法**：缓存键 `home-trips-cache`（单键；小程序单设备单用户，账号切换罕见，由下次网络结果覆盖）。仅缓存**网络列表部分**（不含种子）。
  - `loadTrips()`：先读缓存 → 有则立即 `setTrips([...SEED_TRIPS, ...cached])` 并 `loading=false`；
  - 再后台 `listMyTrips()` → 成功后 `setTrips` 覆盖 + `writeCache(list)`。
- **接受的取舍**：极端情况下别的设备刚删/改的行程会**短暂（几百 ms）显示旧态**，网络回来即纠正。对行程 app 可接受。

### A4 去重首次双拉
- **问题**：`useEffect`（`:41`）与 `useDidShow`（`:54`）都会拉列表，`useDidShow` 首次显示也触发 → 首进发两次。
- **做法**：`loadTrips()` 内加 `lastLoadedAtRef` 节流（距上次 < 2s 直接跳过网络部分）。挂载 effect 调一次 `loadTrips()`；`useDidShow` 也调 `loadTrips()`，刚加载过即 no-op。

### A5 AI 轮询依赖 bug（方案一）
- **问题**：`useEffect(..., [openid, trips])`（`:59-69`）的 interval 每轮 `setTrips` 都改变 `trips` 引用 → 定时器**每轮拆建**，时序脆弱。
- **不能简单改 `[openid]`**：`trips` 依赖身兼"启动/停止轮询"两职，改 `[openid]` 会令 `hasGenerating` 闭包定格，导致永不启动或永不停止。
- **做法**：在 render 计算 `const hasGenerating = trips.some(t => t.aiStatus === 'generating')`，effect 依赖改为 `[hasGenerating]`。定时器仅在 `hasGenerating` 翻转时开/关，生成期间稳定每 **8s**（从 5s 放宽）轮询一次。轮询体内复用 `loadTrips()`/`listMyTrips()`。
- **配额联动**：额外一个 effect 监听 `hasGenerating` 由 `true→false`（生成完成）时调用 `me-store` 的 `refreshQuota()`（见 B2）。该刷新触发点设计为与轮询/未来 watch 解耦——SP-3 换 watch 时此处可平移、B2 不返工。

---

## 3. B · 冗余云调用

### B1 复用 openid，去掉 trip 页独立 `ensure-user`
- **问题（已核实）**：`src/pages/trip/index.tsx:388-399` 自行 `callFunction('ensure-user')` 并维护本地 `openid` state，与 `MeProvider` 重复。每次进攻略详情多一次云调用 + 一段"登录中…"等待。
- **做法**：删除该 effect 与本地 `openid` state，改用 `useMe().me?.openid`；未就绪时维持"登录中…"占位。`TripProvider` 从该 openid 挂载。

### B2 配额缓存（me-store + SWR）
- **问题**：`src/components/AIInterview/index.tsx:94-105` 每次 `open` 都 `callFunction('ai-plan-trip', {_mode:'quota'})`。配额是用户级，不必每次重拉。
- **做法**：
  - `me-store` 增加 `quota: { flash: number; pro: number } | null` 与 `refreshQuota()` 方法；启动（`ensure-user` 后）拉一次。
  - `AIInterview` 改为消费 `useMe().quota`，**立即**显示缓存值；`open` 时后台调 `refreshQuota()` 校正（SWR）。
  - 生成完成后由首页触发 `refreshQuota()`（见 A5）。
- **取舍**：配额是"能否消费"的闸门，显示过期偏高会误导，故**不强缓存**，采用 stale-while-revalidate（立即显示 + 后台校正 + 完成后刷新）。

### B3 POI 搜索结果缓存
- **问题**：`DestinationPicker` 与 `SpotSearch` 各自直连 `cloud.searchPoi`，相同关键词重复请求、无去重。
- **做法**：**不做组件重构**。在 `src/utils/cloud.ts` 的 `searchPoi` 调用层加模块级缓存：`Map<key, { results, ts }>`，key = `keyword`（必要时含 city），TTL 10min，LRU 上限 ~30 条。两个组件同时受益，改动最小。

---

## 4. C · 编辑卡顿（`src/store/trip-store.tsx`）

### C1 指纹延迟（不改成有损 hash）
- **问题**：保存 effect 体内每次 `state.trip` 变化都同步 `JSON.stringify(state.trip)`（`:211`）当版本指纹，长行程逐字编辑时阻塞主线程。
- **否决方案**：用 `days.length`/`packing.length` 等计数当指纹会**漏掉"改某景点备注/价格"这类编辑**（计数不变→不保存），是正确性 bug。
- **做法**：保留**全量精确**比较，但把 `JSON.stringify`+比较从"每次渲染同步执行"**移入 500ms debounce 回调内**——空闲 500ms 才序列化一次，而非每次按键。必须**完整保留** `lastSavedRef`/`pendingRef`/`deferredRemoteRef` 的"自身回声 / 保存期间远端更新"竞态处理语义。
- **风险**：此处是协作同步与保存竞态的核心，重构需谨慎；验收覆盖：连续编辑、保存期间收到 watch 更新、协作者并发改动。

### C3 Context value 包 useMemo
- **做法**：`trip-store`/`me-store`/`theme-store` 的 Provider `value` 用 `useMemo` 包裹。
- **诚实说明**：`trip-store` 编辑时 `state` 必变，memo 收益有限；`theme-store`/`me-store` 几乎不变，收益明显。三者都包（便宜、无害）。

> C2（`withSyncedDays`）经复核为 O(天数) 浅拷贝（`spots` 引用复用、不深拷），开销可忽略，**不修改**。

---

## 5. D · 渲染微优化（选做）

- **D4（正确性，必做）**：`src/components/SpotSearch/index.tsx` 结果列表 `key` 由 `${adcode}-${i}` 改为 `adcode`，避免结果刷新时节点错位。
- **D1**：`home/index.tsx:186-187` 的 `activeTrips`/`archivedTrips`（含 `getTripPhase` 计算）包 `useMemo`，依赖 `[trips]`。
- **D3**：`src/components/TripPhaseChip/index.tsx` 的 `phase` useMemo **去掉 `tick` 依赖**（仅依赖起止日期），消除每分钟全局重算；`TripPhaseHero` 的 60s `setInterval` 改为对齐"下一分钟/小时边界"的 `setTimeout` 自重排（保留倒计时显示，去掉无谓的固定轮询）。
- **不做**：D2 各 View 的 useMemo 批量优化（体感收益不抵改动面）→ 留 SP-5。
- **更正记录**：`{theme === 'x' && <X/>}` 只挂载当前一个主题变体，不存在"4 个变体一起 reconcile"，故无相关优化项。

---

## 6. 影响文件清单

| 文件 | 改动 |
|------|------|
| `src/pages/home/index.tsx` | A1~A5、D1 |
| `src/pages/trip/index.tsx` | B1 |
| `src/store/me-store.tsx` | B2（quota + refreshQuota）、C3 |
| `src/store/theme-store.tsx` | C3 |
| `src/store/trip-store.tsx` | C1、C3 |
| `src/components/AIInterview/index.tsx` | B2（消费缓存配额） |
| `src/utils/cloud.ts` | B3（searchPoi 缓存层） |
| `src/components/SpotSearch/index.tsx` | D4 |
| `src/components/TripPhaseChip/index.tsx` | D3 |
| `src/components/TripPhaseHero/index.tsx` | D3 |

## 7. 验证策略

仓库无测试运行器、无顶层 lint 脚本（`eslint`/`stylelint`/`commitlint` 经 husky 触发）。遵循 cloudbase-guidelines 工程约束：**禁用 `any`**、**完成前自验证**。

- **静态层**：`npx tsc --noEmit` 通过；提交触发的 eslint/stylelint 无新增错误。
- **运行层（微信开发者工具人工验证）**：
  1. 首页冷启动：立即可见种子 + 缓存列表；网络回填覆盖；
  2. 重复进出首页：不发起重复全量请求（控制台/Network 观察）；
  3. 攻略详情页：无第二次 `ensure-user`、无多余"登录中…"；
  4. `AIInterview`：打开瞬间显示配额、后台校正；
  5. 编辑多天行程：连续输入不卡；保存与协作同步行为正确（自身回声不重复保存、协作者改动能同步）；
  6. AI 生成：状态仍能刷新、完成后停止轮询、配额刷新。
- 凡本地无法验证的项，明确标注缺口，不假装通过。

## 8. 已接受的取舍小结
1. 首页列表 SWR：容忍极短暂的旧态显示。
2. 配额：SWR 弱一致（立即显示 + 后台校正 + 完成刷新），不追求跨设备强一致。
3. A5：方案一（轮询修复），实时 watch 延后 SP-3；`refreshQuota()` 钩子设计为对轮询/watch 透明，确保 SP-3 不返工。
