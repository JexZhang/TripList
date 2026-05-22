import { useRef } from 'react'
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
  // 缓存上一次的 spot,关闭时仍可渲染内容做退场动画;避免在 picked 切到 null 那一刻
  // 把整个 mask DOM 卸载 —— 卸载/挂载固定定位的 View 会让 weapp 原生 <map> 重排,
  // 把视野拉回声明的 latitude/longitude/scale。
  const lastSpotRef = useRef<Spot | null>(null)
  if (spot) lastSpotRef.current = spot
  const display = spot ?? lastSpotRef.current
  const visible = !!spot

  const navigate = () => {
    if (!display) return
    if (typeof display.lat !== 'number' || typeof display.lng !== 'number') return
    Taro.openLocation({
      latitude: display.lat,
      longitude: display.lng,
      name: display.name,
      address: display.note || display.city || '',
      scale: 16,
    }).catch(() => {
      Taro.showToast({ title: '无法拉起地图', icon: 'none' })
    })
  }

  return (
    <View
      className={`mv-sheet-mask ${visible ? 'visible' : ''}`}
      onClick={visible ? onClose : undefined}
    >
      {display && (
        <View className='mv-sheet' catchMove onClick={(e) => e.stopPropagation()}>
          <View className='mv-sheet-tag'>{TYPE_LABEL[display.type] || '地点'}</View>
          <View className='mv-sheet-name'>{display.name}</View>
          {display.city && <View className='mv-sheet-sub'>{display.city}</View>}
          {display.note && <View className='mv-sheet-note'>{display.note}</View>}
          {typeof display.price === 'number' && display.price > 0 && (
            <View className='mv-sheet-price'>
              <Text>预算 </Text>
              <Text>{fmtCurrency(display.price)}</Text>
            </View>
          )}
          <View className='mv-sheet-btn' onClick={navigate}>拉起地图导航</View>
        </View>
      )}
    </View>
  )
}
