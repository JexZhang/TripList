import type { Day, Spot, Trip, Destination } from '../../types/trip'

/**
 * 按时间排序地点：
 * - 有 time 的地点按时间升序排在前面
 * - 无 time 的地点保持原始添加顺序，排在后面
 */
export function sortSpotsByTime(spots: Spot[]): Spot[] {
  const withIndex = spots.map((s, i) => ({ s, i }))
  const timed = withIndex.filter(({ s }) => !!s.time)
  const untimed = withIndex.filter(({ s }) => !s.time)
  timed.sort((a, b) => a.s.time!.localeCompare(b.s.time!))
  return [...timed, ...untimed].map(({ s }) => s)
}

export interface ItinViewProps {
  trip: Trip
  activeDay: Day
  activeDayIdx: number
  fallbackDestination: Destination | null
  onSelectDay: (dayId: string) => void
  onLongPressDay: (dayId: string, dayIdx: number) => void
  onAddDay: (position: 'front' | 'back') => void
  onSpotClick: (spot: Spot) => void
  onAddSpot: () => void
  onWeatherUpdate: (w: Day['weather']) => void
}
