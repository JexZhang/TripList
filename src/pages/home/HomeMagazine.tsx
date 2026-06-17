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
import './styles/home-magazine.scss'

function aiStatusFor(t: Trip): 'thinking' | 'ready' | 'error' | null {
  if (t.aiStatus === 'generating') return 'thinking'
  if (t.aiStatus === 'ready') return 'ready'
  if (t.aiStatus === 'error') return 'error'
  return null
}

export default function HomeMagazine({
  trips, loading, onOpenTrip, onLongPressTrip, onNewTrip, onAITrip,
  featuredTemplates, onOpenTemplate, onOpenLibrary,
}: HomeViewProps) {
  return (
    <View className='hm'>
      {/* 顶部极简栏 */}
      <View className='hm-head'>
        <Text className='hm-date'>{todayLabel()}</Text>
        <AvatarEntry className='hm-avatar' />
      </View>

      {/* 创建台 */}
      <HomeCreateTiles onAITrip={onAITrip} onNewTrip={onNewTrip} />

      {/* 旅人精选 */}
      <HomeFeaturedRow templates={featuredTemplates} onOpenTemplate={onOpenTemplate} onOpenLibrary={onOpenLibrary} />

      {loading && <View className='hm-loading'>加载中…</View>}

      {/* 我的行程 */}
      <View className='hm-section'>
        <View className='hm-section-h'>
          <Text className='hm-section-t'>我的行程</Text>
          <Text className='hm-section-sub'>MY TRIPS</Text>
        </View>

        <View className='hm-list'>
          {trips.map((t, i) => {
            const ai = aiStatusFor(t)
            const phase = getTripPhase(t.startDate, t.endDate)
            const isPost = phase === 'post'
            return (
              <AIGlowWrap key={t._id} active={ai === 'thinking'} className='aiglow--row'>
              <View
                className={`hm-row ${isPost ? 'hm-row--post' : ''}`}
                onClick={() => onOpenTrip(t)}
                onLongPress={() => onLongPressTrip(t)}
              >
                <Text className='hm-row-no'>{String(i + 1).padStart(2, '0')}</Text>
                <View className='hm-row-body'>
                  <View className='hm-row-top'>
                    <Text className='hm-row-name'>{t.name}</Text>
                    {phase === 'live' && <TripPhaseChip trip={t} className='hm-row-phase' />}
                  </View>
                  <Text className='hm-row-meta'>
                    {fmtDateShort(t.startDate)} → {fmtDateShort(t.endDate)} · {tripSummary(t.startDate, t.endDate, t.pax)}
                  </Text>
                  {ai && <HomeCardAIRow status={ai} />}
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
