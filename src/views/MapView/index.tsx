import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Map, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTripStore } from '../../store/trip-store'
import { useTheme } from '../../store/theme-store'
import { MAPMODE_VARIANT } from './variants'
import ModeBar, { type MapMode } from './ModeBar'
import SpotMapSheet from './SpotMapSheet'
import { collectLocated, dayColor, encodeMarkerId, decodeMarkerId, truncateName } from './helpers'
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
  const { state, readonly: ro } = useTripStore()
  const trip = state.trip!
  const { theme } = useTheme()
  const variant = MAPMODE_VARIANT[theme]
  const [mode, setMode] = useState<MapMode>('all')
  const ctxRef = useRef<ReturnType<typeof Taro.createMapContext> | null>(null)
  const sheetRef = useRef<SheetHandle | null>(null)

  const located = useMemo(() => {
    if (mode === 'all') return collectLocated(trip.days)
    return collectLocated(trip.days, mode)
  }, [trip.days, mode])

  const markers = useMemo(() => {
    const isAll = mode === 'all'
    return located.map((p) => {
      const color = dayColor(p.dayIdx)
      // all 模式：天序号数字徽标（总览，保持整洁）
      // 单天模式：直接显示地点名（截断防止过长），不带序号
      const content = isAll ? String(p.dayIdx + 1) : truncateName(p.spot.name)
      return {
        id: encodeMarkerId(p.dayIdx, p.spotIdx),
        latitude: p.lat,
        longitude: p.lng,
        width: 1,
        height: 1,
        anchor: { x: 0.5, y: 1 },
        callout: {
          content,
          color: '#FFFFFF',
          fontSize: isAll ? 14 : 13,
          bgColor: color,
          padding: isAll ? 10 : 8,
          borderRadius: isAll ? 999 : 8,
          borderWidth: isAll ? 3 : 2,
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

  // 关键:用 ref 跟踪用户当前查看的视野,re-render 时不要把它盖掉。
  // - 首次进入和 mode 变化时,根据 located 计算/居中。
  // - 用户拖动/缩放后,通过 onRegionChange 写入 ref。
  // - 平时 <Map> 的 latitude/longitude/scale 绑定到 viewport state,
  //   只在 mode 切换那一刻更新,其他 re-render 不变(避免视野跳回)。
  const viewportRef = useRef<{ latitude: number; longitude: number; scale: number }>({
    latitude: trip.destinations?.[0]?.lat ?? 30.27,
    longitude: trip.destinations?.[0]?.lng ?? 120.15,
    scale: 10,
  })
  const [viewport, setViewport] = useState(viewportRef.current)

  // mode 变化时居中到当前 mode 的点(初次进入也算 mode 'all' 的变化)
  useEffect(() => {
    if (!ctxRef.current) ctxRef.current = Taro.createMapContext(MAP_ID)
    const ctx = ctxRef.current
    if (located.length === 0) {
      return
    }
    if (located.length === 1) {
      const next = { latitude: located[0].lat, longitude: located[0].lng, scale: 14 }
      viewportRef.current = next
      setViewport(next)
      return
    }
    // 多点:用 includePoints 命令式调整视野,然后通过 onRegionChange 拿到中心写回 ref
    ctx.includePoints({
      points: located.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      padding: [80, 40, 80, 40],
    })
  }, [mode, located])

  const handleRegionChange = useCallback((e: any) => {
    // type=end 时拿到稳定中心和 scale
    if (e?.type !== 'end') return
    const lat = e?.detail?.centerLocation?.latitude
    const lng = e?.detail?.centerLocation?.longitude
    const scale = e?.detail?.scale
    if (typeof lat === 'number' && typeof lng === 'number') {
      viewportRef.current = {
        latitude: lat,
        longitude: lng,
        scale: typeof scale === 'number' ? scale : viewportRef.current.scale,
      }
      // 不调 setViewport,避免 re-render 触发地图 setData 覆盖。
      // viewport state 仅在 mode 切换时刷新。
    }
  }, [])

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

  // "回到我的位置"按钮:授权 -> 居中
  const handleLocateMe = useCallback(async () => {
    try {
      const res = await Taro.getLocation({ type: 'gcj02' })
      if (!ctxRef.current) ctxRef.current = Taro.createMapContext(MAP_ID)
      ctxRef.current.moveToLocation({
        latitude: res.latitude,
        longitude: res.longitude,
      })
    } catch (e) {
      Taro.showToast({ title: '请授权位置权限', icon: 'none' })
    }
  }, [])

  return (
    <View className={`mv${ro ? ' is-ro' : ''}`}>
      <ModeBar
        days={trip.days}
        mode={mode}
        variant={variant}
        onChange={setMode}
      />
      <View className='mv-map-wrap'>
        <Map
          id={MAP_ID}
          className='mv-map'
          latitude={viewport.latitude}
          longitude={viewport.longitude}
          scale={viewport.scale}
          markers={markers as any}
          polyline={polyline as any}
          onMarkerTap={ro ? () => {} : handleTap}
          onCalloutTap={ro ? () => {} : handleTap}
          onRegionChange={handleRegionChange}
          onError={() => {}}
          showLocation={!ro}
          enableTraffic={false}
        />
        {!ro && (
          <View className='mv-locate-btn' onClick={handleLocateMe}>
            <View className='mv-locate-ring'>
              <View className='mv-locate-dot' />
            </View>
          </View>
        )}
      </View>
      {!ro && <SheetContainer ref={sheetRef} />}
    </View>
  )
}
