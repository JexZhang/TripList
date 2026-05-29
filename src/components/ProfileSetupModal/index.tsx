import { View } from '@tarojs/components'
import ProfileForm from '../ProfileForm'
import { useKeyboardLift } from '../../utils/use-keyboard-height'

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
  const { height: keyboardHeight, bind: kbProps } = useKeyboardLift()
  if (!open) return null

  const handleSubmit = async (data: { nickname: string; avatarUrl: string }) => {
    await onSubmit(data)
    onClose()
  }

  return (
    <View
      className='psm-mask'
      onClick={onClose}
      style={{ paddingBottom: `${keyboardHeight}px`, transition: 'padding-bottom 0.25s ease' }}
    >
      <View className='psm-sheet' onClick={(e) => e.stopPropagation()}>
        <View className='psm-title'>完善个人信息</View>
        <View className='psm-sub'>用于在协作攻略里显示你的身份</View>
        <ProfileForm
          initialNickname={initialNickname}
          initialAvatarUrl={initialAvatarUrl}
          secondaryLabel='跳过'
          onSecondary={onClose}
          onSubmit={handleSubmit}
          kbProps={kbProps}
        />
      </View>
    </View>
  )
}
