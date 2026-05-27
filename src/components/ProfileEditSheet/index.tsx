import { useEffect, useState } from 'react'
import { View, Text, RootPortal } from '@tarojs/components'
import Taro from '@tarojs/taro'
import ProfileForm from '../ProfileForm'
import { useTheme } from '../../store/theme-store'
import './index.scss'

interface Props {
  open: boolean
  onClose: () => void
  initialNickname?: string
  initialAvatarUrl?: string
  onSaved: () => void
}

export default function ProfileEditSheet({
  open,
  onClose,
  initialNickname,
  initialAvatarUrl,
  onSaved,
}: Props) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const t = setTimeout(() => setActive(true), 16)
      return () => clearTimeout(t)
    } else {
      setActive(false)
      const t = setTimeout(() => setMounted(false), 360)
      return () => clearTimeout(t)
    }
  }, [open])

  if (!mounted) return null

  return (
    <RootPortal>
      <View
        className={`pes-mask theme-tokens theme-${theme} ${active ? 'open' : ''}`}
        onClick={onClose}
        catchMove
      >
        <View className='pes-sheet' onClick={(e) => e.stopPropagation()}>
          <View className='pes-head'>
            <Text className='pes-title'>编辑资料</Text>
            <Text className='pes-close' onClick={onClose}>×</Text>
          </View>
          <View className='pes-body'>
            <ProfileForm
              initialNickname={initialNickname}
              initialAvatarUrl={initialAvatarUrl}
              onSubmit={async ({ nickname, avatarUrl }) => {
                // @ts-ignore Taro.cloud
                await Taro.cloud.callFunction({
                  name: 'ensure-user',
                  data: { nickname, avatarUrl },
                })
                onSaved()
                onClose()
                Taro.showToast({ title: '已保存', icon: 'success' })
              }}
            />
          </View>
        </View>
      </View>
    </RootPortal>
  )
}
