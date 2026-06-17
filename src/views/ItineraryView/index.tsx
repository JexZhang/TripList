import { useState } from 'react'
import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import dayjs from 'dayjs'
import { useTripStore } from '../../store/trip-store'
import { useTheme } from '../../store/theme-store'
import { uid } from '../../utils/id'
import SpotSearch, { type SelectedSpotInfo } from '../../components/SpotSearch'
import EditSpotSheet from '../../components/EditSpotSheet'
import type { Spot, Day } from '../../types/trip'
import DayTabs from './DayTabs'
import ItinTegami from './ItinTegami'
import ItinMagazine from './ItinMagazine'
import ItinPostcard from './ItinPostcard'
import ItinMinimal from './ItinMinimal'
import type { ItinViewProps } from './shared'
import './index.scss'

export default function ItineraryView() {
  const { state, dispatch, readonly: ro } = useTripStore()
  const trip = state.trip!
  const { theme } = useTheme()
  const [activeDayId, setActiveDayId] = useState<string>(trip.days[0]?.id || '')
  const [searchOpen, setSearchOpen] = useState(false)
  const [editSpot, setEditSpot] = useState<{ dayId: string; spot: Spot } | null>(null)

  const activeDayIdx = trip.days.findIndex((d) => d.id === activeDayId)
  const activeDay: Day | undefined = trip.days.find((d) => d.id === activeDayId) || trip.days[0]

  if (!activeDay) {
    return <View className='itinerary-empty'>没有日程,点 [+] 加一天</View>
  }

  const noop = () => {}

  const addDay = (position: 'front' | 'back' = 'back') => {
    const last = trip.days[trip.days.length - 1]
    const newDate = position === 'front'
      ? dayjs(trip.days[0]?.date || trip.startDate).subtract(1, 'day').format('YYYY-MM-DD')
      : last
        ? dayjs(last.date).add(1, 'day').format('YYYY-MM-DD')
        : dayjs(trip.startDate).format('YYYY-MM-DD')
    const day: Day = { id: uid(), date: newDate, spots: [], weather: null }
    dispatch({ type: 'ADD_DAY', day, position })
    setActiveDayId(day.id)
  }

  const longPressDay = async (dayId: string, dayIdx: number) => {
    const total = trip.days.length
    const dayNo = dayIdx + 1
    const items: { label: string; action: () => void }[] = []
    if (dayIdx > 0) {
      items.push({ label: '← 前移一位', action: () => dispatch({ type: 'MOVE_DAY', dayId, targetIndex: dayIdx - 1 }) })
      items.push({ label: '⇤ 移到最前 (整体提前 1 天)', action: () => dispatch({ type: 'MOVE_DAY', dayId, targetIndex: 0 }) })
    }
    if (dayIdx < total - 1) {
      items.push({ label: '后移一位 →', action: () => dispatch({ type: 'MOVE_DAY', dayId, targetIndex: dayIdx + 1 }) })
      items.push({ label: '⇥ 移到最后 (整体延后 1 天)', action: () => dispatch({ type: 'MOVE_DAY', dayId, targetIndex: total - 1 }) })
    }
    items.push({
      label: `删除 Day ${dayNo}`,
      action: async () => {
        const res = await Taro.showModal({
          title: `删除 Day ${dayNo}?`,
          content: '该日的所有 spots 一并删除',
          confirmText: '删除',
          confirmColor: '#c43d3d',
        })
        if (res.confirm) {
          dispatch({ type: 'DELETE_DAY', dayId })
          if (activeDayId === dayId) {
            setActiveDayId(trip.days.find((d) => d.id !== dayId)?.id || '')
          }
        }
      },
    })
    try {
      const res = await Taro.showActionSheet({ itemList: items.map((i) => i.label) })
      const picked = items[res.tapIndex]
      if (picked) await picked.action()
    } catch {
      // 用户取消
    }
  }

  const handleAddSpot = (info: SelectedSpotInfo) => {
    if (!activeDay) return
    const spot: Spot = {
      id: uid(),
      type: 'spot',
      name: info.name,
      city: info.city,
      adcode: info.adcode,
      lat: info.lat,
      lng: info.lng,
    }
    dispatch({ type: 'ADD_SPOT', dayId: activeDay.id, spot })
  }

  const viewProps: ItinViewProps = {
    trip,
    activeDay,
    activeDayIdx,
    fallbackDestination: trip.destinations?.[0] || null,
    onSelectDay: setActiveDayId,
    onLongPressDay: ro ? noop : longPressDay,
    onAddDay: ro ? noop : addDay,
    onSpotClick: ro ? noop : (s) => setEditSpot({ dayId: activeDay.id, spot: s }),
    onAddSpot: ro ? noop : () => setSearchOpen(true),
    onWeatherUpdate: ro ? noop : (w) => dispatch({ type: 'UPDATE_DAY', dayId: activeDay.id, patch: { weather: w } }),
  }

  return (
    <View className={`itinerary${ro ? ' is-ro' : ''}`}>
      <DayTabs
        days={trip.days}
        activeId={activeDayId}
        onSelect={setActiveDayId}
        onLongPress={ro ? noop : longPressDay}
        onAdd={ro ? noop : addDay}
      />

      {theme === 'tegami'   && <ItinTegami   {...viewProps} />}
      {theme === 'magazine' && <ItinMagazine {...viewProps} />}
      {theme === 'postcard' && <ItinPostcard {...viewProps} />}
      {theme === 'minimal'  && <ItinMinimal  {...viewProps} />}

      {!ro && (
        <SpotSearch
          open={searchOpen}
          defaultCity={activeDay.spots[0]?.city || trip.destinations?.[0]?.name}
          onClose={() => setSearchOpen(false)}
          onSelect={handleAddSpot}
        />
      )}
      {!ro && (
        <EditSpotSheet
          open={!!editSpot}
          spot={editSpot?.spot || null}
          defaultCity={activeDay.spots[0]?.city || trip.destinations?.[0]?.name}
          onClose={() => setEditSpot(null)}
          onSave={(patch) => {
            if (!editSpot) return
            dispatch({ type: 'UPDATE_SPOT', dayId: editSpot.dayId, spotId: editSpot.spot.id, patch })
          }}
          onDelete={() => {
            if (!editSpot) return
            dispatch({ type: 'DELETE_SPOT', dayId: editSpot.dayId, spotId: editSpot.spot.id })
          }}
        />
      )}
    </View>
  )
}
