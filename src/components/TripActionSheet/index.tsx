import { View, Text, RootPortal } from '@tarojs/components'
import { useTheme } from '../../store/theme-store'
import './index.scss'

export type TripAction = 'copy' | 'rename' | 'delete' | 'share'

interface Props {
  open: boolean
  tripName: string
  onSelect: (action: TripAction) => void
  onClose: () => void
  actions?: TripAction[]
}

const ALL_ITEMS: { key: TripAction; label: string; danger?: boolean }[] = [
  { key: 'copy', label: '复制攻略' },
  { key: 'rename', label: '重命名' },
  { key: 'share', label: '分享' },
  { key: 'delete', label: '删除', danger: true },
]

export default function TripActionSheet({ open, tripName, onSelect, onClose, actions }: Props) {
  const { theme } = useTheme()
  if (!open) return null
  const items = actions
    ? ALL_ITEMS.filter(it => actions.includes(it.key))
    : ALL_ITEMS
  return (
    <RootPortal>
      <View className={`trip-action-mask theme-tokens theme-${theme}`} onClick={onClose}>
        <View className='trip-action-sheet' onClick={e => e.stopPropagation()}>
          <View className='tas-head'>
            <Text className='tas-title'>{tripName}</Text>
          </View>
          <View className='tas-items'>
            {items.map(it => (
              <View
                key={it.key}
                className={`tas-item ${it.danger ? 'danger' : ''}`}
                onClick={() => { onSelect(it.key); onClose() }}
              >
                <Text>{it.label}</Text>
              </View>
            ))}
          </View>
          <View className='tas-cancel' onClick={onClose}>
            <Text>取消</Text>
          </View>
        </View>
      </View>
    </RootPortal>
  )
}
