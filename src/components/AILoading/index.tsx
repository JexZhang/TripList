import { View, Text } from '@tarojs/components'
import type { AITaskStatus } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  status: AITaskStatus
  doneCount: number       // 已生成天数(由 progress.days.length)
  totalDays: number       // 期望总天数
  onClose: () => void     // 关闭蒙层(任务继续后台跑)
  elapsedSec: number      // 已用时
}

export default function AILoading({ open, status, doneCount, totalDays, onClose, elapsedSec }: Props) {
  if (!open) return null

  const label = status === 'pending'
    ? '排队中…'
    : doneCount > 0
      ? `已生成 Day ${doneCount} / ${totalDays}`
      : '正在构思…'

  return (
    <View className='ail-mask'>
      <View className='ail-card'>
        <View className='ail-spinner' />
        <Text className='ail-text'>{label}</Text>
        <Text className='ail-elapsed'>{elapsedSec}s · 可关闭页面, 后台继续生成</Text>
        <View className='ail-close' onClick={onClose}>关闭蒙层(继续后台跑)</View>
      </View>
    </View>
  )
}
