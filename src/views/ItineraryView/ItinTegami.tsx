import { View, Text } from '@tarojs/components'
import DayHeader from './DayHeader'
import SpotCard from './SpotCard'
import { sortSpotsByTime } from './shared'
import type { ItinViewProps } from './shared'
import './styles/body-tegami.scss'

export default function ItinTegami({
  activeDay, activeDayIdx, fallbackDestination,
  onSpotClick, onSpotLongPress, onAddSpot, onWeatherUpdate,
}: ItinViewProps) {
  return (
    <View className='itintg'>
      <View className='itintg-dayhead'>
        <View className='itintg-day-info'>
          <DayHeader
            day={activeDay}
            fallbackDestination={fallbackDestination}
            onWeatherUpdate={onWeatherUpdate}
          />
        </View>
      </View>

      <View className='itintg-spots'>
        {sortSpotsByTime(activeDay.spots).map((s) => (
          <SpotCard key={s.id} spot={s} onClick={() => onSpotClick(s)} onLongPress={() => onSpotLongPress(s)} />
        ))}
        {activeDay.spots.length === 0 && (
          <View className='itintg-empty'>这一天还没有地点</View>
        )}
        <View className='itintg-add' onClick={onAddSpot}>+ 添加地点</View>
      </View>
    </View>
  )
}
