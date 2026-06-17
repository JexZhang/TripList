import { View, Text } from '@tarojs/components'
import SparkleIcon from '../SparkleIcon'
import './index.scss'

export type HomeCardAIRowStatus = 'thinking' | 'ready' | 'error'

interface Props {
  status: HomeCardAIRowStatus
  hint?: string
}

const CONFIG: Record<HomeCardAIRowStatus, { text: string; cls: string }> = {
  thinking: { text: 'AI 正在为你编排',     cls: 'hc-ai--thinking' },
  ready:    { text: 'AI 草稿就绪 · 点击查看', cls: 'hc-ai--ready' },
  error:    { text: 'AI 生成失败 · 点击重试', cls: 'hc-ai--error' },
}

export default function HomeCardAIRow({ status, hint }: Props) {
  const c = CONFIG[status]
  return (
    <View className={`hc-ai ${c.cls}`}>
      <View className='hc-ai-deco' />
      {status === 'thinking' && <View className='hc-ai-shine' />}
      <SparkleIcon size={22} className='hc-ai-icon' />
      <Text className='hc-ai-text'>
        {c.text}{hint ? ` · ${hint}` : ''}
      </Text>
      {status === 'thinking' && (
        <View className='hc-ai-dots'>
          <View className='hc-ai-dot' />
          <View className='hc-ai-dot' />
          <View className='hc-ai-dot' />
        </View>
      )}
      {status === 'ready' && <Text className='hc-ai-arrow'>›</Text>}
      {status === 'error' && <Text className='hc-ai-arrow'>↻</Text>}
    </View>
  )
}
