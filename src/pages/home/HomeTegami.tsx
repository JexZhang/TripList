import { useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import AvatarEntry from '../../components/AvatarEntry'
import TripPhaseChip from '../../components/TripPhaseChip'
import HomeCardAIRow from '../../components/HomeCardAIRow'
import AIGlowWrap from '../../components/AIGlowWrap'
import HomeCreateTiles from './HomeCreateTiles'
import HomeFeaturedRow from './HomeFeaturedRow'
import { fmtDateShort } from '../../utils/format'
import { tripSummary } from '../../utils/trip-helpers'
import { getTripPhase } from '../../utils/trip-phase'
import type { HomeViewProps } from './shared'
import { todayLabel } from './shared'
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
  trips, loading, openid, onOpenTrip, onLongPressTrip, onNewTrip, onAITrip,
  featuredTemplates, onOpenTemplate, onOpenLibrary,
}: HomeViewProps) {
  const colored = useMemo(() => trips.map((t, i) => ({
    ...t,
    _c1: COLORS[i % COLORS.length][0],
    _c2: COLORS[i % COLORS.length][1],
  })), [trips])

  return (
    <View className='ht'>
      {/* 顶部极简栏：左日期 + 右头像 */}
      <View className='ht-head'>
        <Text className='ht-date'>{todayLabel()}</Text>
        <AvatarEntry className='ht-avatar' />
      </View>

      {/* 创建台 */}
      <HomeCreateTiles onAITrip={onAITrip} onNewTrip={onNewTrip} />

      {/* 旅人精选 */}
      <HomeFeaturedRow templates={featuredTemplates} onOpenTemplate={onOpenTemplate} onOpenLibrary={onOpenLibrary} />

      {loading && <View className='ht-loading'>加载中…</View>}

      {/* 我的行程 */}
      <View className='ht-section'>
        <View className='ht-section-h'>
          <View className='ht-section-bar ht-section-bar--trips' />
          <Text className='ht-section-t'>我的行程</Text>
        </View>

        <View className='ht-stack'>
          {colored.map((t, i) => {
            const ai = aiStatusFor(t)
            const isCollab = t._openid !== openid
            const phase = getTripPhase(t.startDate, t.endDate)
            const isPost = phase === 'post'
            return (
              <AIGlowWrap key={t._id} active={ai === 'thinking'}>
              <View
                className={`ht-card ht-card-${i % 5} ${isPost ? 'ht-card--post' : ''}`}
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
                  {phase === 'live' && <TripPhaseChip trip={t} className='ht-card-phase' />}
                  <View className='ht-card-foot'>
                    {isCollab && <View className='ht-card-badge'>协作</View>}
                  </View>
                </View>
              </View>
              </AIGlowWrap>
            )
          })}
        </View>
      </View>
    </View>
  )
}
