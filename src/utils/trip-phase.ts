import dayjs, { type Dayjs } from 'dayjs'
import type { Trip, Day, Spot } from '../types/trip'

export type TripPhase = 'pre' | 'live' | 'post'

export type LiveStatus =
  | 'before-first'
  | 'in-progress'
  | 'after-last'
  | 'rest-day'
  | 'no-day'

export interface LiveContext {
  currentDay: Day | null
  currentSpot: Spot | null
  nextSpot: Spot | null
  nextDay: Day | null
  status: LiveStatus
}

export interface PostStats {
  days: number
  spotsCount: number
  totalCost: number
}

export function getTripPhase(
  startDate: string,
  endDate: string,
  now: Dayjs = dayjs(),
): TripPhase {
  const today = now.startOf('day')
  const start = dayjs(startDate).startOf('day')
  const end = dayjs(endDate).startOf('day')
  if (today.isBefore(start)) return 'pre'
  if (today.isAfter(end)) return 'post'
  return 'live'
}

export function getDaysUntilStart(startDate: string, now: Dayjs = dayjs()): number {
  return Math.max(0, dayjs(startDate).startOf('day').diff(now.startOf('day'), 'day'))
}

export function getLiveContext(trip: Trip, now: Dayjs = dayjs()): LiveContext {
  const today = now.format('YYYY-MM-DD')
  const currentDay = trip.days.find((d) => d.date === today) ?? null
  if (!currentDay) {
    return { currentDay: null, currentSpot: null, nextSpot: null, nextDay: null, status: 'no-day' }
  }
  const spots = [...(currentDay.spots ?? [])].sort((a, b) =>
    (a.time || '').localeCompare(b.time || ''),
  )
  if (spots.length === 0) {
    return { currentDay, currentSpot: null, nextSpot: null, nextDay: null, status: 'rest-day' }
  }
  const nowHHmm = now.format('HH:mm')
  const past = spots.filter((s) => (s.time || '00:00') <= nowHHmm)
  const future = spots.filter((s) => (s.time || '00:00') > nowHHmm)
  if (past.length === 0) {
    return { currentDay, currentSpot: null, nextSpot: spots[0], nextDay: null, status: 'before-first' }
  }
  if (future.length === 0) {
    const idx = trip.days.findIndex((d) => d.date === today)
    const tomorrowDay = trip.days[idx + 1] ?? null
    const tomorrowFirst = tomorrowDay?.spots?.[0] ?? null
    return {
      currentDay,
      currentSpot: past[past.length - 1],
      nextSpot: tomorrowFirst,
      nextDay: tomorrowFirst ? tomorrowDay : null,
      status: 'after-last',
    }
  }
  return {
    currentDay,
    currentSpot: past[past.length - 1],
    nextSpot: future[0],
    nextDay: null,
    status: 'in-progress',
  }
}

export function getPostStats(trip: Trip): PostStats {
  const days = trip.days.length
  let spotsCount = 0
  let totalCost = 0
  for (const d of trip.days) {
    const spots = d.spots ?? []
    spotsCount += spots.length
    for (const s of spots) {
      totalCost += s.price ?? 0
    }
  }
  return { days, spotsCount, totalCost }
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s1 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(s1))
}
