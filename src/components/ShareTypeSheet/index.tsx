import { View, Text } from '@tarojs/components'
import type { ShareKind } from '../../utils/cloud'
import './index.scss'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (kind: ShareKind) => void
}

export default function ShareTypeSheet({ open, onClose, onSelect }: Props) {
  if (!open) return null
  return (
    <View className='sts-mask' onClick={onClose}>
      <View className='sts-sheet' onClick={e => e.stopPropagation()}>
        <View
          className='sts-item'
          onClick={() => { onSelect('readonly'); onClose() }}
        >
          <Text className='sts-item-title'>🔒 只读分享</Text>
          <Text className='sts-item-desc'>对方收到一份独立副本,可自由编辑、删除,不影响你这边</Text>
        </View>
        <View
          className='sts-item'
          onClick={() => { onSelect('collab'); onClose() }}
        >
          <Text className='sts-item-title'>👥 邀请协作</Text>
          <Text className='sts-item-desc'>对方加入后能编辑同一份攻略,改动实时同步</Text>
        </View>
        <View className='sts-cancel' onClick={onClose}>
          <Text>取消</Text>
        </View>
      </View>
    </View>
  )
}
