import { View, Text, Picker } from '@tarojs/components'
import AIBadge from '../../components/AIBadge'
import AILoadingBar from '../../components/AILoadingBar'
import CollaboratorsBar from '../../components/CollaboratorsBar'
import type { TripHeaderViewProps } from './shared-header'
import './styles/header-postcard.scss'

const PAX_OPTIONS = Array.from({ length: 99 }, (_, i) => `${i + 1} 人`)

export default function TripHeaderPostcard({
  trip, isOwner, aiStatus, onAITap, onAIBarTap, onMenuTap, onBack, onPaxChange, onCollabTap,
}: TripHeaderViewProps) {
  const showAI = isOwner && !aiStatus
  const startDate = trip.days[0]?.date || trip.startDate
  const endDate = trip.days[trip.days.length - 1]?.date || trip.endDate
  const destShort = (trip.destinations?.[0]?.name) || ''

  return (
    <View className='thpp'>
      <View className='thpp-paper'>
        <View className='thpp-paper-grain' />

        <View className='thpp-topbar'>
          <View className='thpp-back' onClick={onBack}>‹</View>
          <Text className='thpp-eyebrow'>VISA / 签 证</Text>
          <View className='thpp-menu' onClick={onMenuTap}>⋯</View>
        </View>

        <View className='thpp-body'>
          <View className='thpp-titleblock'>
            <Text className='thpp-name'>{trip.name}</Text>
            <View className='thpp-meta-grid'>
              <View className='thpp-meta-row'>
                <Text className='thpp-meta-l'>FROM</Text>
                <Text className='thpp-meta-v'>{startDate}</Text>
              </View>
              <View className='thpp-meta-row'>
                <Text className='thpp-meta-l'>TO</Text>
                <Text className='thpp-meta-v'>{endDate}</Text>
              </View>
              <View className='thpp-meta-row'>
                <Text className='thpp-meta-l'>DAYS</Text>
                <Text className='thpp-meta-v'>{trip.days.length || 0}</Text>
              </View>
              <View className='thpp-meta-row'>
                <Text className='thpp-meta-l'>PAX</Text>
                <Picker
                  mode='selector'
                  range={PAX_OPTIONS}
                  value={Math.max(0, Math.min(98, (trip.pax || 1) - 1))}
                  onChange={(e) => {
                    const next = Number(e.detail.value) + 1
                    if (next !== trip.pax) onPaxChange(next)
                  }}
                >
                  <Text className='thpp-meta-v thpp-meta-edit'>{trip.pax} ▾</Text>
                </Picker>
              </View>
            </View>
          </View>

          <View className='thpp-stamp'>
            <Text className='thpp-stamp-l1'>已入境</Text>
            <Text className='thpp-stamp-l2'>{destShort.toUpperCase()}</Text>
            <Text className='thpp-stamp-l3'>XC · 2026</Text>
          </View>
        </View>

        {showAI && (
          <View className='thpp-ai'>
            <AIBadge status='idle' size='compact' label='✦ AI 规划' onClick={onAITap} />
          </View>
        )}
      </View>

      {isOwner && aiStatus && (
        <View className='thpp-ai-bar'>
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
