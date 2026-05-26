import { useEffect, useState } from 'react'
import { View, Text, Button, Input, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'

interface Props {
  initialNickname?: string
  initialAvatarUrl?: string
  /** 保存按钮文案，默认「保存」 */
  submitLabel?: string
  /** 左侧次级按钮文案；不传则不显示该按钮 */
  secondaryLabel?: string
  onSecondary?: () => void
  onSubmit: (data: { nickname: string; avatarUrl: string }) => Promise<void>
}

const DEFAULT_AVATAR = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

export default function ProfileForm({
  initialNickname,
  initialAvatarUrl,
  submitLabel = '保存',
  secondaryLabel,
  onSecondary,
  onSubmit,
}: Props) {
  const [nickname, setNickname] = useState(
    initialNickname && initialNickname !== '行册旅人' ? initialNickname : '',
  )
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl || '')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setNickname(initialNickname && initialNickname !== '行册旅人' ? initialNickname : '')
    setAvatarUrl(initialAvatarUrl || '')
  }, [initialNickname, initialAvatarUrl])

  const onChooseAvatar = (e: { detail?: { avatarUrl?: string } }) => {
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
    } catch (e) {
      console.error('[ProfileForm] submit failed', e)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
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
          type='text'
          placeholder='请输入昵称'
          value={nickname}
          onInput={(e) => setNickname(e.detail.value)}
        />
      </View>

      <View className='psm-actions'>
        {secondaryLabel && (
          <View className='psm-btn psm-btn-skip' onClick={onSecondary}>{secondaryLabel}</View>
        )}
        <View
          className={`psm-btn psm-btn-primary ${submitting ? 'is-disabled' : ''}`}
          onClick={submitting ? undefined : handleSubmit}
        >
          {submitting ? '保存中…' : submitLabel}
        </View>
      </View>
    </>
  )
}
