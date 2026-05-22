import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Map, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTripStore } from '../../store/trip-store'
import ModeBar, { type MapMode } from './ModeBar'
import SpotMapSheet from './SpotMapSheet'
import { collectLocated, dayColor, encodeMarkerId, decodeMarkerId } from './helpers'
import type { Spot } from '../../types/trip'
import './index.scss'

const MAP_ID = 'trip-map'

interface SheetHandle {
  show: (spot: Spot) => void
}

// 把底部 sheet 的 picked 状态封装在独立子组件里。
// 这样开/关 sheet 只会触发它自己 re-render,不会牵动 MapView 和 <Map>,
// 也就不会被 weapp 重新下发 setData 而把 includePoints 设好的视野盖掉。
const SheetContainer = forwardRef<SheetHandle, {}>(function SheetContainer(_props, ref) {
  const [picked, setPicked] = useState<Spot | null>(null)
  useImperativeHandle(ref, () => ({
    show: (spot: Spot) => setPicked(spot),
  }))
  return <SpotMapSheet spot={picked} onClose={() => setPicked(null)} />
})

export default function MapView() {
  const { state } = useTripStore()
  const trip = state.trip!
  const [mode, setMode] = useState<MapMode>('all')
  const ctxRef = useRef<ReturnType<typeof Taro.createMapContext> | null>(null)
  const sheetRef = useRef<SheetHandle | null>(null)

  const located = useMemo(() => {
    if (mode === 'all') return collectLocated(trip.days)
    return collectLocated(trip.days, mode)
  }, [trip.days, mode])

  const markers = useMemo(() => {
    return located.map((p) => {
      const label = mode === 'all' ? p.dayIdx + 1 : p.spotIdx + 1
      const color = dayColor(p.dayIdx)
      return {
        id: encodeMarkerId(p.dayIdx, p.spotIdx),
        latitude: p.lat,
        longitude: p.lng,
        width: 1,
        height: 1,
        anchor: { x: 0.5, y: 1 },
        callout: {
          content: String(label),
          color: '#FFFFFF',
          fontSize: 14,
          bgColor: color,
          padding: 10,
          borderRadius: 999,
          borderWidth: 3,
          borderColor: '#FFFFFF',
          display: 'ALWAYS' as const,
          textAlign: 'center' as const,
          anchorX: 0,
          anchorY: -4,
        },
        iconPath: '',
      }
    })
  }, [located, mode])

  const polyline = useMemo(() => {
    if (mode === 'all' || located.length < 2) return []
    return [{
      points: located.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      color: dayColor(typeof mode === 'number' ? mode : 0),
      width: 10,
      borderColor: '#FFFFFF',
      borderWidth: 2,
      arrowLine: true,
      dottedLine: false,
    }]
  }, [located, mode])

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
      return
    }
    setManualScale(undefined)
    ctx.includePoints({
      points: located.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      padding: [80, 40, 80, 40],
    })
  }, [located])

  const latitude = located.length === 1
    ? located[0].lat
    : (trip.destinations?.[0]?.lat ?? 30.27)
  const longitude = located.length === 1
    ? located[0].lng
    : (trip.destinations?.[0]?.lng ?? 120.15)
  const scale = manualScale ?? 10

  // 点 marker 时不在 MapView 里 setState,而是直接命令式调 SheetContainer。
  // 关键:MapView 不再随 sheet 开关 re-render -> <Map> 不会被覆盖。
  // marker icon 是 1x1 透明,所以同时处理 onCalloutTap (用户实际点的是气泡)。
  const handleTap = useCallback((e: any) => {
    const id: number = e.detail?.markerId ?? e.markerId
    if (typeof id !== 'number') return
    const { dayIdx, spotIdx } = decodeMarkerId(id)
    const spot = trip.days[dayIdx]?.spots[spotIdx]
    if (spot) sheetRef.current?.show(spot)
  }, [trip.days])

  return (
    <View className='mv'>
      <ModeBar days={trip.days} mode={mode} onChange={setMode} />
      <View className='mv-map-wrap'>
        <Map
          id={MAP_ID}
          className='mv-map'
          latitude={latitude}
          longitude={longitude}
          scale={scale}
          markers={markers as any}
          polyline={polyline as any}
          onMarkerTap={handleTap}
          onCalloutTap={handleTap}
          onError={() => {}}
          showLocation={false}
          enableTraffic={false}
        />
      </View>
      <SheetContainer ref={sheetRef} />
    </View>
  )
}
