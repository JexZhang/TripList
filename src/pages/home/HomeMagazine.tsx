import { View, Text } from '@tarojs/components'
import BrandLogo from '../../components/BrandLogo'
import AvatarEntry from '../../components/AvatarEntry'
import HomeBottomCTA from '../../components/HomeBottomCTA'
import HomeCardAIRow from '../../components/HomeCardAIRow'
import MagFeatureCover from '../../components/MagFeatureCover'
import type { HomeViewProps } from './shared'
import type { Trip } from '../../types/trip'
import './styles/home-magazine.scss'

function aiStatusFor(t: Trip): 'thinking' | 'ready' | 'error' | null {
  if (t.aiStatus === 'generating') return 'thinking'
  if (t.aiStatus === 'ready') return 'ready'
  if (t.aiStatus === 'error') return 'error'
  return null
}

export default function HomeMagazine({
  trips, loading, onOpenTrip, onLongPressTrip,
  onNewTrip, onAITrip, onCoverLongPress,
}: HomeViewProps) {
  const featured = trips[0]
  const rest = trips.slice(1)
  const featAI = featured ? aiStatusFor(featured) : null
  const destFull = featured?.destinations?.map((d) => d.name).join(' · ') || ''
  const days = featured ? computeDays(featured.startDate, featured.endDate) : 0

  return (
    <View className='hm'>
      <View className='hm-masthead'>
        <View className='hm-top'>
          <Text className='hm-issueno'>VOL. 012</Text>
          <AvatarEntry className='hm-avatar' />
        </View>
        <View className='hm-title-row'>
          <BrandLogo size='lg' />
          <View className='hm-meta-stack'>
            <Text className='hm-meta'>2026 · 春</Text>
            <Text className='hm-meta'>{trips.length} 段旅程</Text>
          </View>
        </View>
        <View className='hm-rule' />
        <Text className='hm-strap'>EDITORIAL · TRAVEL · PERSONAL</Text>
      </View>

      {loading && <View className='hm-loading'>加载中…</View>}

      {featured && (
        <View
          className='hm-feature'
          onClick={() => onOpenTrip(featured)}
          onLongPress={() => onLongPressTrip(featured)}
        >
          {featAI && <HomeCardAIRow status={featAI} />}
          <Text className='hm-feature-tag'>本期封面 / COVER STORY</Text>
          <Text className='hm-feature-title'>{featured.name}</Text>
          <Text className='hm-feature-deck'>
            {destFull} · {featured.pax} 人 · {days} 天行程
          </Text>
          <MagFeatureCover
            trip={featured}
            onLongPress={() => onCoverLongPress?.(featured)}
          />
          <View className='hm-feature-foot'>
            <Text>P. 01 — P. 28</Text>
            <Text>→ 翻开</Text>
          </View>
        </View>
      )}

      {rest.length > 0 && (
        <View className='hm-index'>
          <View className='hm-index-head'>
            <Text>本期目录</Text>
            <Text>INDEX</Text>
          </View>
          {rest.map((t, i) => (
            <View
              key={t._id}
              className='hm-index-row'
              onClick={() => onOpenTrip(t)}
              onLongPress={() => onLongPressTrip(t)}
            >
              <Text className='hm-index-no'>P. {String(i + 2).padStart(2, '0')}</Text>
              <Text className='hm-index-name'>{t.name}</Text>
              <View className='hm-index-dots' />
              <Text className='hm-index-date'>{t.startDate.slice(0, 7)}</Text>
            </View>
          ))}
        </View>
      )}

      <View className='hm-cta'>
        <HomeBottomCTA onAITap={onAITrip} onNewTap={onNewTrip} newLabel='+ 发起新刊' />
      </View>
    </View>
  )
}

function computeDays(s: string, e: string): number {
  return Math.max(1, Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000) + 1)
}
