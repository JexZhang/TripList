import { View, Text, Picker } from '@tarojs/components'
import AIBadge from '../../components/AIBadge'
import CollaboratorsBar from '../../components/CollaboratorsBar'
import type { TripHeaderViewProps } from './shared-header'
import './styles/header-minimal.scss'

const PAX_OPTIONS = Array.from({ length: 99 }, (_, i) => `${i + 1} 人`)

export default function TripHeaderMinimal({
  trip, isOwner, aiStatus, onAITap, onMenuTap, onBack, onPaxChange, onCollabTap,
}: TripHeaderViewProps) {
  const showAI = isOwner && !aiStatus
  const startDate = trip.days[0]?.date || trip.startDate
  const endDate = trip.days[trip.days.length - 1]?.date || trip.endDate

  return (
    <View className='thmin'>
      <View className='thmin-bar'>
        <View className='thmin-back' onClick={onBack}>‹</View>
        <View className='thmin-menu' onClick={onMenuTap}>⋯</View>
      </View>

      <Text className='thmin-eyebrow'>CHRONICLE</Text>
      <Text className='thmin-name'>{trip.name}</Text>

      <View className='thmin-meta'>
        <Text>{startDate} → {endDate}</Text>
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
          <Text className='thmin-pax-edit'>{trip.pax} 人 ▾</Text>
        </Picker>
      </View>

      {showAI && (
        <View className='thmin-ai'>
          <AIBadge status='idle' size='compact' label='AI 规划' onClick={onAITap} />
        </View>
      )}

      <View className='thmin-rule' />

      <CollaboratorsBar
        collaborators={trip.collaborators || []}
        ownerNickname={trip.ownerNickname}
        isOwner={isOwner}
        onTap={onCollabTap}
      />
    </View>
  )
}
