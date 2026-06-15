import { View, Text } from '@tarojs/components'
// import AIBadge from '../AIBadge'
import './index.scss'

interface Props {
  onAITap: () => void
  onNewTap: () => void
  /** 各主题用自己的"新建"文案，比如"新建明信片 / 发起新刊 / 新一页签证 / 新建" */
  newLabel?: string
}

export default function HomeBottomCTA({ onAITap: _onAITap, onNewTap, newLabel = '+ 新建攻略' }: Props) {
  return (
    <View className='hcta'>
      {/* AI 入口已移至首页顶部 HomeAIBanner */}
      <View className='hcta-new' onClick={onNewTap}>
        <Text>{newLabel}</Text>
      </View>
    </View>
  )
}
