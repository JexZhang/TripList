import type { Trip } from '../../types/trip'

export type TripAIHeaderStatus = 'generating' | 'ready' | 'error' | null | undefined

/** 4 个 TripHeader 子组件共用 props */
export interface TripHeaderViewProps {
  trip: Trip
  isOwner: boolean
  aiStatus: TripAIHeaderStatus
  /** AI 按钮点击（disabled 状态时父组件已处理 toast 提示） */
  onAITap: () => void
  /** AI loading bar 点击（与现有 handleBarTap 等价） */
  onAIBarTap: () => void
  /** 右上角菜单按钮（⋯）点击 → 打开 ActionSheet */
  onMenuTap: () => void
  /** 返回按钮 */
  onBack: () => void
  /** pax 改变 */
  onPaxChange: (pax: number) => void
  /** 协作者条点击 */
  onCollabTap: () => void
  /** 整体日期调整入口点击 */
  onDateAdjustTap: () => void
}

/** 标准化 trip.aiStatus 到 AIBadge 可消费的 status */
export function badgeStatusOf(s: TripAIHeaderStatus): 'idle' | 'thinking' | 'ready' | 'error' {
  if (s === 'generating') return 'thinking'
  if (s === 'ready') return 'ready'
  if (s === 'error') return 'error'
  return 'idle'
}
