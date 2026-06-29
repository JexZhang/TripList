import dayjs from 'dayjs'
import type { Day, Trip } from '../types/trip'

function clearDayWeather(day: Day): Day {
  return { ...day, weather: null }
}

export function syncContinuousDays(
  trip: Trip,
  days: Day[],
  startDate?: string,
  options: { clearWeather?: boolean } = { clearWeather: true },
): Trip {
  const base = startDate || days[0]?.date || trip.startDate
  const synced = days.map((day, index) => ({
    ...(options.clearWeather === false ? day : clearDayWeather(day)),
    date: dayjs(base).add(index, 'day').format('YYYY-MM-DD'),
  }))

  return {
    ...trip,
    days: synced,
    startDate: synced[0]?.date || trip.startDate,
    endDate: synced[synced.length - 1]?.date || trip.endDate,
  }
}

export function rebaseTripDates(trip: Trip, startDate: string): Trip {
  return syncContinuousDays(trip, trip.days, startDate)
}

export function reorderTripDays(trip: Trip, dayIds: string[]): Trip {
  const byId = new Map(trip.days.map((day) => [day.id, day]))
  const picked: Day[] = []
  const seen = new Set<string>()

  dayIds.forEach((id) => {
    const day = byId.get(id)
    if (!day || seen.has(id)) return
    picked.push(day)
    seen.add(id)
  })

  trip.days.forEach((day) => {
    if (!seen.has(day.id)) picked.push(day)
  })

  return syncContinuousDays(trip, picked, trip.startDate)
}

export function moveTripDay(trip: Trip, dayId: string, targetIndex: number): Trip {
  const fromIndex = trip.days.findIndex((day) => day.id === dayId)
  if (fromIndex < 0) return trip

  const clamped = Math.max(0, Math.min(trip.days.length - 1, targetIndex))
  if (clamped === fromIndex) return trip

  const next = trip.days.slice()
  const [moved] = next.splice(fromIndex, 1)
  next.splice(clamped, 0, moved)

  return syncContinuousDays(trip, next, trip.startDate)
}

export function deleteTripDay(trip: Trip, dayId: string): Trip {
  if (trip.days.length <= 1) {
    throw new Error('Trip must keep at least one day')
  }

  const next = trip.days.filter((day) => day.id !== dayId)
  if (next.length === trip.days.length) return trip

  return syncContinuousDays(trip, next, trip.startDate)
}

export function applyOrganizedTripDays(trip: Trip, dayIds: string[]): Trip {
  const byId = new Map(trip.days.map((day) => [day.id, day]))
  const next: Day[] = []
  const seen = new Set<string>()

  dayIds.forEach((id) => {
    const day = byId.get(id)
    if (!day || seen.has(id)) return
    next.push(day)
    seen.add(id)
  })

  if (next.length === 0) {
    throw new Error('Trip must keep at least one day')
  }

  return syncContinuousDays(trip, next, trip.startDate)
}
