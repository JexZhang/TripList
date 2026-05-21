import { View, Text, Image } from '@tarojs/components'
import type { Collaborator } from '../../types/trip'
import './index.scss'

interface Props {
  collaborators: Collaborator[]
  ownerNickname?: string
  isOwner: boolean
}

export default function CollaboratorsBar({ collaborators, ownerNickname, isOwner }: Props) {
  if (collaborators.length === 0 && isOwner) return null

  return (
    <View className='collab-bar'>
      <Text className='cb-label'>
        {isOwner ? '协作者' : `${ownerNickname || '原作者'} 的攻略`}
      </Text>
      <View className='cb-avatars'>
        {collaborators.slice(0, 5).map(c => (
          c.avatarUrl
            ? <Image key={c.openid} className='cb-avatar' src={c.avatarUrl} mode='aspectFill' />
            : <View key={c.openid} className='cb-avatar cb-avatar-fallback'>
                <Text>{(c.nickname || '?').slice(0, 1)}</Text>
              </View>
        ))}
        {collaborators.length > 5 && (
          <View className='cb-avatar cb-avatar-more'>
            <Text>+{collaborators.length - 5}</Text>
          </View>
        )}
      </View>
    </View>
  )
}
