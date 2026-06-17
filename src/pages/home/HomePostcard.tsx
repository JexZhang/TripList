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
import './styles/home-postcard.scss'

function aiStatusFor(t: Trip): 'thinking' | 'ready' | 'error' | null {
  if (t.aiStatus === 'generating') return 'thinking'
  if (t.aiStatus === 'ready') return 'ready'
  if (t.aiStatus === 'error') return 'error'
  return null
}

function tripDays(t: Trip): number {
  return Math.max(1, Math.round((new Date(t.endDate).getTime() - new Date(t.startDate).getTime()) / 86400000) + 1)
}

export default function HomePostcard({
  trips, loading, onOpenTrip, onLongPressTrip, onNewTrip, onAITrip,
  featuredTemplates, onOpenTemplate, onOpenLibrary,
}: HomeViewProps) {
  const totalDays = trips.reduce((s, t) => s + tripDays(t), 0)

  return (
    <View className='hpp'>
      {/* 顶部极简栏 */}
      <View className='hpp-head'>
        <Text className='hpp-date'>{todayLabel()}</Text>
        <AvatarEntry className='hpp-avatar' />
      </View>

      {/* 创建台 */}
      <HomeCreateTiles onAITrip={onAITrip} onNewTrip={onNewTrip} />

      {/* 旅人精选 */}
      <HomeFeaturedRow templates={featuredTemplates} onOpenTemplate={onOpenTemplate} onOpenLibrary={onOpenLibrary} />

      {loading && <View className='hpp-loading'>整理签证中…</View>}

      {/* 我的行程 — 签证页风格 */}
      <View className='hpp-page'>
        <View className='hpp-page-grid' />
        <Text className='hpp-page-watermark'>行册</Text>

        <View className='hpp-page-head'>
          <View className='hpp-page-head-left'>
            <Text className='hpp-page-head-label'>VISAS</Text>
            <Text className='hpp-page-head-sub'>签证页 · {trips.length} 枚</Text>
          </View>
          <View className='hpp-page-head-right'>
            <Text className='hpp-page-head-stat'>{totalDays}</Text>
            <Text className='hpp-page-head-unit'>天</Text>
          </View>
        </View>

        {trips.length === 0 && !loading && (
          <View className='hpp-empty'>
            <Text className='hpp-empty-icon'>○</Text>
            <Text className='hpp-empty-text'>尚无签证</Text>
            <Text className='hpp-empty-hint'>创建第一个旅行，盖上第一枚印章</Text>
          </View>
        )}

        <View className='hpp-stamps'>
          {trips.map((t) => {
            const ai = aiStatusFor(t)
            const phase = getTripPhase(t.startDate, t.endDate)
            const isPost = phase === 'post'
            return (
              <AIGlowWrap key={t._id} active={ai === 'thinking'}>
              <View
                className={`hpp-card ${isPost ? 'hpp-card--post' : ''}`}
                onClick={() => onOpenTrip(t)}
                onLongPress={() => onLongPressTrip(t)}
              >
                <View className='hpp-card-body'>
                  {ai && <HomeCardAIRow status={ai} />}
                  <Text className='hpp-card-meta'>
                    {fmtDateShort(t.startDate)} → {fmtDateShort(t.endDate)} · {tripSummary(t.startDate, t.endDate, t.pax)}
                  </Text>
                  <Text className='hpp-card-name'>{t.name}</Text>
                  {phase === 'live' && <TripPhaseChip trip={t} className='hpp-card-phase' />}
                </View>
              </View>
              </AIGlowWrap>
            )
          })}
        </View>

        <View className='hpp-page-foot'>
          <Text>— {trips.length} / ∞ —</Text>
        </View>
      </View>
    </View>
  )
}
