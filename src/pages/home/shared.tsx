import type { Trip } from '../../types/trip'

/** 4 主题子组件共用的 props */
export interface HomeViewProps {
  trips: Trip[]
  archivedTrips: Trip[]
  loading: boolean
  openid: string
  onOpenTrip: (trip: Trip) => void
  onLongPressTrip: (trip: Trip) => void
  onNewTrip: () => void
  onAITrip: () => void
  /** featureTrip 由父组件挑选（杂志主题），其他主题忽略 */
  featureTrip?: Trip
  onCoverLongPress?: (trip: Trip) => void
}
