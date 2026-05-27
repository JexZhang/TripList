import { View, Text } from '@tarojs/components'
import { useMemo } from 'react'
import BrandLogo from '../../components/BrandLogo'
import AvatarEntry from '../../components/AvatarEntry'
import HomeBottomCTA from '../../components/HomeBottomCTA'
import HomeCardAIRow from '../../components/HomeCardAIRow'
import type { HomeViewProps } from './shared'
import type { Trip } from '../../types/trip'
import './styles/home-postcard.scss'

const STAMP_COLORS = [
  '#2E5AAC', // 蓝
  '#C43D3D', // 红
  '#3A7D5C', // 绿
  '#8B5CF6', // 紫
  '#D97706', // 橙棕
  '#0E7490', // 青
]

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
}: HomeViewProps) {
  const sized = useMemo(() => trips.map((t) => {
    const d = tripDays(t)
    return { ...t, _scale: Math.min(1.0, Math.max(0.62, 0.5 + d * 0.06)), _days: d }
  }), [trips])

  const totalDays = sized.reduce((s, t) => s + t._days, 0)

  return (
    <View className='hpp'>
      <View className='hpp-cover'>
        <View className='hpp-cover-top'>
          <Text className='hpp-cover-lab'>XING CE · PASSPORT</Text>
          <AvatarEntry className='hpp-avatar' />
        </View>
        <BrandLogo size='lg' />
        <View className='hpp-cover-no'>
          <Text>No. XC · 2026 · 0012</Text>
          <Text>· {trips.length} VISAS</Text>
        </View>
      </View>

      {loading && <View className='hpp-loading'>加载中…</View>}

      <View className='hpp-page'>
        <View className='hpp-page-head'>
          <Text className='hpp-page-l'>VISA / 签 证 · 已盖 {trips.length} 枚</Text>
          <Text className='hpp-page-r'>{totalDays} 天</Text>
        </View>

        <View className='hpp-stamps'>
          {sized.map((t, i) => {
            const ai = aiStatusFor(t)
            const destFull = t.destinations.map((d) => d.name).join(' ')
            const size = 184 * t._scale
            return (
              <View
                key={t._id}
                className='hpp-stamp-wrap'
              >
                <View
                  className='hpp-stamp'
                  onClick={() => onOpenTrip(t)}
                  onLongPress={() => onLongPressTrip(t)}
                  style={{
                    width: `${size}rpx`,
                    height: `${size}rpx`,
                    '--stamp-color': STAMP_COLORS[i % STAMP_COLORS.length],
                    animationDelay: `${i * 60}ms`,
                  } as React.CSSProperties}
                >
                  <Text className='hpp-stamp-name'>{destFull || t.name}</Text>
                  <View className='hpp-stamp-divider' />
                  <Text className='hpp-stamp-date'>{t.startDate.slice(0, 7).replace('-', '.')}</Text>
                  <Text className='hpp-stamp-days'>{t._days} DAYS · {t.pax}P</Text>
                  {ai === 'thinking' && <View className='hpp-stamp-aiglow' />}
                  {ai === 'ready' && <View className='hpp-stamp-airready'>✓</View>}
                </View>
                {ai && (
                  <HomeCardAIRow
                    status={ai}
                    onTap={() => onOpenTrip(t)}
                  />
                )}
              </View>
            )
          })}
        </View>

        <Text className='hpp-watermark'>行册</Text>
      </View>

      <View className='hpp-cta'>
        <HomeBottomCTA onAITap={onAITrip} onNewTap={onNewTrip} newLabel='+ 新一页签证' />
      </View>
    </View>
  )
}
