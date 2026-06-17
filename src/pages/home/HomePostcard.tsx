import { View, Text } from '@tarojs/components'
import { useMemo } from 'react'
import BrandLogo from '../../components/BrandLogo'
import TripPhaseChip from '../../components/TripPhaseChip'
import AvatarEntry from '../../components/AvatarEntry'
import HomeAIBanner from '../../components/HomeAIBanner'
import HomeBottomCTA from '../../components/HomeBottomCTA'
import HomeArchiveSection from './HomeArchiveSection'
import HomeFeaturedRow from './HomeFeaturedRow'
import type { HomeViewProps } from './shared'
import type { Trip } from '../../types/trip'
import { getTripPhase } from '../../utils/trip-phase'
import './styles/home-postcard.scss'

/* ── 印泥色：取自各国护照印章真实墨色 ── */
const STAMP_COLORS = [
  '#1E4D8C', // 普鲁士蓝
  '#A83228', // 朱砂红
  '#2D6A3F', // 翡翠绿
  '#7B3FA0', // 龙胆紫
  '#B8651A', // 琥珀棕
  '#1A7A7A', // 孔雀青
]

type StampSize = 'sm' | 'md' | 'lg'
type StampShape = 'circle' | 'oval' | 'rect'

interface StampStyle {
  size: StampSize
  shape: StampShape
  rotate: number
}

function djb2(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function stampStyle(tripId: string, tripName: string): StampStyle {
  const h = djb2(tripId)
  const sizes: StampSize[] = ['sm', 'md', 'lg']
  const shapes: StampShape[] = ['circle', 'oval', 'rect']
  const longName = (tripName?.length ?? 0) > 8
  return {
    size: longName ? 'lg' : sizes[h % 3],
    shape: shapes[(h >> 2) % 3],
    rotate: ((h >> 5) % 7) - 3,
  }
}

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
  trips, archivedTrips, loading, onOpenTrip, onLongPressTrip, onNewTrip, onAITrip,
  featuredTemplates, onOpenTemplate, onOpenLibrary,
}: HomeViewProps) {
  const sized = useMemo(() => trips.map((t) => ({ ...t, _days: tripDays(t) })), [trips])
  const totalDays = sized.reduce((s, t) => s + t._days, 0)

  return (
    <View className='hpp'>
      {/* ═══ 护照封面 ═══ */}
      <View className='hpp-cover'>
        <View className='hpp-cover-guilloche' />

        <View className='hpp-cover-inner'>
          <View className='hpp-cover-top'>
            <Text className='hpp-cover-country'>XING CE</Text>
            <AvatarEntry className='hpp-avatar' />
          </View>

          <View className='hpp-cover-emblem'>
            <BrandLogo size='lg' />
          </View>

          <Text className='hpp-cover-type'>PASSPORT</Text>
          <Text className='hpp-cover-no'>No. XC-2026-{String(trips.length).padStart(4, '0')}</Text>
        </View>
      </View>

      <View className='hpp-ai-banner'>
        <HomeAIBanner onTap={onAITrip} />
      </View>

      <HomeFeaturedRow templates={featuredTemplates} onOpenTemplate={onOpenTemplate} onOpenLibrary={onOpenLibrary} />

      {loading && <View className='hpp-loading'>Stamping visas…</View>}

      {/* ═══ 签证页 ═══ */}
      <View className='hpp-page'>
        <View className='hpp-page-grid' />
        <Text className='hpp-page-watermark'>行册</Text>

        <View className='hpp-page-head'>
          <View className='hpp-page-head-left'>
            <Text className='hpp-page-head-label'>VISAS</Text>
            <Text className='hpp-page-head-sub'>签证页 · {trips.length} STAMPS</Text>
          </View>
          <View className='hpp-page-head-right'>
            <Text className='hpp-page-head-stat'>{totalDays}</Text>
            <Text className='hpp-page-head-unit'>DAYS</Text>
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
          {sized.map((t, i) => {
            const ai = aiStatusFor(t)
            const destFull = t.destinations.map((d) => d.name).join(' ')
            const st = stampStyle(t._id, t.name)
            const phase = getTripPhase(t.startDate, t.endDate)
            return (
              <View key={t._id}>
                <View
                  className={`hpp-stamp hpp-stamp--${st.size} hpp-stamp--${st.shape}`}
                  onClick={() => onOpenTrip(t)}
                  onLongPress={() => onLongPressTrip(t)}
                  style={{
                    '--stamp-color': STAMP_COLORS[i % STAMP_COLORS.length],
                    animationDelay: `${i * 80}ms`,
                    transform: `rotate(${st.rotate}deg)`,
                  } as React.CSSProperties}
                >
                  <View className='hpp-stamp-ring' />
                  <View className='hpp-stamp-face'>
                    <Text className='hpp-stamp-name'>{destFull || t.name}</Text>
                    <View className='hpp-stamp-rule' />
                    <Text className='hpp-stamp-date'>{t.startDate.slice(0, 7).replace('-', '.')}</Text>
                    <Text className='hpp-stamp-days'>{t._days} DAYS · {t.pax}P</Text>
                  </View>
                  {ai === 'thinking' && <View className='hpp-stamp-aiglow' />}
                  {ai === 'ready' && <View className='hpp-stamp-aibadge'>✓</View>}
                </View>
                {phase !== 'live' && <TripPhaseChip trip={t} className='hpp-card-phase' hidePre />}
              </View>
            )
          })}
        </View>

        <View className='hpp-page-foot'>
          <Text>— {trips.length} / ∞ —</Text>
        </View>
      </View>

      <HomeArchiveSection trips={archivedTrips} onOpenTrip={onOpenTrip} onLongPressTrip={onLongPressTrip} />

      <View className='hpp-cta'>
        <HomeBottomCTA onAITap={onAITrip} onNewTap={onNewTrip} newLabel='+ 新一页签证' />
      </View>
    </View>
  )
}
