import { View } from '@tarojs/components'
import './index.scss'

interface Props {
  size?: number
  className?: string
}

export default function NavigationIcon({ size = 28, className }: Props) {
  return (
    <View
      className={`nav-arrow ${className || ''}`}
      style={{ width: `${size}rpx`, height: `${size}rpx` }}
    >
      <View className='nav-arrow-shape' />
    </View>
  )
}
