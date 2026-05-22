import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Spot } from '../../types/trip'
import { fmtCurrency } from '../../utils/format'

const TYPE_LABEL: Record<string, string> = {
  spot: '景点',
  hotel: '住宿',
  meal: '餐饮',
  transport: '交通',
  arrive: '抵达',
}

interface Props {
  spot: Spot | null
  onClose: () => void
}

export default function SpotMapSheet({ spot, onClose }: Props) {
  if (!spot) return null

  const navigate = () => {
    if (typeof spot.lat !== 'number' || typeof spot.lng !== 'number') return
    Taro.openLocation({
      latitude: spot.lat,
      longitude: spot.lng,
      name: spot.name,
      address: spot.note || spot.city || '',
      scale: 16,
    }).catch(() => {
      Taro.showToast({ title: '无法拉起地图', icon: 'none' })
    })
  }

  return (
    <View className='mv-sheet-mask' onClick={onClose}>
      <View className='mv-sheet' catchMove onClick={(e) => e.stopPropagation()}>
        <View className='mv-sheet-tag'>{TYPE_LABEL[spot.type] || '地点'}</View>
        <View className='mv-sheet-name'>{spot.name}</View>
        {spot.city && <View className='mv-sheet-sub'>{spot.city}</View>}
        {spot.note && <View className='mv-sheet-note'>{spot.note}</View>}
        {typeof spot.price === 'number' && spot.price > 0 && (
          <View className='mv-sheet-price'>
            <Text>预算 </Text>
            <Text>{fmtCurrency(spot.price)}</Text>
          </View>
        )}
        <View className='mv-sheet-btn' onClick={navigate}>拉起地图导航</View>
      </View>
    </View>
  )
}
