import { useState } from 'react'
import { View, Text, Button, Input, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
// SCSS 在 app.scss 中全局引入，避免 chunk 顺序冲突警告

interface Props {
  open: boolean
  initialNickname?: string
  initialAvatarUrl?: string
  onClose: () => void
  onSubmit: (data: { nickname: string; avatarUrl: string }) => Promise<void>
}

const DEFAULT_AVATAR = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

export default function ProfileSetupModal({
  open, initialNickname, initialAvatarUrl, onClose, onSubmit,
}: Props) {
  const [nickname, setNickname] = useState(initialNickname && initialNickname !== '行册旅人' ? initialNickname : '')
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl || '')
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const onChooseAvatar = (e: any) => {
    const url = e?.detail?.avatarUrl
    if (url) setAvatarUrl(url)
  }

  const handleSubmit = async () => {
    const nick = nickname.trim()
    if (!nick) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    if (!avatarUrl) {
      Taro.showToast({ title: '请选择头像', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({ nickname: nick, avatarUrl })
      onClose()
    } catch (e) {
      console.error('[ProfileSetupModal] submit failed', e)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='psm-mask' onClick={onClose}>
      <View className='psm-sheet' onClick={(e) => e.stopPropagation()}>
        <View className='psm-title'>完善个人信息</View>
        <View className='psm-sub'>用于在协作攻略里显示你的身份</View>

        <Button
          className='psm-avatar-btn'
          openType='chooseAvatar'
          onChooseAvatar={onChooseAvatar}
        >
          <Image className='psm-avatar' src={avatarUrl || DEFAULT_AVATAR} mode='aspectFill' />
          <Text className='psm-avatar-hint'>{avatarUrl ? '点击更换头像' : '点击选择微信头像'}</Text>
        </Button>

        <View className='psm-field'>
          <Text className='psm-label'>昵称</Text>
          <Input
            className='psm-input'
            type='nickname'
            placeholder='请输入昵称'
            value={nickname}
            onInput={(e) => setNickname(e.detail.value)}
          />
        </View>

        <View className='psm-actions'>
          <View className='psm-btn psm-btn-skip' onClick={onClose}>跳过</View>
          <View
            className={`psm-btn psm-btn-primary ${submitting ? 'is-disabled' : ''}`}
            onClick={submitting ? undefined : handleSubmit}
          >
            {submitting ? '保存中…' : '保存'}
          </View>
        </View>
      </View>
    </View>
  )
}
