import { View, Text, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import AIBadge from '../../components/AIBadge'
import Icon from '../../components/Icon'
import CollaboratorsBar from '../../components/CollaboratorsBar'
import type { TripHeaderViewProps } from './shared-header'
import './styles/header-magazine.scss'

const PAX_OPTIONS = Array.from({ length: 99 }, (_, i) => `${i + 1} 人`)
const statusBarHeight = Taro.getSystemInfoSync().statusBarHeight || 20

export default function TripHeaderMagazine({
  trip, isOwner, aiStatus, onAITap, onMenuTap, onBack, onPaxChange, onCollabTap, onDateAdjustTap,
}: TripHeaderViewProps) {
  const showAI = isOwner && !aiStatus
  const startDate = trip.days[0]?.date || trip.startDate
  const endDate = trip.days[trip.days.length - 1]?.date || trip.endDate
  const issueNo = String((trip._id || '').slice(-3).toUpperCase() || '000')

  return (
    <View className='thmg'>
      <View style={{ height: `${statusBarHeight}px` }} />
      <View className='thmg-topbar'>
        <View className='thmg-back' onClick={onBack}>
          <Text className='thmg-back-arrow'>←</Text>
          <Text className='thmg-back-text'>返回</Text>
        </View>
        <Text className='thmg-issueno'>VOL. {issueNo}</Text>
        <View className='thmg-menu' onClick={onMenuTap}>⋯</View>
      </View>

      <View className='thmg-rule thmg-rule-thick' />

      <View className='thmg-titleblock'>
        <Text className='thmg-name'>{trip.name}</Text>
        <View className='thmg-meta'>
          <Text>{startDate} → {endDate}</Text>
          <View className='thmg-date-edit' onClick={onDateAdjustTap}>
            <Icon name='calendar' size={14} color='var(--accent)' />
            <Text>日期</Text>
          </View>
          <Text>·</Text>
          <Text>{trip.days.length || 0} 天</Text>
          <Text>·</Text>
          <Picker
            mode='selector'
            range={PAX_OPTIONS}
            value={Math.max(0, Math.min(98, (trip.pax || 1) - 1))}
            onChange={(e) => {
              const next = Number(e.detail.value) + 1
              if (next !== trip.pax) onPaxChange(next)
            }}
          >
            <Text className='thmg-pax-edit'>{trip.pax} 人 ▾</Text>
          </Picker>
        </View>
        {showAI && (
          <View className='thmg-ai'>
            <AIBadge status='idle' size='compact' label='AI 规划' onClick={onAITap} />
          </View>
        )}
      </View>

      <View className='thmg-rule' />

      <CollaboratorsBar
        collaborators={trip.collaborators || []}
        ownerNickname={trip.ownerNickname}
        isOwner={isOwner}
        onTap={onCollabTap}
      />
    </View>
  )
}
