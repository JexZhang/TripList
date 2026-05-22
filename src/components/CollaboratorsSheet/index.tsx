import { View, Text, Image } from '@tarojs/components'
import type { Collaborator } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  collaborators: Collaborator[]
  ownerNickname?: string
  ownerAvatarUrl?: string
  onClose: () => void
}

export default function CollaboratorsSheet({
  open, collaborators, ownerNickname, ownerAvatarUrl, onClose,
}: Props) {
  if (!open) return null

  const renderAvatar = (avatarUrl: string | undefined, nickname: string | undefined, fallbackKey: string) => (
    avatarUrl
      ? <Image key={fallbackKey} className='cs-avatar' src={avatarUrl} mode='aspectFill' />
      : <View key={fallbackKey} className='cs-avatar cs-avatar-fallback'>
          <Text>{(nickname || '?').slice(0, 1)}</Text>
        </View>
  )

  return (
    <View className='cs-mask' onClick={onClose}>
      <View className='cs-sheet' onClick={(e) => e.stopPropagation()}>
        <View className='cs-title'>协作成员</View>

        <View className='cs-row'>
          {renderAvatar(ownerAvatarUrl, ownerNickname, 'owner')}
          <View className='cs-info'>
            <Text className='cs-name'>{ownerNickname || '原作者'}</Text>
            <Text className='cs-tag'>创建者</Text>
          </View>
        </View>

        {collaborators.map(c => (
          <View key={c.openid} className='cs-row'>
            {renderAvatar(c.avatarUrl, c.nickname, c.openid)}
            <View className='cs-info'>
              <Text className='cs-name'>{c.nickname || '匿名旅人'}</Text>
              <Text className='cs-tag'>
                {new Date(c.joinedAt).toLocaleDateString()} 加入
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
