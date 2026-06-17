import { View, Text } from '@tarojs/components'
import SparkleIcon from '../../components/SparkleIcon'
import Icon from '../../components/Icon'
import './styles/home-create-tiles.scss'

interface Props {
  onAITrip: () => void
  onNewTrip: () => void
}

/** 首页创建台：双 tile 并排（AI 规划 + 手动新建），4 主题共用骨架、CSS 换皮 */
export default function HomeCreateTiles({ onAITrip, onNewTrip }: Props) {
  return (
    <View className='hct'>
      <View className='hct-tile hct-tile--ai' onClick={onAITrip}>
        <View className='hct-shine' />
        <View className='hct-tile-icon-wrap'>
          <SparkleIcon size={36} />
        </View>
        <Text className='hct-tile-label'>AI 帮你规划</Text>
        <Text className='hct-tile-desc'>说出目的地，智能生成行程</Text>
      </View>
      <View className='hct-tile hct-tile--new' onClick={onNewTrip}>
        <View className='hct-tile-icon-wrap'>
          <Icon name='plus' size={24} color='#fff' />
        </View>
        <Text className='hct-tile-label'>手动新建</Text>
      </View>
    </View>
  )
}
