import { useEffect, useMemo, useRef, useState } from 'react'
import { Map, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTripStore } from '../../store/trip-store'
import ModeBar, { type MapMode } from './ModeBar'
import SpotMapSheet from './SpotMapSheet'
import { collectLocated, dayColor, encodeMarkerId, decodeMarkerId } from './helpers'
import type { Spot } from '../../types/trip'
import './index.scss'

const MAP_ID = 'trip-map'

export default function MapView() {
  const { state } = useTripStore()
  const trip = state.trip!
  const [mode, setMode] = useState<MapMode>('all')
  const [picked, setPicked] = useState<Spot | null>(null)
  const ctxRef = useRef<ReturnType<typeof Taro.createMapContext> | null>(null)

  const located = useMemo(() => {
    if (mode === 'all') return collectLocated(trip.days)
    return collectLocated(trip.days, mode)
  }, [trip.days, mode])

  // weapp 要求 markers 的 id 为整数,callout 显示数字
  const markers = useMemo(() => {
    return located.map((p) => {
      // 单日模式:数字 = 当日序号(spotIdx+1,从 1 起)
      // 全部模式:数字 = day 序号(dayIdx+1)
      const label = mode === 'all' ? p.dayIdx + 1 : p.spotIdx + 1
      const color = dayColor(p.dayIdx)
      return {
        id: encodeMarkerId(p.dayIdx, p.spotIdx),
        latitude: p.lat,
        longitude: p.lng,
        width: 28,
        height: 28,
        callout: {
          content: String(label),
          color: '#ffffff',
          fontSize: 12,
          bgColor: color,
          padding: 6,
          borderRadius: 14,
          display: 'ALWAYS' as const,
          textAlign: 'center' as const,
        },
        iconPath: '', // 我们只用 callout 显示气泡,iconPath 空字符串让 weapp 用默认 marker;视觉重点在 callout
      }
    })
  }, [located, mode])

  // 单日模式画一条按顺序的连线
  const polyline = useMemo(() => {
    if (mode === 'all' || located.length < 2) return []
    return [{
      points: located.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      color: dayColor(typeof mode === 'number' ? mode : 0),
      width: 3,
      arrowLine: true,
    }]
  }, [located, mode])

  // 切换 mode / 数据变化时 fitBounds
  // 注:weapp MapContext 没有 setScale 方法,scale 只能通过 <Map> 的 scale prop 设置;
  // 这里用一个 manualScale state 在 1-point 时强制一个合理 zoom。
  const [manualScale, setManualScale] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (!ctxRef.current) ctxRef.current = Taro.createMapContext(MAP_ID)
    const ctx = ctxRef.current
    if (located.length === 0) {
      setManualScale(undefined)
      return
    }
    if (located.length === 1) {
      setManualScale(14)
      // 一点时不调 includePoints(可能 zoom 过远),改用 <Map> 的 latitude/longitude + scale
      return
    }
    setManualScale(undefined)
    ctx.includePoints({
      points: located.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      padding: [80, 40, 80, 40],
    })
  }, [located])

  // 一点时让 <Map> 直接居中到该点
  const center = located.length === 1
    ? { latitude: located[0].lat, longitude: located[0].lng }
    : { latitude: trip.destinations?.[0]?.lat ?? 30.27, longitude: trip.destinations?.[0]?.lng ?? 120.15 }

  const onMarkerTap = (e: any) => {
    const id: number = e.detail?.markerId ?? e.markerId
    if (typeof id !== 'number') return
    const { dayIdx, spotIdx } = decodeMarkerId(id)
    const spot = trip.days[dayIdx]?.spots[spotIdx]
    if (spot) setPicked(spot)
  }

  return (
    <View className='mv'>
      <ModeBar days={trip.days} mode={mode} onChange={setMode} />
      <View className='mv-map-wrap'>
        <Map
          id={MAP_ID}
          className='mv-map'
          longitude={center.longitude}
          latitude={center.latitude}
          scale={manualScale ?? 10}
          markers={markers as any}
          polyline={polyline as any}
          onMarkerTap={onMarkerTap}
          onError={() => {}}
          showLocation={false}
          enableTraffic={false}
        />
      </View>
      <SpotMapSheet spot={picked} onClose={() => setPicked(null)} />
    </View>
  )
}
