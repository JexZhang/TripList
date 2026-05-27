import { View, Text } from '@tarojs/components'
import SparkleIcon from '../SparkleIcon'
import './index.scss'

export type TripAIStatusBarStatus = 'generating' | 'ready' | 'error'

interface Props {
  status: TripAIStatusBarStatus
  onTap: () => void
}

const CONFIG: Record<TripAIStatusBarStatus, { text: string; cls: string }> = {
  generating: { text: 'AI 正在为你编排…',     cls: 'taisb--generating' },
  ready:      { text: 'AI 草稿就绪 · 点击查看', cls: 'taisb--ready' },
  error:      { text: 'AI 生成失败 · 点击重试', cls: 'taisb--error' },
}

export default function TripAIStatusBar({ status, onTap }: Props) {
  const c = CONFIG[status]
  return (
    <View className={`taisb ${c.cls}`} onClick={onTap}>
      <View className='taisb-deco' />
      {status === 'generating' && <View className='taisb-shine' />}
      <SparkleIcon size={22} className='taisb-icon' />
      <Text className='taisb-text'>{c.text}</Text>
      {status === 'generating' && (
        <View className='taisb-dots'>
          <View className='taisb-dot' />
          <View className='taisb-dot' />
          <View className='taisb-dot' />
        </View>
      )}
      {status === 'ready' && <Text className='taisb-arrow'>›</Text>}
      {status === 'error' && <Text className='taisb-arrow'>↻</Text>}
    </View>
  )
}
