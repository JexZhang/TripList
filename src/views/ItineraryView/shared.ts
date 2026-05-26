import type { Day, Spot, Trip, Destination } from '../../types/trip'

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
