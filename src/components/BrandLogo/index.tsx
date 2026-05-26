import { View, Text } from '@tarojs/components'
import './index.scss'

type Size = 'sm' | 'md' | 'lg'

interface Props {
  size?: Size
  className?: string
}

export default function BrandLogo({ size = 'lg', className }: Props) {
  return (
    <View className={`brand-seal brand-seal--${size} ${className || ''}`}>
      <View className='brand-seal-mark'>
        <View className='brand-seal-chars'>
          <Text className='brand-seal-char'>行</Text>
          <Text className='brand-seal-char'>册</Text>
        </View>
        <View className='brand-seal-corner brand-seal-corner-tl' />
        <View className='brand-seal-corner brand-seal-corner-br' />
      </View>
      <View className='brand-seal-side'>
        <Text className='brand-seal-en'>XING · CE</Text>
        <Text className='brand-seal-cap'>旅 行 簿 · 2026</Text>
      </View>
    </View>
  )
}
