import { View, Text, RootPortal } from '@tarojs/components'
import './index.scss'

interface Props {
  open: boolean
  onAgree: () => void
  onDisagree: () => void
}

export default function PrivacyConsent({ open, onAgree, onDisagree }: Props) {
  if (!open) return null

  return (
    <RootPortal>
      <View className='pc-mask'>
        <View className='pc-card' catchMove>
          <Text className='pc-title'>隐私政策</Text>
          <View className='pc-body'>
            <Text className='pc-text'>「行迹」尊重你的隐私。我们仅收集以下信息用于提供旅行攻略服务：</Text>
            <Text className='pc-item'>• 微信昵称和头像（用于协作身份显示）</Text>
            <Text className='pc-item'>• 你创建的攻略内容（存储在云端，仅你和你邀请的协作者可见）</Text>
            <Text className='pc-item'>• 位置信息（仅在你主动使用地图功能时获取）</Text>
            <Text className='pc-text pc-text-gap'>你可以随时在「我的」页面注销账号并删除所有数据。</Text>
            <Text className='pc-text'>继续使用即表示你同意以上政策。</Text>
          </View>
          <View className='pc-actions'>
            <View className='pc-btn pc-btn-disagree' onClick={onDisagree}>不同意</View>
            <View className='pc-btn pc-btn-agree' onClick={onAgree}>同意并继续</View>
          </View>
        </View>
      </View>
    </RootPortal>
  )
}
