import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import type { Trip } from '../types/trip'
import { type TripPhase } from '../utils/trip-phase'

export interface DayForecast {
  date: string
  temp: number
  low: number
  desc: string
  icon: string
}

export interface LiveWeather {
  temp: number
  desc: string
  icon: string
}

interface WeatherResult {
  loading: boolean
  pre?: DayForecast[]
  liveToday?: LiveWeather
}

interface CacheEntry<T> {
  writtenAt: number
  data: T
}

const TTL_MS = 60 * 60 * 1000

function readCache<T>(key: string): T | null {
  try {
    const v = Taro.getStorageSync(key) as CacheEntry<T> | ''
    if (!v || typeof v !== 'object') return null
    if (Date.now() - v.writtenAt > TTL_MS) return null
    return v.data
  } catch {
    return null
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    Taro.setStorageSync(key, { writtenAt: Date.now(), data } satisfies CacheEntry<T>)
  } catch {
    /* ignore storage full */
  }
}

async function callWeather(adcode: string): Promise<{ high: number; low: number; desc: string; icon: string } | null> {
  // @ts-ignore Taro.cloud
  const res = await Taro.cloud.callFunction({ name: 'amap-weather', data: { adcode } })
  const result = (res as { result?: { weather?: { high: number; low: number; desc: string; icon: string } } })?.result
  return result?.weather ?? null
}

export function useTripWeather(trip: Trip, phase: TripPhase): WeatherResult {
  const [result, setResult] = useState<WeatherResult>({ loading: phase !== 'post' })

  useEffect(() => {
    let cancelled = false

    if (phase === 'post') {
      setResult({ loading: false })
      return () => { cancelled = true }
    }

    const dest = trip.destinations?.[0]
    if (!dest?.adcode) {
      setResult({ loading: false })
      return () => { cancelled = true }
    }

    if (phase === 'pre') {
      const key = `weather:${dest.adcode}:pre:${trip.startDate}:${trip.endDate}`
      const cached = readCache<DayForecast[]>(key)
      if (cached) {
        setResult({ loading: false, pre: cached })
        return () => { cancelled = true }
      }
      setResult({ loading: true })
      callWeather(dest.adcode)
        .then((w) => {
          if (cancelled) return
          // amap-weather only returns today's forecast; wrap as single-item list
          const list: DayForecast[] = w
            ? [{ date: trip.startDate, temp: w.high, low: w.low, desc: w.desc, icon: w.icon }]
            : []
          writeCache(key, list)
          setResult({ loading: false, pre: list })
        })
        .catch((e) => {
          console.warn('[useTripWeather] pre failed', e)
          if (!cancelled) setResult({ loading: false })
        })
      return () => { cancelled = true }
    }

    // phase === 'live'
    const today = new Date().toISOString().slice(0, 10)
    const key = `weather:${dest.adcode}:live:${today}`
    const cached = readCache<LiveWeather>(key)
    if (cached) {
      setResult({ loading: false, liveToday: cached })
      return () => { cancelled = true }
    }
    setResult({ loading: true })
    callWeather(dest.adcode)
      .then((w) => {
        if (cancelled) return
        if (w) {
          const live: LiveWeather = { temp: w.high, desc: w.desc, icon: w.icon }
          writeCache(key, live)
          setResult({ loading: false, liveToday: live })
        } else {
          setResult({ loading: false })
        }
      })
      .catch((e) => {
        console.warn('[useTripWeather] live failed', e)
        if (!cancelled) setResult({ loading: false })
      })
    return () => { cancelled = true }
  }, [trip._id, trip.startDate, trip.endDate, phase])

  return result
}
