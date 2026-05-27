import { Image, View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMe } from '../../store/me-store'
import { useTheme, VALID_THEMES, type ThemeName } from '../../store/theme-store'
import { useThemeClass } from '../../utils/theme-class'
import ProfileForm from '../../components/ProfileForm'
import tegamiThumb   from '../../assets/theme-preview/tegami.svg'
import magazineThumb from '../../assets/theme-preview/magazine.svg'
import postcardThumb from '../../assets/theme-preview/postcard.svg'
import minimalThumb  from '../../assets/theme-preview/minimal.svg'
import './index.scss'

const THEME_LABELS: Record<ThemeName, { zh: string; en: string }> = {
  tegami:   { zh: '手帖', en: 'TEGAMI' },
  magazine: { zh: '刊物', en: 'MAGAZINE' },
  postcard: { zh: '护照', en: 'POSTCARD' },
  minimal:  { zh: '极简', en: 'MINIMAL' },
}

const THEME_THUMB: Record<ThemeName, string> = {
  tegami: tegamiThumb,
  magazine: magazineThumb,
  postcard: postcardThumb,
  minimal: minimalThumb,
}

export default function Me() {
  const themeCls = useThemeClass('me')
  const { me, refresh } = useMe()
  const { theme, setTheme } = useTheme()

  return (
    <View className={themeCls}>
      <View className='me-section'>
        <Text className='me-section-title'>个人资料</Text>
        <ProfileForm
          initialNickname={me?.nickname}
          initialAvatarUrl={me?.avatarUrl}
          onSubmit={async ({ nickname, avatarUrl }) => {
            // @ts-ignore Taro.cloud
            await Taro.cloud.callFunction({
              name: 'ensure-user',
              data: { nickname, avatarUrl },
            })
            await refresh()
            Taro.showToast({ title: '已保存', icon: 'success' })
          }}
        />
      </View>

      <View className='me-section'>
        <Text className='me-section-title'>主题</Text>
        <View className='me-theme-grid'>
          {VALID_THEMES.map((name) => {
            const selected = name === theme
            return (
              <View
                key={name}
                className={`me-theme-card ${selected ? 'is-selected' : ''}`}
                onClick={() => setTheme(name)}
              >
                <Image
                  className='me-theme-thumb'
                  src={THEME_THUMB[name]}
                  mode='aspectFill'
                />
                <Text className='me-theme-name-zh'>{THEME_LABELS[name].zh}</Text>
                <Text className='me-theme-name-en'>{THEME_LABELS[name].en}</Text>
              </View>
            )
          })}
        </View>
      </View>

      <View className='me-section me-section--meta'>
        <Text className='me-meta'>行册 · v1.0.0</Text>
      </View>
    </View>
  )
}
