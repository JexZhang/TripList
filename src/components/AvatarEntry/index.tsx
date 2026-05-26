import { View, Image, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMe } from '../../store/me-store'
import './index.scss'

interface Props {
  className?: string
}

export default function AvatarEntry({ className }: Props) {
  const { me } = useMe()
  const hasAvatar = !!me?.avatarUrl
  const needSetup = !me || (!me.avatarUrl && (!me.nickname || me.nickname === '行册旅人'))

  const onTap = () => {
    Taro.navigateTo({ url: '/pages/me/index' })
  }

  return (
    <View className={`avatar-entry ${className || ''}`} onClick={onTap}>
      {hasAvatar ? (
        <Image className='avatar-entry-img' src={me!.avatarUrl} mode='aspectFill' />
      ) : (
        <View className='avatar-entry-fallback'>
          <Text className='avatar-entry-fallback-text'>
            {(me?.nickname || '我').slice(0, 1)}
          </Text>
        </View>
      )}
      {needSetup && <View className='avatar-entry-dot' />}
    </View>
  )
}
