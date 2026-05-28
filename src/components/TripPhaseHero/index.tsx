import { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import dayjs from 'dayjs'
import type { Trip } from '../../types/trip'
import {
  getTripPhase,
  getLiveContext,
  getPostStats,
  haversineKm,
  type LiveContext,
} from '../../utils/trip-phase'
import { useTripWeather } from '../../hooks/use-trip-weather'
import NavigationIcon from '../NavigationIcon'
import './index.scss'

interface Props {
  trip: Trip
}

export default function TripPhaseHero({ trip }: Props) {
  const [tick, setTick] = useState(0)
  const phase = useMemo(
    () => getTripPhase(trip.startDate, trip.endDate),
    [trip.startDate, trip.endDate, tick],
  )
  const weather = useTripWeather(trip, phase)

  useEffect(() => {
    if (phase !== 'live') return
    const t = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [phase])

  // pre 阶段(行程未开始)信息和 TripHeader 完全重复,直接不渲染,把首屏空间还给攻略。
  // live/post 阶段保留: 旅行中需要"NEXT 站/距离/天气", 归档后展示统计。
  if (phase === 'pre') return null

  return (
    <View className={`tph tph--${phase}`}>
      {phase === 'live' && <LiveBlock trip={trip} weather={weather.liveToday} />}
      {phase === 'post' && <PostBlock trip={trip} />}
    </View>
  )
}

function LiveBlock({
  trip,
  weather,
}: {
  trip: Trip
  weather?: { temp: number; desc: string; icon: string }
}) {
  const ctx = useMemo(() => getLiveContext(trip), [trip])
  const now = dayjs()
  const headline = liveHeadline(ctx)
  const cityLabel = trip.destinations?.[0]?.name || ''

  let distanceKm: number | null = null
  if (
    ctx.currentSpot?.lat &&
    ctx.currentSpot?.lng &&
    ctx.nextSpot?.lat &&
    ctx.nextSpot?.lng
  ) {
    distanceKm =
      Math.round(
        haversineKm(
          { lat: ctx.currentSpot.lat, lng: ctx.currentSpot.lng },
          { lat: ctx.nextSpot.lat, lng: ctx.nextSpot.lng },
        ) * 10,
      ) / 10
  }

  return (
    <View className='tph-live'>
      <View className='tph-live-head'>
        <View className='tph-live-dot' />
        <Text className='tph-live-tag'>LIVE</Text>
        <Text className='tph-live-time'>{now.format('HH:mm')}</Text>
        <Text className='tph-live-day'>{now.format('ddd').toUpperCase()}</Text>
      </View>

      <Text className='tph-live-title'>{headline.title}</Text>
      {headline.sub && <Text className='tph-live-sub'>{headline.sub}</Text>}

      {cityLabel && (
        <View className='tph-live-city'>
          <Text className='tph-live-city-rule'>─</Text>
          <Text>{cityLabel}</Text>
          {weather && (
            <>
              <Text className='tph-live-city-sep'>·</Text>
              <Text>{weather.temp}° {weather.desc}</Text>
            </>
          )}
          <Text className='tph-live-city-rule'>─</Text>
        </View>
      )}

      {ctx.nextSpot && (
        <View className='tph-live-next'>
          <View className='tph-live-next-head'>
            <View className='tph-live-next-head-left'>
              <Text className='tph-live-next-tag'>NEXT</Text>
              <Text className='tph-live-next-time'>{ctx.nextSpot.time || '--:--'}</Text>
            </View>
            {ctx.nextSpot.lat && ctx.nextSpot.lng && (
              <View
                className='tph-live-next-nav'
                onClick={(e) => {
                  e.stopPropagation()
                  Taro.openLocation({
                    latitude: ctx.nextSpot!.lat!,
                    longitude: ctx.nextSpot!.lng!,
                    name: ctx.nextSpot!.name,
                    scale: 15,
                  }).catch(() => {})
                }}
              >
                <NavigationIcon size={24} />
              </View>
            )}
          </View>
          <Text className='tph-live-next-name'>{ctx.nextSpot.name}</Text>
          {(distanceKm !== null || ctx.nextDay) && (
            <Text className='tph-live-next-meta'>
              {ctx.nextDay && `明日 · `}
              {distanceKm !== null ? `~${distanceKm} km` : ctx.nextDay ? '' : '—'}
            </Text>
          )}
        </View>
      )}
    </View>
  )
}

function liveHeadline(ctx: LiveContext): { title: string; sub?: string } {
  switch (ctx.status) {
    case 'in-progress':
      return { title: ctx.currentSpot?.name ?? '行程中', sub: ctx.currentSpot?.time }
    case 'before-first':
      return { title: '今日尚未开始', sub: '稍后将开启首站' }
    case 'after-last':
      return { title: '今日已收官', sub: ctx.nextDay ? '明日继续' : undefined }
    case 'rest-day':
      return { title: '今日休整日', sub: '为后续蓄力' }
    case 'no-day':
      return { title: '行程进行中' }
  }
}

function PostBlock({ trip }: { trip: Trip }) {
  const { days, spotsCount, totalCost } = getPostStats(trip)
  const filedAt = dayjs(trip.endDate).format('YYYY.MM.DD')
  return (
    <View className='tph-post'>
      <View className='tph-post-head'>
        <Text className='tph-post-mark'>○</Text>
        <Text className='tph-post-tag'>ARCHIVED</Text>
        <Text className='tph-post-sep'>·</Text>
        <Text className='tph-post-title'>{trip.name}</Text>
      </View>

      <View className='tph-post-grid'>
        <PostStat v={`${days}`} l='DAYS' delay={0} />
        <PostStat v={`${spotsCount}`} l='SPOTS' delay={80} />
        <PostStat v={`¥${formatCost(totalCost)}`} l='TOTAL' delay={160} />
      </View>

      <View className='tph-rule' />
      <Text className='tph-post-filed'>FILED · {filedAt}</Text>
    </View>
  )
}

function PostStat({ v, l, delay }: { v: string; l: string; delay: number }) {
  return (
    <View className='tph-post-stat' style={{ animationDelay: `${delay}ms` }}>
      <Text className='tph-post-stat-v'>{v}</Text>
      <Text className='tph-post-stat-l'>{l}</Text>
    </View>
  )
}

function formatCost(n: number): string {
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}
