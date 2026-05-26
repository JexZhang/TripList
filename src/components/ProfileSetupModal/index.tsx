import { View } from '@tarojs/components'
import ProfileForm from '../ProfileForm'

interface Props {
  open: boolean
  initialNickname?: string
  initialAvatarUrl?: string
  onClose: () => void
  onSubmit: (data: { nickname: string; avatarUrl: string }) => Promise<void>
}

export default function ProfileSetupModal({
  open, initialNickname, initialAvatarUrl, onClose, onSubmit,
}: Props) {
  if (!open) return null

  const handleSubmit = async (data: { nickname: string; avatarUrl: string }) => {
    await onSubmit(data)
    onClose()
  }

  return (
    <View className='psm-mask' onClick={onClose}>
      <View className='psm-sheet' onClick={(e) => e.stopPropagation()}>
        <View className='psm-title'>完善个人信息</View>
        <View className='psm-sub'>用于在协作攻略里显示你的身份</View>
        <ProfileForm
          initialNickname={initialNickname}
          initialAvatarUrl={initialAvatarUrl}
          secondaryLabel='跳过'
          onSecondary={onClose}
          onSubmit={handleSubmit}
        />
      </View>
    </View>
  )
}
