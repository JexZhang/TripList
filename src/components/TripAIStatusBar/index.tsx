import { View, Text } from '@tarojs/components'
import SparkleIcon from '../SparkleIcon'
import './index.scss'

interface Props {
  /** 不展示就传 false；ready 状态由父级自动转 AIPlanPreview，不在本组件渲染 */
  open: boolean
  onTap?: () => void
}

export default function TripAIStatusBar({ open, onTap }: Props) {
  if (!open) return null
  return (
    <View className='taisb' onClick={onTap}>
      <View className='taisb-shine' />
      <SparkleIcon size={24} className='taisb-icon' />
      <Text className='taisb-text'>AI 正在为你编排 · 点击展开</Text>
      <View className='taisb-dots'>
        <View className='taisb-dot' />
        <View className='taisb-dot' />
        <View className='taisb-dot' />
      </View>
    </View>
  )
}
