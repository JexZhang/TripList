import { View, Text } from '@tarojs/components'
import SparkleIcon from '../SparkleIcon'
import './index.scss'

interface Props {
  onTap: () => void
}

export default function HomeAIBanner({ onTap }: Props) {
  return (
    <View className='hai-banner' onClick={onTap}>
      <View className='hai-shine' />
      <View className='hai-icon'>
        <SparkleIcon size={28} />
      </View>
      <View className='hai-body'>
        <Text className='hai-title'>AI 帮你规划行程</Text>
        <Text className='hai-sub'>告诉 AI 目的地，一键生成完整攻略</Text>
      </View>
      <Text className='hai-arrow'>›</Text>
    </View>
  )
}
