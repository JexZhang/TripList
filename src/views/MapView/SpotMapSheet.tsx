import { useRef } from 'react'
import { View, Text, RootPortal } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Spot } from '../../types/trip'
import { fmtCurrency } from '../../utils/format'
import { useTheme } from '../../store/theme-store'
import './SpotMapSheet.scss'

const TYPE_LABEL: Record<string, string> = {
  spot: '其他',
  hotel: '住宿',
  meal: '餐饮',
  transport: '交通',
}

interface Props {
  spot: Spot | null
  onClose: () => void
}

export default function SpotMapSheet({ spot, onClose }: Props) {
  const { theme } = useTheme()
  // 关键:RootPortal 与 mask DOM 必须常驻,绝不能在 spot 切到 null 时卸载。
  // 卸载/挂载 RootPortal 会让 weapp 原生 <map> 重排,把视野拉回声明的 lat/lng/scale,
  // 导致用户每次关闭 sheet 时地图都跳回默认视野。
  // 缓存最近一次 spot,这样关闭过程中仍能渲染内容做退场动画。
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
    <RootPortal>
      <View
        className={`mv-sheet-mask theme-tokens theme-${theme} ${visible ? 'visible' : ''}`}
        onClick={visible ? onClose : undefined}
        catchMove={visible}
      >
        {display && (
          <View className='mv-sheet' onClick={(e) => e.stopPropagation()}>
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
            <View className='mv-sheet-btn' onClick={navigate}>导航</View>
          </View>
        )}
      </View>
    </RootPortal>
  )
}
