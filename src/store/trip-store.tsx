import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, ReactNode } from 'react'
import Taro from '@tarojs/taro'
import dayjs from 'dayjs'
import type { Trip, Day, Spot } from '../types/trip'
import { getTrip, updateTrip, applyAiDraft as applyAiDraftCloud } from '../utils/db'

function resyncDays(days: Day[]): Day[] {
  if (days.length === 0) return days
  const base = days[0].date
  return days.map((d, i) => ({
    ...d,
    date: dayjs(base).add(i, 'day').format('YYYY-MM-DD'),
  }))
}

function withSyncedDays(trip: Trip, days: Day[]): Trip {
  const synced = resyncDays(days)
  return {
    ...trip,
    days: synced,
    startDate: synced[0]?.date || trip.startDate,
    endDate: synced[synced.length - 1]?.date || trip.endDate,
  }
}

type Action =
  | { type: 'SET_TRIP'; trip: Trip }
  | { type: 'UPDATE_TRIP'; patch: Partial<Trip> }
  | { type: 'UPDATE_DAY'; dayId: string; patch: Partial<Day> }
  | { type: 'ADD_DAY'; day: Day; position?: 'front' | 'back' }
  | { type: 'DELETE_DAY'; dayId: string }
  | { type: 'MOVE_DAY'; dayId: string; targetIndex: number }
  | { type: 'ADD_SPOT'; dayId: string; spot: Spot }
  | { type: 'UPDATE_SPOT'; dayId: string; spotId: string; patch: Partial<Spot> }
  | { type: 'DELETE_SPOT'; dayId: string; spotId: string }
  | { type: 'ERROR'; error: string }

interface State {
  trip: Trip | null
  loading: boolean
  error: string | null
}

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case 'SET_TRIP':
      return { trip: a.trip, loading: false, error: null }
    case 'ERROR':
      return { ...state, error: a.error, loading: false }
  }
  if (!state.trip) return state
  const trip = state.trip
  switch (a.type) {
    case 'UPDATE_TRIP':
      return { ...state, trip: { ...trip, ...a.patch } }
    case 'UPDATE_DAY':
      return {
        ...state,
        trip: { ...trip, days: trip.days.map(d => d.id === a.dayId ? { ...d, ...a.patch } : d) }
      }
    case 'ADD_DAY': {
      if (a.position === 'front') {
        // 在最前插入: 新首日的 date = 原首日 -1, withSyncedDays 会按这个 base 重新派生
        const oldStart = trip.days[0]?.date || trip.startDate
        const prepended = { ...a.day, date: dayjs(oldStart).subtract(1, 'day').format('YYYY-MM-DD') }
        return { ...state, trip: withSyncedDays(trip, [prepended, ...trip.days]) }
      }
      return { ...state, trip: withSyncedDays(trip, [...trip.days, a.day]) }
    }
    case 'DELETE_DAY':
      return { ...state, trip: withSyncedDays(trip, trip.days.filter(d => d.id !== a.dayId)) }
    case 'MOVE_DAY': {
      const fromIdx = trip.days.findIndex(d => d.id === a.dayId)
      if (fromIdx < 0) return state
      const clamped = Math.max(0, Math.min(trip.days.length - 1, a.targetIndex))
      if (clamped === fromIdx) return state
      const next = trip.days.slice()
      const [moved] = next.splice(fromIdx, 1)
      next.splice(clamped, 0, moved)
      // 决定整体起点是否平移:
      //   挪到最前 -> 整体提前 1 天 (新首日 = 原首日 -1)
      //   挪到最后 -> 整体推后 1 天 (新首日 = 原首日 +1)
      //   中间 -> 不变
      const oldStart = trip.days[0].date
      let newBase = oldStart
      if (clamped === 0) newBase = dayjs(oldStart).subtract(1, 'day').format('YYYY-MM-DD')
      else if (clamped === trip.days.length - 1) newBase = dayjs(oldStart).add(1, 'day').format('YYYY-MM-DD')
      next[0] = { ...next[0], date: newBase }
      return { ...state, trip: withSyncedDays(trip, next) }
    }
    case 'ADD_SPOT':
      return {
        ...state,
        trip: {
          ...trip,
          days: trip.days.map(d =>
            d.id === a.dayId ? { ...d, spots: [...d.spots, a.spot] } : d
          )
        }
      }
    case 'UPDATE_SPOT':
      return {
        ...state,
        trip: {
          ...trip,
          days: trip.days.map(d => {
            if (d.id !== a.dayId) return d
            return { ...d, spots: d.spots.map(s => s.id === a.spotId ? { ...s, ...a.patch } : s) }
          })
        }
      }
    case 'DELETE_SPOT':
      return {
        ...state,
        trip: {
          ...trip,
          days: trip.days.map(d => {
            if (d.id !== a.dayId) return d
            return { ...d, spots: d.spots.filter(s => s.id !== a.spotId) }
          })
        }
      }
  }
  return state
}

interface ContextValue {
  state: State
  dispatch: React.Dispatch<Action>
  openid: string
  readonly: boolean
  applyAiDraft: (selectedSpots: Record<string, number[]>) => Promise<void>
}

const Ctx = createContext<ContextValue | null>(null)

export function TripProvider({
  tripId, openid, children, initialTrip, readonly: ro = false,
}: {
  tripId?: string
  openid: string
  children: ReactNode
  initialTrip?: Trip
  readonly?: boolean
}) {
  const [state, rawDispatch] = useReducer(reducer, {
    trip: initialTrip ?? null,
    loading: !initialTrip,
    error: null,
  })
  const dispatch: React.Dispatch<Action> = ro
    ? () => { /* readonly: no-op */ }
    : rawDispatch
  const lastSavedRef = useRef<string>('')  // JSON 字串作为版本指纹
  const pendingRef = useRef(false)
  const deferredRemoteRef = useRef<Trip | null>(null)  // pendingRef 期间被丢的远端 doc, save 完成后补合并
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestTripRef = useRef<Trip | null>(null)  // 始终指向最新 state.trip，供 deferred 合并避免用到过期闭包

  // 把最新 state.trip 镜像到 ref：debounce 回调在 await 期间用户可能继续编辑，
  // deferred 合并须以最新本地态为准，否则那批编辑会被旧闭包覆盖丢失
  useEffect(() => { latestTripRef.current = state.trip }, [state.trip])

  // 初次拉 + watch 订阅（只读模式跳过）
  useEffect(() => {
    if (ro || !tripId) return
    let watcher: { close: () => void } | null = null
    getTrip(tripId).then(trip => {
      if (!trip) {
        dispatch({ type: 'ERROR', error: 'Trip not found' })
        return
      }
      dispatch({ type: 'SET_TRIP', trip })
      lastSavedRef.current = JSON.stringify(trip)
    }).catch(() => {
      dispatch({ type: 'ERROR', error: '加载失败，请重试' })
    })

    // 用 where 替代 doc：doc().watch() 的查询条件只有 _id，不是 trips 自定义安全规则的子集，
    // 会被服务端拒绝（-402002 init watch fail）。这里只锁 _id（不带 _openid），
    // 由 trips read 规则用 get() 在运行时判断 owner / 协作者成员资格，使 owner 与协作者都能监听。
    // @ts-ignore Taro.cloud.database watch
    watcher = Taro.cloud.database().collection('trips').where({ _id: tripId }).watch({
      // @ts-ignore snapshot 来自无类型的 Taro.cloud watch（where().watch 的回调签名与我们的 docs 结构不符）
      onChange: (snapshot: { docs: Trip[] }) => {
        const doc = snapshot.docs && snapshot.docs[0]
        if (!doc) return
        if (pendingRef.current) {
          // 本地有未保存编辑, 暂存最新远端 doc, save 完成后合并 (避免丢 AI 终态/协作者改动)
          deferredRemoteRef.current = doc
          return
        }
        const incoming = JSON.stringify(doc)
        if (incoming === lastSavedRef.current) return  // 自己刚保存的回声
        dispatch({ type: 'SET_TRIP', trip: doc })
        lastSavedRef.current = incoming
        if (doc.updatedBy !== openid) {
          Taro.showToast({ title: '已同步协作者改动', icon: 'none', duration: 1500 })
        }
      },
      onError: (e: unknown) => console.error('[trip watch]', e),
    })

    return () => { watcher?.close() }
  }, [tripId, openid, ro])

  // 编辑 → 500ms debounce 保存（只读模式跳过）
  useEffect(() => {
    if (ro) return
    if (!state.trip || state.loading) return

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
          const merged: Trip = { ...deferred, ...(latestTripRef.current || {}), ...{
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
  }, [state.trip, state.loading, openid, ro])

  // 卸载时清除未触发的 debounce 保存
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // 应用 AI 草稿：走服务端 apply-ai-draft（按可信 aiDraft 合并、免审），用返回的完整 trip
  // 直接落地，并同步 lastSavedRef，让随后的 debounce 保存判定为「无变更」跳过——
  // 否则那次全量保存会把合并后的 days 再次送 update-trip 审核，绕回 3s 超时。
  const applyAiDraft = useCallback(async (selectedSpots: Record<string, number[]>) => {
    const tripId = latestTripRef.current?._id
    if (!tripId) return
    // 取消可能在排队的 debounce 保存
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    const newTrip = await applyAiDraftCloud(tripId, selectedSpots)
    pendingRef.current = false
    deferredRemoteRef.current = null
    dispatch({ type: 'SET_TRIP', trip: newTrip })
    lastSavedRef.current = JSON.stringify(newTrip)
  }, [dispatch])

  const value = useMemo(() => ({ state, dispatch, openid, readonly: ro, applyAiDraft }), [state, openid, ro, applyAiDraft])

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  )
}

export function useTripStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTripStore must be used within TripProvider')
  return ctx
}
