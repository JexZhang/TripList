import { View } from '@tarojs/components'
import type { CSSProperties } from 'react'
import './index.scss'

export type IconName =
  | 'search' | 'pin' | 'tag' | 'people' | 'season' | 'lock' | 'sliders'
  | 'itinerary' | 'map' | 'budget' | 'packing'
  | 'spot' | 'hotel' | 'meal' | 'transport'
  | 'check' | 'plus' | 'close' | 'arrow-left' | 'chevron-down' | 'chevron-right'

interface IconProps {
  name: IconName
  size?: number          // px
  color?: string         // 任意 CSS color / token,默认 var(--ink)
  className?: string
  style?: CSSProperties
}

// mask-image 走 .icon--<name> 类(在 index.scss),weapp 端内联 WebkitMaskImage 不生效;颜色仍走内联 backgroundColor。
export default function Icon({ name, size = 22, color = 'var(--ink)', className = '', style }: IconProps) {
  const merged: CSSProperties = {
    width: size,
    height: size,
    backgroundColor: color,
    ...style,
  }
  return <View className={`icon icon--${name} ${className}`} style={merged} />
}
