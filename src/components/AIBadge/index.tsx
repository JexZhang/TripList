import { View, Text } from '@tarojs/components'
import SparkleIcon from '../SparkleIcon'
import './index.scss'

export type AIBadgeStatus = 'idle' | 'thinking' | 'ready' | 'error'
export type AIBadgeSize = 'compact' | 'lg'

interface Props {
  status?: AIBadgeStatus
  size?: AIBadgeSize
  label?: string
  onClick?: () => void
  className?: string
}

const DEFAULT_LABELS: Record<AIBadgeStatus, string> = {
  idle:     '让 AI 帮你规划',
  thinking: 'AI 正在编排…',
  ready:    '草稿就绪',
  error:    '生成失败 · 重试',
}

export default function AIBadge({
  status = 'idle',
  size = 'compact',
  label,
  onClick,
  className,
}: Props) {
  const text = label || DEFAULT_LABELS[status]
  return (
    <View
      className={`ai-badge ai-badge--${status} ai-badge--${size} ${className || ''}`}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
    >
      <View className='ai-badge-shine' />
      <SparkleIcon size={size === 'lg' ? 32 : 26} className='ai-badge-icon' />
      <Text className='ai-badge-text'>{text}</Text>
      {status === 'thinking' && (
        <View className='ai-badge-dots'>
          <View className='ai-badge-dot' />
          <View className='ai-badge-dot' />
          <View className='ai-badge-dot' />
        </View>
      )}
    </View>
  )
}
