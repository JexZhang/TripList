import { View } from '@tarojs/components'
import type { ReactNode } from 'react'
import './index.scss'

interface Props {
  active: boolean
  children: ReactNode
  /** 外层传进来的额外 className，用于覆盖 border-radius 等主题差异 */
  className?: string
}

export default function AIGlowWrap({ active, children, className = '' }: Props) {
  if (!active) return <>{children}</>
  return (
    <View className={`aiglow ${className}`}>
      <View className='aiglow-clip'>
        <View className='aiglow-ring' />
      </View>
      {children}
    </View>
  )
}
