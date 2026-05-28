import { View, Text } from '@tarojs/components'
import DayHeader from './DayHeader'
import SpotCard from './SpotCard'
import type { ItinViewProps } from './shared'
import './styles/body-postcard.scss'

export default function ItinPostcard({
  activeDay, activeDayIdx, fallbackDestination,
  onSpotClick, onAddSpot, onWeatherUpdate,
}: ItinViewProps) {
  return (
    <View className='itinpp'>
      <View className='itinpp-paper'>
        <View className='itinpp-paper-grain' />
        <View className='itinpp-dayhead'>
          <View className='itinpp-day-info'>
            <DayHeader
              day={activeDay}
              fallbackDestination={fallbackDestination}
              onWeatherUpdate={onWeatherUpdate}
            />
          </View>
        </View>

        <View className='itinpp-spots'>
          {activeDay.spots.map((s) => (
            <SpotCard key={s.id} spot={s} onClick={() => onSpotClick(s)} />
          ))}
          {activeDay.spots.length === 0 && (
            <View className='itinpp-empty'>这一天还没有地点</View>
          )}
          <View className='itinpp-add' onClick={onAddSpot}>+ 添加地点</View>
        </View>
      </View>
    </View>
  )
}
