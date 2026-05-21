import { createContext, useContext, useEffect, useReducer, useRef, ReactNode } from 'react'
import Taro from '@tarojs/taro'
import type { Trip, Day, Spot } from '../types/trip'
import { getTrip, updateTrip } from '../utils/db'

type Action =
  | { type: 'SET_TRIP'; trip: Trip }
  | { type: 'UPDATE_TRIP'; patch: Partial<Trip> }
  | { type: 'UPDATE_DAY'; dayId: string; patch: Partial<Day> }
  | { type: 'ADD_DAY'; day: Day }
  | { type: 'DELETE_DAY'; dayId: string }
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
    case 'ADD_DAY':
      return { ...state, trip: { ...trip, days: [...trip.days, a.day] } }
    case 'DELETE_DAY':
      return { ...state, trip: { ...trip, days: trip.days.filter(d => d.id !== a.dayId) } }
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 初次拉 + watch 订阅
  useEffect(() => {
    let watcher: { close: () => void } | null = null
    getTrip(tripId).then(trip => {
      if (!trip) {
        dispatch({ type: 'ERROR', error: 'Trip not found' })
        return
      }
      dispatch({ type: 'SET_TRIP', trip })
      lastSavedRef.current = JSON.stringify(trip)
    })

    // @ts-ignore Taro.cloud.database watch
    watcher = Taro.cloud.database().collection('trips').doc(tripId).watch({
      onChange: (snapshot: { docs: Trip[] }) => {
        const doc = snapshot.docs && snapshot.docs[0]
        if (!doc) return
        if (pendingRef.current) return  // 本地有未保存编辑，忽略远端推送
        if (doc.updatedBy === openid) return  // 自己刚保存的，避免循环
        dispatch({ type: 'SET_TRIP', trip: doc })
        lastSavedRef.current = JSON.stringify(doc)
        Taro.showToast({ title: '已同步协作者改动', icon: 'none', duration: 1500 })
      },
      onError: (e: unknown) => console.error('[trip watch]', e),
    })

    return () => { watcher?.close() }
  }, [tripId, openid])

  // 编辑 → 500ms debounce 保存
  useEffect(() => {
    if (!state.trip || state.loading) return
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
      }
    }, 500)
  }, [state.trip, state.loading, openid])

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
