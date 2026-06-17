import { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import type { Trip } from '../../types/trip'
import {
  getTripPhase,
  getDaysUntilStart,
  getLiveContext,
  getPostStats,
} from '../../utils/trip-phase'
import './index.scss'

interface Props {
  trip: Trip
  className?: string
  hidePre?: boolean
}

export default function TripPhaseChip({ trip, className, hidePre }: Props) {
  const [tick, setTick] = useState(0)
  const phase = useMemo(
    () => getTripPhase(trip.startDate, trip.endDate),
    [trip.startDate, trip.endDate],
  )

  useEffect(() => {
    if (phase !== 'live') return
    const t = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [phase])

  if (phase === 'pre' && hidePre) return null
  if (phase === 'pre') return <PreChip trip={trip} className={className} />
  if (phase === 'live') return <LiveChip trip={trip} className={className} />
  return <PostChip trip={trip} className={className} />
}

function PreChip({ trip, className }: { trip: Trip; className?: string }) {
  const days = getDaysUntilStart(trip.startDate)
  const destLabel =
    trip.destinations?.[0]?.name || '远方'
  return (
    <View className={`tpc tpc--pre ${className || ''}`}>
      <Text className='tpc-pre-d'>D</Text>
      <Text className='tpc-pre-num'>−{days}</Text>
      <Text className='tpc-pre-rule'>/</Text>
      <Text className='tpc-pre-dest'>{destLabel}</Text>
    </View>
  )
}

function LiveChip({ trip, className }: { trip: Trip; className?: string }) {
  const ctx = useMemo(() => getLiveContext(trip), [trip])
  const label = liveChipLabel(ctx)
  return (
    <View className={`tpc tpc--live ${className || ''}`}>
      <View className='tpc-live-dot' />
      <Text className='tpc-live-tag'>进行中</Text>
      <Text className='tpc-live-sep'>·</Text>
      <Text className='tpc-live-name'>{label}</Text>
    </View>
  )
}

function liveChipLabel(ctx: ReturnType<typeof getLiveContext>): string {
  switch (ctx.status) {
    case 'before-first':
      return `今日 ${ctx.nextSpot?.time ?? ''} ${ctx.nextSpot?.name ?? ''}`.trim()
    case 'in-progress':
      return ctx.currentSpot?.name ?? '行程中'
    case 'after-last':
      return ctx.nextSpot ? `今日收官 · 明日 ${ctx.nextSpot.name}` : '今日收官'
    case 'rest-day':
      return '今日休整'
    case 'no-day':
      return '行程中'
  }
}

function PostChip({ trip, className }: { trip: Trip; className?: string }) {
  const { days, spotsCount, totalCost } = getPostStats(trip)
  return (
    <View className={`tpc tpc--post ${className || ''}`}>
      <View className='tpc-post-mark' />
      <Text className='tpc-post-tag'>已归档</Text>
      <Text className='tpc-post-sep'>·</Text>
      <Text className='tpc-post-v'>{days}</Text>
      <Text className='tpc-post-l'>天</Text>
      <Text className='tpc-post-sep'>·</Text>
      <Text className='tpc-post-v'>{spotsCount}</Text>
      <Text className='tpc-post-l'>地点</Text>
      <Text className='tpc-post-sep'>·</Text>
      <Text className='tpc-post-v'>¥{totalCost.toLocaleString()}</Text>
    </View>
  )
}
