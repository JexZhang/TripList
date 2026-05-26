import { View, Text } from '@tarojs/components'
import { useTheme, VALID_THEMES, type ThemeName } from '../../store/theme-store'
import { useThemeClass } from '../../utils/theme-class'
import BrandLogo from '../../components/BrandLogo'
import AIBadge from '../../components/AIBadge'
import './index.scss'

export default function Preview() {
  const cls = useThemeClass('preview')
  const { theme, setTheme } = useTheme()

  return (
    <View className={cls}>
      <View className='preview-theme-bar'>
        {VALID_THEMES.map((t: ThemeName) => (
          <View
            key={t}
            className={`preview-theme-chip ${theme === t ? 'on' : ''}`}
            onClick={() => setTheme(t)}
          >{t}</View>
        ))}
      </View>

      <View className='preview-section'>
        <Text className='preview-section-title'>BrandLogo · 钤印</Text>
        <View className='preview-row'>
          <Text className='preview-row-label'>lg</Text>
          <BrandLogo size='lg' />
        </View>
        <View className='preview-row'>
          <Text className='preview-row-label'>md</Text>
          <BrandLogo size='md' />
        </View>
        <View className='preview-row'>
          <Text className='preview-row-label'>sm</Text>
          <BrandLogo size='sm' />
        </View>
      </View>

      <View className='preview-section'>
        <Text className='preview-section-title'>AIBadge · 4 status × 2 size</Text>
        <View className='preview-row'>
          <Text className='preview-row-label'>compact</Text>
          <AIBadge status='idle' size='compact' />
          <AIBadge status='thinking' size='compact' />
          <AIBadge status='ready' size='compact' />
          <AIBadge status='error' size='compact' />
        </View>
        <View className='preview-row preview-row--stack'>
          <Text className='preview-row-label'>lg (idle)</Text>
          <AIBadge status='idle' size='lg' label='✦ 让 AI 帮你规划' />
        </View>
        <View className='preview-row preview-row--stack'>
          <Text className='preview-row-label'>lg (thinking)</Text>
          <AIBadge status='thinking' size='lg' />
        </View>
      </View>
    </View>
  )
}
