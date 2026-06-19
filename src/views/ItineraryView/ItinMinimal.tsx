import { View, Text } from '@tarojs/components'
import DayHeader from './DayHeader'
import SpotCard from './SpotCard'
import { sortSpotsByTime } from './shared'
import type { ItinViewProps } from './shared'
import './styles/body-minimal.scss'

export default function ItinMinimal({
  activeDay, activeDayIdx, fallbackDestination,
  onSpotClick, onSpotLongPress, onAddSpot, onWeatherUpdate,
}: ItinViewProps) {
  return (
    <View className='itinmin'>
      <View className='itinmin-dayhead'>
        <View className='itinmin-day-info'>
          <DayHeader
            day={activeDay}
            fallbackDestination={fallbackDestination}
            onWeatherUpdate={onWeatherUpdate}
          />
        </View>
      </View>

      <View className='itinmin-spots'>
        {sortSpotsByTime(activeDay.spots).map((s) => (
          <SpotCard key={s.id} spot={s} onClick={() => onSpotClick(s)} onLongPress={() => onSpotLongPress(s)} />
        ))}
        {activeDay.spots.length === 0 && (
          <View className='itinmin-empty'>—</View>
        )}
        <View className='itinmin-add' onClick={onAddSpot}>+ 添加</View>
      </View>
    </View>
  )
}
