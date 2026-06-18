# SP-1 全小程序性能优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除首页首屏延迟（串行等待 `ensure-user`、空屏等网络），并清理相关的冗余云调用与编辑期主线程开销。

**Architecture:** 首页加载重构为单一 `loadTrips()`（并行发起、种子立即渲染、Storage SWR 缓存、首次 show 去重）；轮询修复依赖数组；trip 页复用 `me-store` 的 openid；配额改 me-store 懒加载缓存；trip-store 把版本指纹的 `JSON.stringify` 推迟进 debounce；外加少量渲染微优化。

**Tech Stack:** Taro 4.2 + React 18 + TypeScript（严格模式，禁用 `any`）+ CloudBase 云函数。

**测试说明：** 本仓库**无测试运行器**（无 jest/vitest），`eslint`/`stylelint` 经 husky + lint-staged 在提交时触发。因此每个任务的验证 = **静态层** `npx tsc --noEmit`（确认所触文件无新增类型错误）+ **运行层** 在微信开发者工具人工核对 + 提交。凡无法本地验证处明确标注。

---

## 文件结构（改动地图）

| 文件 | 职责 | 本计划改动 |
|------|------|-----------|
| `src/utils/cloud.ts` | 云函数调用封装 | Task 1：`searchPoi` 加模块级缓存 |
| `src/pages/trip/index.tsx` | 攻略详情页 | Task 2：删除独立 `ensure-user`，复用 me-store openid |
| `src/store/me-store.tsx` | 用户信息 store | Task 3：新增 `quota` + `refreshQuota`，value 包 useMemo |
| `src/components/AIInterview/index.tsx` | AI 访谈面板 | Task 4：消费 me-store 缓存配额 |
| `src/store/theme-store.tsx` | 主题 store | Task 5：value 包 useMemo |
| `src/store/trip-store.tsx` | 单条行程 store | Task 6：指纹延迟进 debounce + value 包 useMemo |
| `src/pages/home/index.tsx` | 首页分发器 | Task 7：A1~A5 加载重构 + D1 useMemo |
| `src/components/SpotSearch/index.tsx` | 景点搜索 | Task 8：结果 key 改稳定唯一键 |
| `src/components/TripPhaseChip/index.tsx` | 阶段徽标 | Task 9：phase useMemo 去掉 tick 依赖 |
| `src/components/TripPhaseHero/index.tsx` | 阶段英雄区 | Task 9：phase useMemo 去掉 tick 依赖 |

依赖顺序：Task 3（me-store 暴露 `refreshQuota`）必须在 Task 7（A5 生成完成刷新配额）之前。其余任务相互独立。

---

## Task 1: B3 · POI 搜索结果缓存

**Files:**
- Modify: `src/utils/cloud.ts`（`searchPoi` 定义处，当前约 `:43-44`）

- [ ] **Step 1: 在 `export const cloud` 之前插入模块级缓存与包装函数**

在 `cloud.ts` 中 `async function call<...>` 之后、`export const cloud = {` 之前，插入：

```ts
// ── POI 搜索缓存：相同关键词 10min 内复用，LRU 上限 30，减少高频搜索的重复云调用 ──
const POI_CACHE_TTL = 10 * 60 * 1000
const POI_CACHE_MAX = 30
const poiCache = new Map<string, { results: PoiResult[]; ts: number }>()

async function searchPoiCached(data: { keyword: string; city?: string }): Promise<{ results: PoiResult[] }> {
  const key = `${data.keyword}::${data.city || ''}`
  const now = Date.now()
  const hit = poiCache.get(key)
  if (hit && now - hit.ts < POI_CACHE_TTL) {
    poiCache.delete(key)        // 命中后移到队尾，维持 LRU 顺序
    poiCache.set(key, hit)
    return { results: hit.results }
  }
  const res = await call<typeof data, { results: PoiResult[] }>('amap-poi-search', data)
  poiCache.set(key, { results: res.results, ts: now })
  if (poiCache.size > POI_CACHE_MAX) {
    const oldest = poiCache.keys().next().value
    if (oldest) poiCache.delete(oldest)
  }
  return res
}
```

- [ ] **Step 2: 把 `cloud.searchPoi` 指向缓存版**

在 `export const cloud = {` 内，将：

```ts
  searchPoi: (data: { keyword: string; city?: string }) =>
    call<typeof data, { results: PoiResult[] }>('amap-poi-search', data),
```

改为：

```ts
  searchPoi: searchPoiCached,
```

- [ ] **Step 3: 静态验证**

Run: `npx tsc --noEmit`
Expected: 无新增错误（特别是 `cloud.ts`）。

- [ ] **Step 4: 运行层验证（开发者工具）**

在「新建攻略」或「AI 规划第一步」搜索同一城市两次（如"南京"），第二次应**无新的 `amap-poi-search` 云函数调用**（Network/云调用面板观察），结果立即出现。

- [ ] **Step 5: Commit**

```bash
git add src/utils/cloud.ts
git commit -m "perf: POI 搜索结果加模块级 LRU 缓存，复用相同关键词"
```

---

## Task 2: B1 · trip 页复用 me-store 的 openid

**Files:**
- Modify: `src/pages/trip/index.tsx`（`TripPage`，`:373-409`）

- [ ] **Step 1: 重写 `TripPage`，删除独立 `ensure-user` 与本地 openid**

将当前 `export default function TripPage()`（`:373-409`）整体替换为：

```tsx
export default function TripPage() {
  const router = useRouter()
  const tripId = router.params.id || ''
  const { me } = useMe()
  const openid = me?.openid || ''

  // 用户点 <Button open-type="share"> 时 WeChat 触发,根据 button dataset.kind 选 payload
  useShareAppMessage((options) => {
    const kind = (options as { target?: { dataset?: { kind?: ShareKind } } })?.target?.dataset?.kind
    const picked = kind ? shareRef.byKind[kind] : null
    return picked || {
      title: shareRef.tripName ? `行迹 · ${shareRef.tripName}` : '行迹',
      path: '/pages/home/index',
    }
  })

  if (!tripId) return <View className='trip-empty'>缺少 trip id</View>
  if (!openid) return <View className='trip-empty'>登录中...</View>

  return (
    <TripProvider tripId={tripId} openid={openid}>
      <TripBody />
    </TripProvider>
  )
}
```

说明：`useMe` 已在文件顶部导入（`:5`），`MeProvider` 在 `app.tsx` 根部，openid 在 app 启动时已拉取，无需本页再调 `ensure-user`。

- [ ] **Step 2: 静态验证**

Run: `npx tsc --noEmit`
Expected: 无新增错误。若 ESLint 报 `useState`/`useEffect` 未使用——确认 `TripBody`（同文件）仍在使用它们；当前 `TripBody` 使用了 `useState`，AI 流程使用了 `useEffect`，故保留导入。若确有未用导入再按提示删除。

- [ ] **Step 3: 运行层验证（开发者工具）**

从首页点开一条**真实**攻略：不应再看到独立的第二次 `ensure-user` 云调用；"登录中..."仅在 me-store 未就绪的极短时间出现；页面正常加载。

- [ ] **Step 4: Commit**

```bash
git add src/pages/trip/index.tsx
git commit -m "perf: trip 页复用 me-store 的 openid，去掉重复的 ensure-user 调用"
```

---

## Task 3: B2(store 侧) · me-store 新增配额懒加载缓存 + value useMemo

**Files:**
- Modify: `src/store/me-store.tsx`

- [ ] **Step 1: 扩展 import 与 Ctx 接口**

将 `:1` 的 import 改为（新增 `useCallback`、`useMemo`）：

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
```

将 `interface Ctx`（`:15-19`）改为：

```tsx
interface Ctx {
  me: Me | null
  refresh: () => Promise<void>
  openProfileSetup: () => void
  quota: { flash: number; pro: number } | null
  refreshQuota: () => Promise<void>
}
```

- [ ] **Step 2: 在 `MeProvider` 内新增 quota state、refreshQuota，并把可复用函数包成 useCallback**

在 `MeProvider` 内 `const [setupOpen, setSetupOpen] = useState(false)` 之后新增：

```tsx
  const [quota, setQuota] = useState<{ flash: number; pro: number } | null>(null)

  // 懒加载：首次需要时才拉配额（不在启动时拉，避免不用 AI 的用户冷启动多一次云调用）
  const refreshQuota = useCallback(async () => {
    try {
      // @ts-ignore Taro.cloud
      const r = await Taro.cloud.callFunction({ name: 'ai-plan-trip', data: { _mode: 'quota' } })
      const res = (r as { result?: { ok: boolean; flash: { remaining: number }; pro: { remaining: number } } }).result
      if (res?.ok) setQuota({ flash: res.flash.remaining, pro: res.pro.remaining })
    } catch {
      /* 查询失败时不阻塞用户 */
    }
  }, [])
```

将现有 `refresh`（`const refresh = async () => {...}`，`:31-49`）改为 `useCallback` 包裹：把 `const refresh = async () => {` 改为 `const refresh = useCallback(async () => {`，并在该函数体结束的 `}` 后加 `, [])`。

将 `openProfileSetup`（`:79`）改为：

```tsx
  const openProfileSetup = useCallback(() => setSetupOpen(true), [])
```

- [ ] **Step 3: value 包 useMemo（C3）**

将 `return ( <MeContext.Provider value={{ me, refresh, openProfileSetup }}>` 改为：

```tsx
  const value = useMemo(
    () => ({ me, refresh, openProfileSetup, quota, refreshQuota }),
    [me, refresh, openProfileSetup, quota, refreshQuota],
  )

  return (
    <MeContext.Provider value={value}>
```

（`</MeContext.Provider>` 结构不变。）

- [ ] **Step 4: 静态验证**

Run: `npx tsc --noEmit`
Expected: 无新增错误。`useMe()` 的返回类型现包含 `quota`/`refreshQuota`。

- [ ] **Step 5: Commit**

```bash
git add src/store/me-store.tsx
git commit -m "perf: me-store 增加配额懒加载缓存 refreshQuota，并将 context value 包 useMemo"
```

---

## Task 4: B2(消费侧) · AIInterview 消费 me-store 缓存配额

**Files:**
- Modify: `src/components/AIInterview/index.tsx`（`:92-105`，及顶部 import）

- [ ] **Step 1: 导入 useMe**

在 import 区（紧随 `import { useKeyboardLift } ...`，约 `:8` 后）新增：

```tsx
import { useMe } from '../../store/me-store'
```

- [ ] **Step 2: 用缓存配额替换组件内的自取配额逻辑**

将 `:92-105` 的配额块：

```tsx
  // ─── 配额：从云端查询剩余次数 ───
  const [quota, setQuota] = useState<{ flash: number; pro: number }>({ flash: 0, pro: 0 })
  useEffect(() => {
    if (!open) return
    // @ts-ignore Taro.cloud
    Taro.cloud.callFunction({ name: 'ai-plan-trip', data: { _mode: 'quota' } })
      .then((res) => {
        const r = res.result as { ok: boolean; flash: { remaining: number }; pro: { remaining: number } }
        if (r?.ok) {
          setQuota({ flash: r.flash.remaining, pro: r.pro.remaining })
        }
      })
      .catch(() => { /* 查询失败时不阻塞用户 */ })
  }, [open])
```

替换为：

```tsx
  // ─── 配额：消费 me-store 缓存（SWR：有缓存立即显示 + 打开时后台校正）───
  const { quota: cachedQuota, refreshQuota } = useMe()
  const quota = cachedQuota ?? { flash: 0, pro: 0 }
  useEffect(() => {
    if (!open) return
    void refreshQuota()
  }, [open, refreshQuota])
```

说明：下游 `quota={quota}`（`:351` 附近）形状不变（`{ flash, pro }`），无需改动。

- [ ] **Step 3: 静态验证**

Run: `npx tsc --noEmit`
Expected: 无新增错误。确认文件内不再有对已删除的 `setQuota` 的引用。

- [ ] **Step 4: 运行层验证（开发者工具）**

第一次打开 AIInterview：配额在一次拉取后显示；**关闭再打开**：配额瞬间显示缓存值，并有一次后台校正调用。

- [ ] **Step 5: Commit**

```bash
git add src/components/AIInterview/index.tsx
git commit -m "perf: AIInterview 改为消费 me-store 缓存配额，去掉每次打开都拉取"
```

---

## Task 5: C3 · theme-store value 包 useMemo

**Files:**
- Modify: `src/store/theme-store.tsx`（`:1` import 与 `:79-83` Provider）

- [ ] **Step 1: import 增加 useMemo**

将 `:1` 改为：

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
```

- [ ] **Step 2: value 包 useMemo**

将：

```tsx
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
```

改为：

```tsx
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
```

（`setTheme` 已是 `useCallback`，`useCallback` 导入已存在。）

- [ ] **Step 3: 静态验证**

Run: `npx tsc --noEmit`
Expected: 无新增错误。

- [ ] **Step 4: Commit**

```bash
git add src/store/theme-store.tsx
git commit -m "perf: theme-store context value 包 useMemo"
```

---

## Task 6: C1 + C3 · trip-store 指纹延迟进 debounce + value useMemo

**Files:**
- Modify: `src/store/trip-store.tsx`（保存 effect `:196-254`；Provider value `:263-267`；import `:1`）

**背景：** 当前保存 effect 体内**每次** `state.trip` 变化都同步 `JSON.stringify(state.trip)`（`:211`）做版本指纹，长行程逐字编辑时阻塞主线程。改为把序列化推迟进 500ms debounce 回调内（空闲才序列化一次），保留全量精确比较与既有竞态语义。

- [ ] **Step 1: 重写保存 effect，使 stringify 只在 debounce 回调内执行**

将 `:196-254`（从 `// 编辑 → 500ms debounce 保存` 的 `useEffect` 整体）替换为：

```tsx
  // 编辑 → 500ms debounce 保存
  useEffect(() => {
    if (!state.trip || state.loading) return
    if (isSeedTripId(tripId)) {
      // 示例攻略编辑不保存，仅提示一次
      if (!seedWarningShownRef.current) {
        seedWarningShownRef.current = true
        Taro.showToast({
          title: '示例攻略仅供展示,复制后可编辑',
          icon: 'none',
          duration: 2500,
        })
      }
      return
    }

    // 不在此处同步 JSON.stringify（避免每次按键都序列化整个 trip）。
    // 标记 pending 并防抖；真正的「是否变化」判断推迟到空闲 500ms 后在回调里做一次。
    pendingRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const trip = state.trip!
      const snapshot = JSON.stringify(trip)
      const changed = snapshot !== lastSavedRef.current
      try {
        if (changed) {
          await updateTrip(trip._id, {
            name: trip.name,
            pax: trip.pax,
            startDate: trip.startDate,
            endDate: trip.endDate,
            destinations: trip.destinations,
            days: trip.days,
            packing: trip.packing,
          }, openid)
          lastSavedRef.current = snapshot
        }
      } catch (e) {
        console.error('[trip save]', e)
        Taro.showToast({ title: '保存失败', icon: 'error' })
      } finally {
        pendingRef.current = false
        // pendingRef 期间收到过远端更新? 把它合并进来 (服务端独有字段 ai*/updatedAt 等)。
        // 注意：无论本次是否真的保存(changed)，都要处理 deferred，避免远端更新被搁置。
        const deferred = deferredRemoteRef.current
        if (deferred) {
          deferredRemoteRef.current = null
          const merged: Trip = { ...deferred, ...(state.trip || {}), ...{
            // 强制保留服务端独有的字段, 避免被本地 state 覆盖
            aiTaskId: deferred.aiTaskId,
            aiStatus: deferred.aiStatus,
            aiDraft: deferred.aiDraft,
            aiError: deferred.aiError,
            collaborators: deferred.collaborators,
            collaboratorOpenids: (deferred as Trip & { collaboratorOpenids?: string[] }).collaboratorOpenids,
            updatedAt: deferred.updatedAt,
            updatedBy: deferred.updatedBy,
          } }
          dispatch({ type: 'SET_TRIP', trip: merged })
          lastSavedRef.current = JSON.stringify(merged)
        }
      }
    }, 500)
  }, [state.trip, state.loading, openid])
```

关键差异（相对原实现）：
- 删除了 effect 体内同步的 `const snapshot = JSON.stringify(state.trip)` 与 `if (snapshot === lastSavedRef.current) return`。
- `pendingRef.current = true` 现在在每次 `state.trip` 变化时即置位（含 watch 回声）；序列化与「是否变化」判断移入 500ms 回调。
- 回调内 `if (changed)` 才真正 `updateTrip`；`finally` 中**无论 changed 与否**都处理 `deferredRemoteRef`，确保 pending 窗内到达的远端更新不被搁置。
- 可接受的细微取舍：两次背靠背的远端更新中，第二次可能被延迟最多 500ms 再合并（协作更新低频，可接受）。

- [ ] **Step 2: Provider value 包 useMemo（C3）**

将 import `:1`：

```tsx
import { createContext, useContext, useEffect, useReducer, useRef, ReactNode } from 'react'
```

改为（新增 `useMemo`）：

```tsx
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, ReactNode } from 'react'
```

将 `:263-267`：

```tsx
  return (
    <Ctx.Provider value={{ state, dispatch, openid }}>
      {children}
    </Ctx.Provider>
  )
```

改为：

```tsx
  const value = useMemo(() => ({ state, dispatch, openid }), [state, openid])

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  )
```

（`dispatch` 引用稳定，无需入依赖；编辑时 `state` 必变，memo 收益有限但无害。）

- [ ] **Step 3: 静态验证**

Run: `npx tsc --noEmit`
Expected: 无新增错误。

- [ ] **Step 4: 运行层验证（开发者工具，重点验证竞态未坏）**

1. 在一条真实攻略里连续编辑（加景点 / 改备注 / 改日期）：停手约 0.5s 后发生一次 `update-trip` 保存；快速连打不会每次都保存。
2. 编辑过程中由另一端（或控制台改库）触发远端更新：本地保存完成后应能合并远端的 `ai*/updatedAt/collaborators` 等字段，不丢改动、不死循环。
3. 不做任何编辑、仅被动收到协作者改动：不应触发多余 `update-trip`。

- [ ] **Step 5: Commit**

```bash
git add src/store/trip-store.tsx
git commit -m "perf: trip-store 将版本指纹 JSON.stringify 推迟进 debounce，context value 包 useMemo"
```

---

## Task 7: A + D1 · 首页加载重构

**Files:**
- Modify: `src/pages/home/index.tsx`（import `:1`；state/effects `:28-69`；`:186-187`）

**前置：** Task 3 已让 `useMe()` 暴露 `refreshQuota`。

- [ ] **Step 1: 扩展 react import**

将 `:1`：

```tsx
import { useEffect, useState } from 'react'
```

改为：

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
```

- [ ] **Step 2: 在组件外加模块级缓存键常量**

在 `export default function Home() {` 之前一行插入：

```tsx
const STORAGE_KEY = 'home-trips-cache'  // 仅缓存网络列表部分（不含种子）
```

- [ ] **Step 3: 替换 state 头部（仅 `:28-31` 四行，保留 `:32-36` 的其它 state）**

> ⚠️ 只替换 `trips`/`loading`/`me`/`openid` 这 4 行；其下 `actionTrip`/`shareTrip`/`shareReady`/`coverTrip`/`interviewOpen` 等 state（`:32-36`）**原样保留**，不要删除。

将 `:28-31`：

```tsx
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const { me } = useMe()
  const openid = me?.openid || ''
```

替换为：

```tsx
  // A2/A3：种子立即可见；命中缓存则一并显示，loading 仅表示「用户真实行程未就绪」
  const [trips, setTrips] = useState<Trip[]>(() => {
    try {
      const cached = Taro.getStorageSync(STORAGE_KEY) as Trip[] | ''
      if (Array.isArray(cached) && cached.length) return [...SEED_TRIPS, ...cached]
    } catch { /* ignore */ }
    return [...SEED_TRIPS]
  })
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const cached = Taro.getStorageSync(STORAGE_KEY)
      return !(Array.isArray(cached) && cached.length)
    } catch { return true }
  })
  const { me, refreshQuota } = useMe()
  const openid = me?.openid || ''
```

- [ ] **Step 4: 替换三个加载 effect（`:38-69`）为新的 loader + effects**

> 该范围正好是原「初始 `useEffect`（`:38-49`）+ `useDidShow`（`:51-57`）+ 轮询 `useEffect`（`:59-69`）」三段（含其间空行）。整段替换，不保留旧版本。

将 `:38-69` 替换为：

```tsx
  const openidRef = useRef(openid)
  useEffect(() => { openidRef.current = openid }, [openid])
  const lastLoadedAtRef = useRef(0)
  const didInitialShowRef = useRef(false)

  // A1：listMyTrips 服务端自取 OPENID，客户端无需等 ensure-user → 挂载即可并行发起
  const loadTrips = useCallback(async (throttle = false) => {
    if (throttle && Date.now() - lastLoadedAtRef.current < 2000) return
    lastLoadedAtRef.current = Date.now()
    try {
      const list = await listMyTrips(openidRef.current)
      setTrips([...SEED_TRIPS, ...list])
      setLoading(false)
      try { Taro.setStorageSync(STORAGE_KEY, list) } catch { /* ignore storage full */ }
    } catch (e) {
      console.error('[home] listMyTrips failed', e)
      setLoading(false)
    }
  }, [])

  // 挂载即并行发起（不等 openid）
  useEffect(() => { void loadTrips() }, [loadTrips])

  // A4：useDidShow 在首次显示也会触发，跳过紧跟挂载的那一次，避免首进双拉
  useDidShow(() => {
    if (!didInitialShowRef.current) { didInitialShowRef.current = true; return }
    void loadTrips(true)
  })

  // A5：仅在「有生成中的行程」翻转时开/关定时器，不再因 trips 变化每轮重建
  const hasGenerating = trips.some((t) => t.aiStatus === 'generating')
  useEffect(() => {
    if (!hasGenerating) return
    const timer = setInterval(() => {
      listMyTrips(openidRef.current)
        .then((list) => {
          setTrips([...SEED_TRIPS, ...list])
          try { Taro.setStorageSync(STORAGE_KEY, list) } catch { /* ignore */ }
        })
        .catch((e) => console.error('[home] ai polling failed', e))
    }, 8000)
    return () => clearInterval(timer)
  }, [hasGenerating])

  // A5 + B2：生成由「进行中」→「完成」时刷新配额（钩子对轮询/未来 watch 透明）
  const prevGeneratingRef = useRef(hasGenerating)
  useEffect(() => {
    if (prevGeneratingRef.current && !hasGenerating) void refreshQuota()
    prevGeneratingRef.current = hasGenerating
  }, [hasGenerating, refreshQuota])
```

说明：`useDidShow` 已在 `:3` 导入，`Taro`/`listMyTrips`/`SEED_TRIPS`/`useMe` 均已导入。原 `useDidShow` 里的 `Taro.showNavigationBarLoading()/hideNavigationBarLoading()` 已去除（首屏已即时可见，导航栏 loading 易闪烁）。`useDidShow` 返回的刷新走 `loadTrips(true)`（带 2s 节流），挂载首拉走 `loadTrips()`（不节流）。

- [ ] **Step 5: D1 · activeTrips/archivedTrips 包 useMemo**

将 `:186-187`：

```tsx
  const activeTrips = trips.filter((t) => getTripPhase(t.startDate, t.endDate) !== 'post')
  const archivedTrips = trips.filter((t) => getTripPhase(t.startDate, t.endDate) === 'post')
```

改为：

```tsx
  const { activeTrips, archivedTrips } = useMemo(() => {
    const active = trips.filter((t) => getTripPhase(t.startDate, t.endDate) !== 'post')
    const archived = trips.filter((t) => getTripPhase(t.startDate, t.endDate) === 'post')
    return { activeTrips: active, archivedTrips: archived }
  }, [trips])
```

- [ ] **Step 6: 静态验证**

Run: `npx tsc --noEmit`
Expected: 无新增错误。确认无对已删除变量的引用、`useMe()` 解构含 `refreshQuota`、`:32-36` 的其它 state 仍在。

- [ ] **Step 7: 运行层验证（开发者工具）**

1. 冷启动进首页：**立即**看到示例攻略 + 上次缓存的真实攻略（无空屏等待）；网络回来后列表覆盖刷新。
2. 进入某攻略再返回首页：列表能反映刚做的改动（如改名/封面），不被节流漏刷（间隔 > 2s）。
3. 杀进程重进：先显示缓存列表，再后台刷新。
4. 触发一次 AI 生成：生成中状态每 ~8s 刷新；完成后停止轮询；配额随后刷新（可在 me-store 打日志或 AIInterview 复查）。

- [ ] **Step 8: Commit**

```bash
git add src/pages/home/index.tsx
git commit -m "perf: 首页加载重构（并行拉取/种子即显/Storage SWR/首次show去重/轮询修复）+ 列表分组 useMemo"
```

---

## Task 8: D4 · SpotSearch 结果列表稳定唯一 key

**Files:**
- Modify: `src/components/SpotSearch/index.tsx`（`:107-112`）

**注意：** 不能用 `adcode` 当 key——POI 搜索结果里同一行政区的多个景点 `adcode` 相同，会产生重复 key。用 `name + 经纬度` 组合更唯一。

- [ ] **Step 1: 改 key**

将 `:107-108`：

```tsx
          {!loading && results.map((r, i) => (
            <View key={`${r.adcode}-${i}`} className='ss-result' onClick={() => useResult(r)}>
```

改为：

```tsx
          {!loading && results.map((r) => (
            <View key={`${r.name}-${r.lat}-${r.lng}`} className='ss-result' onClick={() => useResult(r)}>
```

- [ ] **Step 2: 静态验证**

Run: `npx tsc --noEmit`
Expected: 无新增错误（`i` 不再使用，map 回调已去掉该参数）。

- [ ] **Step 3: 运行层验证**

在攻略里搜索景点，列表正常渲染、点选正常，无控制台 duplicate key 警告。

- [ ] **Step 4: Commit**

```bash
git add src/components/SpotSearch/index.tsx
git commit -m "fix: SpotSearch 结果 key 改用 name+经纬度，避免同 adcode 重复 key"
```

---

## Task 9: D3 · 阶段组件去掉 tick 触发的 phase 重算

**Files:**
- Modify: `src/components/TripPhaseChip/index.tsx`（`:20-23`）
- Modify: `src/components/TripPhaseHero/index.tsx`（`:23-26`）

**背景：** `phase = useMemo(() => getTripPhase(...), [..., tick])` 把 `tick` 放进依赖，导致每分钟 `setTick` 时所有该组件都重算 `getTripPhase`。`phase` 只依赖起止日期，应去掉 `tick`。保留 60s `setInterval` 本身——它驱动 LIVE 行程的"当前/下一站/时间"刷新（仅 live 阶段、屏上通常 0~1 个），开销可忽略；这样以最小改动消除每分钟的 `getTripPhase` 风暴。

- [ ] **Step 1: TripPhaseChip 去掉 tick 依赖**

将 `TripPhaseChip/index.tsx:20-23`：

```tsx
  const phase = useMemo(
    () => getTripPhase(trip.startDate, trip.endDate),
    [trip.startDate, trip.endDate, tick],
  )
```

改为：

```tsx
  const phase = useMemo(
    () => getTripPhase(trip.startDate, trip.endDate),
    [trip.startDate, trip.endDate],
  )
```

- [ ] **Step 2: TripPhaseHero 去掉 tick 依赖**

将 `TripPhaseHero/index.tsx:23-26`：

```tsx
  const phase = useMemo(
    () => getTripPhase(trip.startDate, trip.endDate),
    [trip.startDate, trip.endDate, tick],
  )
```

改为：

```tsx
  const phase = useMemo(
    () => getTripPhase(trip.startDate, trip.endDate),
    [trip.startDate, trip.endDate],
  )
```

- [ ] **Step 3: 静态验证**

Run: `npx tsc --noEmit`
Expected: 无新增错误。`tick`/`setTick` 仍被 `setInterval` 使用（驱动 live 刷新），不会变成未使用变量。

- [ ] **Step 4: 运行层验证**

打开一条进行中（live）攻略：LIVE 区/徽标仍每分钟刷新"当前站/时间"；首页有多条攻略时，阶段徽标不再每分钟集体重算（功能无回归即可）。

- [ ] **Step 5: Commit**

```bash
git add src/components/TripPhaseChip/index.tsx src/components/TripPhaseHero/index.tsx
git commit -m "perf: 阶段组件 phase useMemo 去掉 tick 依赖，消除每分钟 getTripPhase 重算"
```

---

## 收尾验证（全部任务完成后）

- [ ] `npx tsc --noEmit` 全量通过，无新增错误。
- [ ] 开发者工具走查核心流：首页冷启动即时可见、进出首页不重复拉取、攻略详情无重复 ensure-user、AIInterview 配额缓存、长行程编辑流畅且协作同步正常、AI 生成轮询稳定并在完成后停止。
- [ ] 凡本地无法验证项（如真机协作并发），在 PR/汇报中明确标注为待真机验证。

---

## 自审记录（plan 对 spec 覆盖）

- A1~A5 → Task 7；A 的 `loading` 语义、首次 show 去重、轮询网络路径均落实。
- B1 → Task 2；B2 → Task 3（store）+ Task 4（消费）；B3 → Task 1。
- C1 → Task 6（指纹延迟，保留竞态语义，否决有损 hash）；C3 → Task 3/5/6；C2 明确不做（spec 已说明）。
- D1 → Task 7；D3 → Task 9；D4 → Task 8（并修正 spec 中「用 adcode」为 name+坐标，因 POI 的 adcode 会重复）。
- 无测试运行器 → 各任务以 `tsc --noEmit` + 人工验证替代单测，已在每个任务写明。
