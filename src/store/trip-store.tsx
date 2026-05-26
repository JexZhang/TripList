import { createContext, useContext, useEffect, useReducer, useRef, ReactNode } from 'react'
import Taro from '@tarojs/taro'
import dayjs from 'dayjs'
import type { Trip, Day, Spot } from '../types/trip'
import { getTrip, updateTrip } from '../utils/db'
import { isSeedTripId, getSeedTrip } from '../data/seed-trips'

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
}

const Ctx = createContext<ContextValue | null>(null)

export function TripProvider({
  tripId, openid, children,
}: { tripId: string; openid: string; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { trip: null, loading: true, error: null })
  const lastSavedRef = useRef<string>('')  // JSON 字串作为版本指纹
  const pendingRef = useRef(false)
  const deferredRemoteRef = useRef<Trip | null>(null)  // pendingRef 期间被丢的远端 doc, save 完成后补合并
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seedWarningShownRef = useRef(false)  // 示例攻略警告只显示一次

  // 初次拉 + watch 订阅
  useEffect(() => {
    // 种子示例攻略：直接从本地静态数据加载，不连云端，不订阅 watch
    if (isSeedTripId(tripId)) {
      const seed = getSeedTrip(tripId)
      if (seed) {
        dispatch({ type: 'SET_TRIP', trip: seed })
        lastSavedRef.current = JSON.stringify(seed)
      } else {
        dispatch({ type: 'ERROR', error: 'Trip not found' })
      }
      return
    }

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

    // @ts-ignore Taro.cloud.database watch
    watcher = Taro.cloud.database().collection('trips').doc(tripId).watch({
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
  }, [tripId, openid])

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
    const snapshot = JSON.stringify(state.trip)
    if (snapshot === lastSavedRef.current) return  // 没有真实变化

    pendingRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const trip = state.trip!
      try {
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
      } catch (e) {
        console.error('[trip save]', e)
        Taro.showToast({ title: '保存失败', icon: 'error' })
      } finally {
        pendingRef.current = false
        // pendingRef 期间收到过远端更新? 把它合并进来 (服务端独有字段 ai*/updatedAt 等)
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

  // 卸载时清除未触发的 debounce 保存
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <Ctx.Provider value={{ state, dispatch, openid }}>
      {children}
    </Ctx.Provider>
  )
}

export function useTripStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTripStore must be used within TripProvider')
  return ctx
}
