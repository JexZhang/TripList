import { View, Text } from '@tarojs/components'
import BrandLogo from '../../components/BrandLogo'
import AvatarEntry from '../../components/AvatarEntry'
import HomeBottomCTA from '../../components/HomeBottomCTA'
import HomeCardAIRow from '../../components/HomeCardAIRow'
import type { HomeViewProps } from './shared'
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
  trips, loading, openid, onOpenTrip, onLongPressTrip, onNewTrip, onAITrip,
}: HomeViewProps) {
  const totalDays = trips.reduce((s, t) => s + tripDays(t), 0)

  return (
    <View className='hmin'>
      <View className='hmin-head'>
        <View className='hmin-top'>
          <Text className='hmin-eyebrow'>CHRONICLE</Text>
          <AvatarEntry className='hmin-avatar' />
        </View>
        <BrandLogo size='lg' />
        <View className='hmin-stats'>
          <View className='hmin-stat'>
            <Text className='hmin-stat-v'>{trips.length}</Text>
            <Text className='hmin-stat-l'>段</Text>
          </View>
          <View className='hmin-stat'>
            <Text className='hmin-stat-v'>{totalDays}</Text>
            <Text className='hmin-stat-l'>天</Text>
          </View>
        </View>
      </View>

      {loading && <View className='hmin-loading'>加载中…</View>}

      <View className='hmin-list'>
        {trips.map((t, i) => {
          const ai = aiStatusFor(t)
          return (
            <View
              key={t._id}
              className='hmin-row'
              onClick={() => onOpenTrip(t)}
              onLongPress={() => onLongPressTrip(t)}
            >
              <Text className='hmin-row-no'>{String(i + 1).padStart(2, '0')}</Text>
              <View className='hmin-row-body'>
                <View className='hmin-row-top'>
                  <Text className='hmin-row-name'>{t.name}</Text>
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

      <View className='hmin-cta'>
        <HomeBottomCTA onAITap={onAITrip} onNewTap={onNewTrip} newLabel='+ 新建' />
      </View>
    </View>
  )
}
