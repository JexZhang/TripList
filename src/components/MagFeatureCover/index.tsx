import { View, Text, Image } from '@tarojs/components'
import { resolveCoverUrl } from '../../utils/cover'
import type { Trip } from '../../types/trip'
import './index.scss'

interface Props {
  trip: Trip
  /** 长按 → 触发更换封面流（父组件控制 CoverPicker open） */
  onLongPress?: () => void
}

export default function MagFeatureCover({ trip, onLongPress }: Props) {
  const src = resolveCoverUrl(trip.coverUrl)
  const days = computeDays(trip.startDate, trip.endDate)
  const destFull = (trip.destinations || []).map((d) => d.name).join(' · ')

  return (
    <View className='mfc' onLongPress={onLongPress}>
      <View className='mfc-frame'>
        <Image
          className='mfc-img'
          src={src}
          mode='aspectFill'
        />
        <View className='mfc-grain' />
        <View className='mfc-overlay'>
          <View className='mfc-tl'>
            <Text className='mfc-issue'>VOL. {String(trip.pax || 1).padStart(3, '0')} / SPRING</Text>
            <Text className='mfc-edition'>2026</Text>
          </View>
          <View className='mfc-tr'>
            <View className='mfc-barcode'>
              {Array.from({ length: 24 }).map((_, i) => (
                <View
                  key={i}
                  className='mfc-barcode-bar'
                  style={{ width: `${2 + (i % 4) * 2}rpx` }}
                />
              ))}
            </View>
            <Text className='mfc-price'>¥ 0 · MMXXVI</Text>
          </View>
          <View className='mfc-bl'>
            <Text className='mfc-kicker'>FEATURE</Text>
            <Text className='mfc-headline'>{destFull || trip.name}</Text>
            <Text className='mfc-deck'>{days} DAYS · {trip.pax} TRAVELERS</Text>
          </View>
          <View className='mfc-br'>
            <Text className='mfc-replace'>长按更换</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

function computeDays(start: string, end: string): number {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  return Math.max(1, Math.round((e - s) / 86400000) + 1)
}
