import { View, Text } from '@tarojs/components'
import AvatarEntry from '../../components/AvatarEntry'
import TripPhaseChip from '../../components/TripPhaseChip'
import HomeCardAIRow from '../../components/HomeCardAIRow'
import HomeCreateTiles from './HomeCreateTiles'
import HomeFeaturedRow from './HomeFeaturedRow'
import { getTripPhase } from '../../utils/trip-phase'
import type { HomeViewProps } from './shared'
import { todayLabel } from './shared'
import type { Trip } from '../../types/trip'
import './styles/home-minimal.scss'

function aiStatusFor(t: Trip): 'thinking' | 'ready' | 'error' | null {
  if (t.aiStatus === 'generating') return 'thinking'
  if (t.aiStatus === 'ready') return 'ready'
  if (t.aiStatus === 'error') return 'error'
  return null
}

function tripDays(t: Trip): number {
  return Math.max(1, Math.round((new Date(t.endDate).getTime() - new Date(t.startDate).getTime()) / 86400000) + 1)
}

export default function HomeMinimal({
  trips, loading, onOpenTrip, onLongPressTrip, onNewTrip, onAITrip,
  featuredTemplates, onOpenTemplate, onOpenLibrary,
}: HomeViewProps) {
  return (
    <View className='hmin'>
      {/* 顶部极简栏 */}
      <View className='hmin-head'>
        <Text className='hmin-date'>{todayLabel()}</Text>
        <AvatarEntry className='hmin-avatar' />
      </View>

      {/* 创建台 */}
      <HomeCreateTiles onAITrip={onAITrip} onNewTrip={onNewTrip} />

      {/* 旅人精选 */}
      <HomeFeaturedRow templates={featuredTemplates} onOpenTemplate={onOpenTemplate} onOpenLibrary={onOpenLibrary} />

      {loading && <View className='hmin-loading'>加载中…</View>}

      {/* 我的行程 */}
      <View className='hmin-section'>
        <View className='hmin-section-h'>
          <View className='hmin-section-bar' />
          <Text className='hmin-section-t'>我的行程</Text>
        </View>

        <View className='hmin-list'>
          {trips.map((t, i) => {
            const ai = aiStatusFor(t)
            const phase = getTripPhase(t.startDate, t.endDate)
            const isPost = phase === 'post'
            return (
              <View
                key={t._id}
                className={`hmin-row ${isPost ? 'hmin-row--post' : ''}`}
                onClick={() => onOpenTrip(t)}
                onLongPress={() => onLongPressTrip(t)}
              >
                <Text className='hmin-row-no'>{String(i + 1).padStart(2, '0')}</Text>
                <View className='hmin-row-body'>
                  <View className='hmin-row-top'>
                    <Text className='hmin-row-name'>{t.name}</Text>
                    {phase === 'live' && <TripPhaseChip trip={t} className='hmin-phase' />}
                    <Text className='hmin-row-arrow'>›</Text>
                  </View>
                  <View className='hmin-row-meta'>
                    <Text>{t.startDate.replace(/-/g, '.')} → {t.endDate.slice(5).replace('-', '.')}</Text>
                    <Text>·</Text>
                    <Text>{t.pax} 人 · {tripDays(t)} 天</Text>
                  </View>
                  {ai && <HomeCardAIRow status={ai} />}
                </View>
              </View>
            )
          })}
        </View>
      </View>
    </View>
  )
}
