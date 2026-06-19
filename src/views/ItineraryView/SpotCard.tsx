import { View, Text } from '@tarojs/components'
import type { Spot } from '../../types/trip'
import { fmtCurrency } from '../../utils/format'
import Icon from '../../components/Icon'

interface Props {
  spot: Spot
  onClick: () => void
  onLongPress?: () => void
}

export default function SpotCard({ spot, onClick, onLongPress }: Props) {
  return (
    <View className='spot-card' onClick={onClick} onLongPress={onLongPress}>
      <View className='sc-head'>
        <View className='sc-icon'>
          <Icon name={spot.type} color='var(--accent)' style={{ width: '34rpx', height: '34rpx' }} />
        </View>
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
