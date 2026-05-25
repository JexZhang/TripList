import { View, Text } from '@tarojs/components'
import './index.scss'

export type AIBarStatus = 'generating' | 'ready' | 'error'

interface Props {
  status: AIBarStatus
  onTap?: () => void
}

const CONFIG: Record<AIBarStatus, { icon: string; text: string; cls: string }> = {
  generating: { icon: '⟳',  text: 'AI 生成中…',         cls: 'ai-bar--generating' },
  ready:      { icon: '✨', text: 'AI 草稿就绪 · 点击查看', cls: 'ai-bar--ready' },
  error:      { icon: '⚠',  text: 'AI 生成失败 · 点击重试', cls: 'ai-bar--error' },
}

export default function AILoadingBar({ status, onTap }: Props) {
  const c = CONFIG[status]
  return (
    <View
      className={`ai-bar ${c.cls}`}
      onClick={(e) => { e.stopPropagation(); onTap?.() }}
    >
      <Text className={`ai-bar-icon ${status === 'generating' ? 'spin' : ''}`}>{c.icon}</Text>
      <Text className='ai-bar-text'>{c.text}</Text>
    </View>
  )
}
