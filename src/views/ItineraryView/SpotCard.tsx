import { View, Text } from '@tarojs/components'
import type { Spot } from '../../types/trip'
import { fmtCurrency } from '../../utils/format'

const ICON: Record<string, string> = {
  spot: '◉',
  hotel: '🛏',
  meal: '🍜',
  transport: '🚄',
  arrive: '✈',
}

interface Props {
  spot: Spot
  onClick: () => void
}

export default function SpotCard({ spot, onClick }: Props) {
  return (
    <View className='spot-card' onClick={onClick}>
      <View className='sc-head'>
        <Text className='sc-icon'>{ICON[spot.type] || '◉'}</Text>
        <Text className='sc-time'>{spot.time || '—'}</Text>
        <Text className='sc-name'>{spot.name}</Text>
      </View>
      {(spot.note || spot.price) && (
        <View className='sc-foot'>
          {spot.note ? <Text className='sc-note'>{spot.note}</Text> : null}
          {spot.price ? <Text className='sc-price'>{fmtCurrency(spot.price)}</Text> : null}
        </View>
      )}
    </View>
  )
}
