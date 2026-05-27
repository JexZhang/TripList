import { useEffect, useRef, useState } from 'react'
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
  const [mounted, setMounted] = useState(false)
  const lastSpotRef = useRef<Spot | null>(null)

  useEffect(() => {
    if (spot) {
      lastSpotRef.current = spot
      setMounted(true)
    } else {
      const t = setTimeout(() => setMounted(false), 360)
      return () => clearTimeout(t)
    }
  }, [spot])

  if (!mounted) return null
  const display = spot ?? lastSpotRef.current
  if (!display) return null

  const navigate = () => {
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
      <View className={`mv-sheet-mask theme-tokens theme-${theme}`} onClick={onClose} catchMove>
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
      </View>
    </RootPortal>
  )
}
