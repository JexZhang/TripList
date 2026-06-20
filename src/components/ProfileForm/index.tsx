import { useEffect, useState } from 'react'
import { View, Text, Button, Input, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { uploadAvatar, isCloudUrl } from '../../utils/cover'

interface KbBind {
  adjustPosition: false
  onKeyboardHeightChange: (e: { detail: { height: number } }) => void
}

interface Props {
  initialNickname?: string
  initialAvatarUrl?: string
  /** 保存按钮文案，默认「保存」 */
  submitLabel?: string
  /** 左侧次级按钮文案；不传则不显示该按钮 */
  secondaryLabel?: string
  onSecondary?: () => void
  onSubmit: (data: { nickname: string; avatarUrl: string }) => Promise<void>
  /** 由父级 sheet 注入：禁用系统位移 + 上报键盘高度，便于 sheet 整体抬升 */
  kbProps?: KbBind
}

const DEFAULT_AVATAR = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

export default function ProfileForm({
  initialNickname,
  initialAvatarUrl,
  submitLabel = '保存',
  secondaryLabel,
  onSecondary,
  onSubmit,
  kbProps,
}: Props) {
  const [nickname, setNickname] = useState(
    initialNickname && initialNickname !== '行迹旅人' ? initialNickname : '',
  )
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl || '')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setNickname(initialNickname && initialNickname !== '行迹旅人' ? initialNickname : '')
    setAvatarUrl(initialAvatarUrl || '')
  }, [initialNickname, initialAvatarUrl])

  const onChooseAvatar = async (e: { detail?: { avatarUrl?: string } }) => {
    const url = e?.detail?.avatarUrl
    if (!url) return
    // 已经是云存储 URL，无需重复上传
    if (isCloudUrl(url)) {
      setAvatarUrl(url)
      return
    }
    // 本地临时路径，上传到云存储（仅本机可用，其他设备无法访问）
    setAvatarUploading(true)
    try {
      const cloudUrl = await uploadAvatar(url)
      setAvatarUrl(cloudUrl)
    } catch (err) {
      console.error('[ProfileForm] avatar upload failed', err)
      Taro.showToast({ title: '头像上传失败', icon: 'none' })
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSubmit = async () => {
    const nick = nickname.trim()
    if (!nick) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    if (!avatarUrl || avatarUploading) {
      Taro.showToast({ title: avatarUploading ? '头像上传中…' : '请选择头像', icon: 'none' })
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
        <Text className='psm-avatar-hint'>
          {avatarUploading ? '上传中…' : avatarUrl ? '点击更换头像' : '点击选择微信头像'}
        </Text>
      </Button>

      <View className='psm-field'>
        <Text className='psm-label'>昵称</Text>
        <Input
          className='psm-input'
          type='nickname'
          placeholder='点击可使用微信昵称'
          value={nickname}
          maxlength={20}
          onInput={(e) => setNickname(e.detail.value)}
          onBlur={(e) => { if (e.detail.value) setNickname(e.detail.value) }}
          {...(kbProps ?? { adjustPosition: false as const })}
        />
      </View>

      <View className='psm-actions'>
        {secondaryLabel && (
          <View className='psm-btn psm-btn-skip' onClick={onSecondary}>{secondaryLabel}</View>
        )}
        <View
          className={`psm-btn psm-btn-primary ${submitting || avatarUploading ? 'is-disabled' : ''}`}
          onClick={submitting || avatarUploading ? undefined : handleSubmit}
        >
          {avatarUploading ? '上传中…' : submitting ? '保存中…' : submitLabel}
        </View>
      </View>
    </>
  )
}
