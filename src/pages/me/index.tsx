import { useState } from 'react'
import { Button, Image, View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { version } from '../../../package.json'
import { useMe } from '../../store/me-store'
import { useTheme, VALID_THEMES, type ThemeName } from '../../store/theme-store'
import { useThemeClass } from '../../utils/theme-class'
import ProfileEditSheet from '../../components/ProfileEditSheet'
import PencilIcon from '../../components/PencilIcon'
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

const DEFAULT_AVATAR = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

export default function Me() {
  const themeCls = useThemeClass('me')
  const { me, refresh } = useMe()
  const { theme, setTheme } = useTheme()
  const [editOpen, setEditOpen] = useState(false)
  const [pendingTheme, setPendingTheme] = useState<ThemeName | null>(null)
  const dirty = pendingTheme !== null && pendingTheme !== theme

  return (
    <View className={themeCls}>
      <View className='me-section'>
        <Text className='me-section-title'>个人资料</Text>
        <View className='me-profile-card'>
          <Image
            className='me-profile-avatar'
            src={me?.avatarUrl || DEFAULT_AVATAR}
            mode='aspectFill'
          />
          <View className='me-profile-text'>
            <Text className='me-profile-nickname'>
              {me?.nickname && me.nickname !== '行册旅人' ? me.nickname : '点击编辑昵称'}
            </Text>
          </View>
          <View className='me-profile-edit' onClick={() => setEditOpen(true)}>
            <PencilIcon size={32} />
          </View>
        </View>
      </View>

      <View className='me-section'>
        <Text className='me-section-title'>主题</Text>
        <View className='me-theme-grid'>
          {VALID_THEMES.map((name) => {
            const isCurrent = name === theme && pendingTheme === null
            const isPending = name === pendingTheme
            return (
              <View
                key={name}
                className={`me-theme-card ${isCurrent ? 'is-current' : ''} ${isPending ? 'is-pending' : ''}`}
                onClick={() => {
                  if (name === theme) setPendingTheme(null)
                  else setPendingTheme(name)
                }}
              >
                <Image className='me-theme-thumb' src={THEME_THUMB[name]} mode='aspectFit' />
                <Text className='me-theme-name-zh'>{THEME_LABELS[name].zh}</Text>
                <Text className='me-theme-name-en'>{THEME_LABELS[name].en}</Text>
                {isCurrent && <View className='me-theme-badge me-theme-badge--current'>当前</View>}
                {isPending && <View className='me-theme-badge me-theme-badge--pending'>待应用</View>}
              </View>
            )
          })}
        </View>

        {dirty && pendingTheme && (
          <View
            className='me-theme-apply'
            onClick={() => {
              setTheme(pendingTheme)
              setPendingTheme(null)
              Taro.showToast({ title: '已切换主题', icon: 'success' })
            }}
          >
            应用「{THEME_LABELS[pendingTheme].zh}」主题
          </View>
        )}
      </View>

      {process.env.TARO_ENV === 'weapp' && (
        <View className='me-section me-feedback-card'>
          <Text className='me-feedback-version'>v{version}</Text>
          <Text className='me-feedback-label'>意见反馈</Text>
          <Text className='me-feedback-desc'>告诉我们你的想法，帮助行册变得更好</Text>
          {/* @ts-ignore open-type="feedback" is weapp-only */}
          <Button className='me-feedback-btn' openType='feedback' />
        </View>
      )}

      <ProfileEditSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialNickname={me?.nickname}
        initialAvatarUrl={me?.avatarUrl}
        onSaved={() => { void refresh() }}
      />
    </View>
  )
}
