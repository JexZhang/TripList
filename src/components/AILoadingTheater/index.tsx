import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import './index.scss'

export type TheaterStatus = 'thinking' | 'ready' | 'error'

interface Props {
  open: boolean
  status?: TheaterStatus
  /** 用户点击「停止生成」时调用；父级负责真正取消任务 */
  onCancel?: () => void
  /** 用户点击右上「×」最小化时调用；不停止任务 */
  onMinimize?: () => void
}

const STREAM_MESSAGES = [
  '分析你的偏好…',
  '搜索目的地周边亮点…',
  '为你规划最优路线…',
  '估算每日开销…',
  '正在为你编排成册…',
] as const

export default function AILoadingTheater({
  open,
  status = 'thinking',
  onCancel,
  onMinimize,
}: Props) {
  const [streamText, setStreamText] = useState<string>(STREAM_MESSAGES[0])

  useEffect(() => {
    if (!open || status !== 'thinking') return
    let i = 0
    setStreamText(STREAM_MESSAGES[0])
    const t = setInterval(() => {
      i = (i + 1) % STREAM_MESSAGES.length
      setStreamText(STREAM_MESSAGES[i])
    }, 1100)
    return () => clearInterval(t)
  }, [open, status])

  if (!open) return null
  const done = status === 'ready'
  const err = status === 'error'

  return (
    <View className='ait-mask theme-tokens'>
      <View className='ait-sheet'>
        <View className='ait-close' onClick={onMinimize}>×</View>
        <View className='ait-stage'>
          <View className={`ait-orb ait-orb--${status}`}>
            <View className='ait-orb-core' />
            <View className='ait-orb-ring r1' />
            <View className='ait-orb-ring r2' />
            <View className='ait-orb-ring r3' />
            {done && <Text className='ait-orb-check'>✓</Text>}
            {err  && <Text className='ait-orb-check'>!</Text>}
          </View>
          <Text className='ait-title'>
            {done ? '已为你编排好' : err ? '生成失败' : 'AI 正在为你编排'}
          </Text>
          <Text className='ait-stream' key={streamText}>
            {done ? '即将就绪' : err ? '请稍后重试' : streamText}
          </Text>
        </View>

        {status === 'thinking' && (
          <View className='ait-cancel' onClick={onCancel}>停止生成</View>
        )}
      </View>
    </View>
  )
}
