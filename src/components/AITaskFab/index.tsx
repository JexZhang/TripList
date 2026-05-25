import { View, Text } from '@tarojs/components'
import type { AITask } from '../../types/trip'
import './index.scss'

interface Props {
  /** 后台仍在跑、但用户已经收起 AILoading 弹窗 → 显示这个悬浮入口 */
  visible: boolean
  task: AITask | null
  elapsedSec: number
  onTap: () => void
}

export default function AITaskFab({ visible, task, elapsedSec, onTap }: Props) {
  if (!visible) return null
  const status = task?.status || 'pending'
  const doneCount = task?.progress?.days?.length || 0

  let label = 'AI 生成中'
  let dot = 'streaming'
  if (status === 'pending') label = 'AI 启动中'
  else if (status === 'streaming') {
    label = doneCount > 0 ? `AI 已生成 ${doneCount} 天` : `AI 生成中 ${elapsedSec}s`
  } else if (status === 'done') { label = 'AI 已就绪 · 查看'; dot = 'done' }
  else if (status === 'error') { label = 'AI 生成失败 · 查看'; dot = 'error' }

  return (
    <View className='ai-fab' onClick={onTap}>
      <View className={`ai-fab-dot ${dot}`} />
      <Text className='ai-fab-text'>{label}</Text>
    </View>
  )
}
