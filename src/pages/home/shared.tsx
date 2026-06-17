import dayjs from 'dayjs'
import type { Trip } from '../../types/trip'
import type { TemplateCard } from '../../types/template'

/** 4 主题子组件共用的 props */
export interface HomeViewProps {
  /** 全部行程，已按 4.1 规则排序（live → pre → post） */
  trips: Trip[]
  loading: boolean
  openid: string
  onOpenTrip: (trip: Trip) => void
  onLongPressTrip: (trip: Trip) => void
  onNewTrip: () => void
  onAITrip: () => void
  onCoverLongPress?: (trip: Trip) => void
  /** 云端精选模板（轻字段） */
  featuredTemplates: TemplateCard[]
  onOpenTemplate: (id: string) => void
  onOpenLibrary: () => void
}

const ZH_MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
const ZH_DAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 首页左上角日期标签，如「六月十七 · 周二」 */
export function todayLabel(): string {
  const d = dayjs()
  return `${ZH_MONTHS[d.month()]}${d.date()}日 · 周${ZH_DAYS[d.day()]}`
}
