import { View, Text } from '@tarojs/components'
import { useTheme, VALID_THEMES, type ThemeName } from '../../store/theme-store'
import { useThemeClass } from '../../utils/theme-class'
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
        <Text className='preview-section-title'>占位 · 后续 Task 填充</Text>
      </View>
    </View>
  )
}
