import type { Trip } from '../../types/trip'
import type { TemplateCard } from '../../types/template'

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
  /** 云端精选模板（轻字段） */
  featuredTemplates: TemplateCard[]
  onOpenTemplate: (id: string) => void
  onOpenLibrary: () => void
}
