import { View, Text } from '@tarojs/components'
import DayHeader from './DayHeader'
import SpotCard from './SpotCard'
import { sortSpotsByTime } from './shared'
import type { ItinViewProps } from './shared'
import './styles/body-magazine.scss'

export default function ItinMagazine({
  activeDay, activeDayIdx, fallbackDestination,
  onSpotClick, onAddSpot, onWeatherUpdate,
}: ItinViewProps) {
  return (
    <View className='itinmg'>
      <View className='itinmg-dayhead'>
        <View className='itinmg-day-info'>
          <DayHeader
            day={activeDay}
            fallbackDestination={fallbackDestination}
            onWeatherUpdate={onWeatherUpdate}
          />
        </View>
      </View>
      <View className='itinmg-rule' />

      <View className='itinmg-spots'>
        {sortSpotsByTime(activeDay.spots).map((s) => (
          <SpotCard key={s.id} spot={s} onClick={() => onSpotClick(s)} />
        ))}
        {activeDay.spots.length === 0 && (
          <View className='itinmg-empty'>暂无地点</View>
        )}
        <View className='itinmg-add' onClick={onAddSpot}>+ 添加地点</View>
      </View>
    </View>
  )
}
