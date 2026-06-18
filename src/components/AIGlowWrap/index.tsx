import { View } from '@tarojs/components'
import type { ReactNode } from 'react'
import './index.scss'

interface Props {
  active: boolean
  children: ReactNode
  /** 外层传进来的额外 className，用于覆盖 border-radius 等主题差异 */
  className?: string
  /** 自定义灯带颜色（主色），默认 --accent */
  ringColor?: string
  /** 自定义灯带颜色（副色），默认 --accent-2 */
  ringColor2?: string
}

export default function AIGlowWrap({ active, children, className = '', ringColor, ringColor2 }: Props) {
  if (!active) return <>{children}</>
  const ringStyle = {
    ...(ringColor && { '--glow-c1': ringColor }),
    ...(ringColor2 && { '--glow-c2': ringColor2 }),
  } as React.CSSProperties
  return (
    <View className={`aiglow ${className}`}>
      <View className='aiglow-clip'>
        <View className='aiglow-ring' style={ringStyle} />
      </View>
      {children}
    </View>
  )
}
