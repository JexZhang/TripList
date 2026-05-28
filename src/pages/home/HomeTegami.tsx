import { View, Text } from '@tarojs/components'
import { useMemo } from 'react'
import BrandLogo from '../../components/BrandLogo'
import TripPhaseChip from '../../components/TripPhaseChip'
import AvatarEntry from '../../components/AvatarEntry'
import HomeBottomCTA from '../../components/HomeBottomCTA'
import HomeArchiveSection from './HomeArchiveSection'
import HomeCardAIRow from '../../components/HomeCardAIRow'
import { isSeedTripId } from '../../data/seed-trips'
import { fmtDateShort } from '../../utils/format'
import { tripSummary } from '../../utils/trip-helpers'
import type { HomeViewProps } from './shared'
import type { Trip } from '../../types/trip'
import './styles/home-tegami.scss'

const COLORS: ReadonlyArray<[string, string]> = [
  ['#FF7A2E', '#FF9A4D'],
  ['#6B46C1', '#FF5B5B'],
  ['#4FB286', '#FFC247'],
  ['#FFC247', '#FF7A2E'],
]

function aiStatusFor(t: Trip): 'thinking' | 'ready' | 'error' | null {
  if (t.aiStatus === 'generating') return 'thinking'
  if (t.aiStatus === 'ready') return 'ready'
  if (t.aiStatus === 'error') return 'error'
  return null
}

export default function HomeTegami({
  trips, archivedTrips, loading, openid, onOpenTrip, onLongPressTrip, onNewTrip, onAITrip,
}: HomeViewProps) {
  const sized = useMemo(() => trips.map((t, i) => ({
    ...t,
    _c1: COLORS[i % COLORS.length][0],
    _c2: COLORS[i % COLORS.length][1],
  })), [trips])

  return (
    <View className='ht'>
      <View className='ht-head'>
        <View className='ht-issue'>行册 · No. 012 · 2026 春</View>
        <View className='ht-head-row'>
          <BrandLogo size='lg' />
          <AvatarEntry className='ht-avatar' />
        </View>
        <Text className='ht-tag'>你的旅行，值得被好好记录</Text>
      </View>

      {loading && <View className='ht-loading'>加载中…</View>}

      <View className='ht-stack'>
        {sized.map((t, i) => {
          const ai = aiStatusFor(t)
          const isCollab = t._openid !== openid && !isSeedTripId(t._id)
          const isSeed = isSeedTripId(t._id)
          return (
            <View
              key={t._id}
              className={`ht-card ht-card-${i % 5}`}
              onClick={() => onOpenTrip(t)}
              onLongPress={() => onLongPressTrip(t)}
              style={{
                '--c1': t._c1, '--c2': t._c2,
                animationDelay: `${i * 80}ms`,
              } as React.CSSProperties}
            >
              <View className='ht-card-edge' />
              <View className='ht-card-body'>
                {ai && <HomeCardAIRow status={ai} />}
                <Text className='ht-card-meta'>
                  {fmtDateShort(t.startDate)} → {fmtDateShort(t.endDate)} · {tripSummary(t.startDate, t.endDate, t.pax)}
                </Text>
                <Text className='ht-card-name'>{t.name}</Text>
                <TripPhaseChip trip={t} className='ht-card-phase' hidePre />
                <View className='ht-card-foot'>
                  {isSeed && <View className='ht-card-badge ht-card-badge-seed'>示例</View>}
                  {isCollab && <View className='ht-card-badge'>协作</View>}
                </View>
              </View>
            </View>
          )
        })}
      </View>

      <HomeArchiveSection trips={archivedTrips} onOpenTrip={onOpenTrip} onLongPressTrip={onLongPressTrip} />

      <View className='ht-cta'>
        <HomeBottomCTA onAITap={onAITrip} onNewTap={onNewTrip} newLabel='+ 新建明信片' />
      </View>
    </View>
  )
}
