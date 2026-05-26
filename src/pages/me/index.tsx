import { View, Text, Button, Image, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { useMe } from '../../store/me-store'
import { useTheme, VALID_THEMES, type ThemeName } from '../../store/theme-store'
import { useThemeClass } from '../../utils/theme-class'
import './index.scss'

const THEME_LABELS: Record<ThemeName, { zh: string; en: string }> = {
  tegami:   { zh: '手帖', en: 'TEGAMI' },
  magazine: { zh: '刊物', en: 'MAGAZINE' },
  postcard: { zh: '护照', en: 'POSTCARD' },
  minimal:  { zh: '极简', en: 'MINIMAL' },
}

const DEFAULT_AVATAR = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

export default function Me() {
  const themeCls = useThemeClass('me')
  const { me, refresh } = useMe()
  const { theme, setTheme } = useTheme()
  const [nickname, setNickname] = useState(me?.nickname && me.nickname !== '行册旅人' ? me.nickname : '')
  const [avatarUrl, setAvatarUrl] = useState(me?.avatarUrl || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (me) {
      setNickname(me.nickname && me.nickname !== '行册旅人' ? me.nickname : '')
      setAvatarUrl(me.avatarUrl || '')
    }
  }, [me])

  const onChooseAvatar = (e: any) => {
    const url = e?.detail?.avatarUrl
    if (url) setAvatarUrl(url)
  }

  const handleSaveProfile = async () => {
    const nick = nickname.trim()
    if (!nick) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      // @ts-ignore Taro.cloud
      await Taro.cloud.callFunction({
        name: 'ensure-user',
        data: { nickname: nick, avatarUrl },
      })
      await refresh()
      Taro.showToast({ title: '已保存', icon: 'success' })
    } catch (e) {
      console.error('[me] save failed', e)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className={themeCls}>
      <View className='me-section'>
        <Text className='me-section-title'>个人资料</Text>
        <Button
          className='me-avatar-btn'
          openType='chooseAvatar'
          onChooseAvatar={onChooseAvatar}
        >
          <Image className='me-avatar' src={avatarUrl || DEFAULT_AVATAR} mode='aspectFill' />
          <Text className='me-avatar-hint'>{avatarUrl ? '点击更换头像' : '点击选择微信头像'}</Text>
        </Button>
        <View className='me-field'>
          <Text className='me-label'>昵称</Text>
          <Input
            className='me-input'
            type='nickname'
            placeholder='请输入昵称'
            value={nickname}
            onInput={(e) => setNickname(e.detail.value)}
          />
        </View>
        <View
          className={`me-save-btn ${saving ? 'is-disabled' : ''}`}
          onClick={saving ? undefined : handleSaveProfile}
        >
          {saving ? '保存中…' : '保存'}
        </View>
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
                <View className={`me-theme-thumb me-theme-thumb--${name}`} />
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
