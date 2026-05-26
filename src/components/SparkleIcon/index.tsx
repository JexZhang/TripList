import { View } from '@tarojs/components'
import './index.scss'

interface Props {
  /** rpx 单位的尺寸，如 30 */
  size?: number
  className?: string
}

export default function SparkleIcon({ size = 30, className }: Props) {
  return (
    <View
      className={`sparkle-wrap ${className || ''}`}
      style={{ width: `${size}rpx`, height: `${size}rpx` }}
    >
      <View className='sparkle-star sparkle-star--main' />
      <View className='sparkle-star sparkle-star--sm' />
      <View className='sparkle-star sparkle-star--xs' />
    </View>
  )
}
