import { View, Text } from '@tarojs/components'
import './index.scss'

export type HomeCardAIRowStatus = 'thinking' | 'ready' | 'error'

interface Props {
  status: HomeCardAIRowStatus
  /** thinking 文案的额外信息，如 "预计 30s" */
  hint?: string
  onTap?: () => void
}

const CONFIG: Record<HomeCardAIRowStatus, { text: string; cls: string }> = {
  thinking: { text: 'AI 正在为你编排',     cls: 'hc-ai--thinking' },
  ready:    { text: 'AI 草稿就绪 · 点击查看', cls: 'hc-ai--ready' },
  error:    { text: 'AI 生成失败 · 点击重试', cls: 'hc-ai--error' },
}

export default function HomeCardAIRow({ status, hint, onTap }: Props) {
  const c = CONFIG[status]
  return (
    <View
      className={`hc-ai ${c.cls}`}
      onClick={(e) => { e.stopPropagation(); onTap?.() }}
    >
      {status === 'thinking' && <View className='hc-ai-shine' />}
      <Text className='hc-ai-icon'>✦</Text>
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
    </View>
  )
}
