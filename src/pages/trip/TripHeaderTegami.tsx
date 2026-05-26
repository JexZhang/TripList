import { View, Text, Picker } from '@tarojs/components'
import AIBadge from '../../components/AIBadge'
import AILoadingBar from '../../components/AILoadingBar'
import CollaboratorsBar from '../../components/CollaboratorsBar'
import type { TripHeaderViewProps } from './shared-header'
import './styles/header-tegami.scss'

const PAX_OPTIONS = Array.from({ length: 99 }, (_, i) => `${i + 1} 人`)

export default function TripHeaderTegami({
  trip, isOwner, aiStatus, onAITap, onAIBarTap, onMenuTap, onBack, onPaxChange, onCollabTap,
}: TripHeaderViewProps) {
  const showAI = isOwner && !aiStatus
  const startDate = trip.days[0]?.date || trip.startDate
  const endDate = trip.days[trip.days.length - 1]?.date || trip.endDate

  return (
    <View className='thtg'>
      <View className='thtg-bar'>
        <View className='thtg-back' onClick={onBack}>‹</View>
        <Text className='thtg-issue'>HANDWRITTEN · 2026</Text>
        <View className='thtg-menu' onClick={onMenuTap}>⋯</View>
      </View>

      <View className='thtg-hero'>
        <View className='thtg-hero-bg' />
        <View className='thtg-hero-body'>
          <Text className='thtg-name'>{trip.name}</Text>
          <View className='thtg-meta'>
            <Text>{startDate} → {endDate}</Text>
            <Text className='thtg-dot'>·</Text>
            <Text>{trip.days.length || 0} 天</Text>
            <Text className='thtg-dot'>·</Text>
            <Picker
              mode='selector'
              range={PAX_OPTIONS}
              value={Math.max(0, Math.min(98, (trip.pax || 1) - 1))}
              onChange={(e) => {
                const next = Number(e.detail.value) + 1
                if (next !== trip.pax) onPaxChange(next)
              }}
            >
              <Text className='thtg-pax-edit'>{trip.pax} 人 ▾</Text>
            </Picker>
          </View>
        </View>
        {showAI && (
          <View className='thtg-ai'>
            <AIBadge status='idle' size='compact' label='AI 规划' onClick={onAITap} />
          </View>
        )}
      </View>

      {isOwner && aiStatus && (
        <View className='thtg-ai-bar'>
          <AILoadingBar
            status={aiStatus as 'generating' | 'ready' | 'error'}
            onTap={onAIBarTap}
          />
        </View>
      )}

      <CollaboratorsBar
        collaborators={trip.collaborators || []}
        ownerNickname={trip.ownerNickname}
        isOwner={isOwner}
        onTap={onCollabTap}
      />
    </View>
  )
}
