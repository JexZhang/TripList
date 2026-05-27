import { View } from '@tarojs/components'
import './index.scss'

interface Props {
  /** rpx 单位的尺寸，如 32 */
  size?: number
  className?: string
}

export default function PencilIcon({ size = 32, className }: Props) {
  return (
    <View
      className={`pencil-wrap ${className || ''}`}
      style={{ width: `${size}rpx`, height: `${size}rpx` }}
    >
      <View className='pencil-shape' />
    </View>
  )
}
