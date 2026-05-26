import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import dayjs from 'dayjs'
import { useTripStore } from '../../store/trip-store'
import { uid } from '../../utils/id'
import type { Spot, Day } from '../../types/trip'
import DayHeader from './DayHeader'
import SpotCard from './SpotCard'
import SpotSearch, { type SelectedSpotInfo } from '../../components/SpotSearch'
import EditSpotSheet from '../../components/EditSpotSheet'
import './index.scss'

export default function ItineraryView() {
  const { state, dispatch } = useTripStore()
  const trip = state.trip!
  const [activeDayId, setActiveDayId] = useState<string>(trip.days[0]?.id || '')
  const [searchOpen, setSearchOpen] = useState(false)
  const [editSpot, setEditSpot] = useState<{ dayId: string; spot: Spot } | null>(null)

  const activeDay: Day | undefined = trip.days.find(d => d.id === activeDayId) || trip.days[0]

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
            setActiveDayId(trip.days.find(d => d.id !== dayId)?.id || '')
          }
        }
      },
    })
    try {
      const res = await Taro.showActionSheet({ itemList: items.map(i => i.label) })
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

  if (!activeDay) return <View className='itinerary-empty'>没有日程,点 [+] 加一天</View>

  const tabVariant =
    trip._id === 'seed-mohe' ? 'spine' :
    trip._id === 'seed-jzg' ? 'calendar' :
    'ticket'

  return (
    <View className='itinerary'>
      {/* day tabs */}
      <ScrollView className={`itin-tabs itin-tabs--${tabVariant}`} scrollX enableFlex>
        <View className='itin-tab-add itin-tab-add--front' onClick={() => addDay('front')}>
          <Text className='itin-tab-no'>+</Text>
        </View>
        {trip.days.map((d, idx) => (
          <View
            key={d.id}
            className={`itin-tab ${activeDayId === d.id ? 'on' : ''}`}
            onClick={() => setActiveDayId(d.id)}
            onLongPress={() => longPressDay(d.id, idx)}
          >
            <Text className='itin-tab-month'>{dayjs(d.date).format('MMM').toUpperCase()}</Text>
            <Text className='itin-tab-bigday'>{dayjs(d.date).format('D')}</Text>
            <Text className='itin-tab-no'>{String(idx + 1).padStart(2, '0')}</Text>
            <View className='itin-tab-sep' />
            <Text className='itin-tab-date'>{dayjs(d.date).format('M/D')}</Text>
            <Text className='itin-tab-dlabel'>Day {idx + 1}</Text>
            <View className='itin-tab-notch itin-tab-notch--t' />
            <View className='itin-tab-notch itin-tab-notch--b' />
          </View>
        ))}
        <View className='itin-tab-add' onClick={() => addDay('back')}>
          <Text className='itin-tab-no'>+</Text>
        </View>
      </ScrollView>

      {/* 当日 */}
      <DayHeader
        day={activeDay}
        fallbackDestination={trip.destinations?.[0] || null}
        onWeatherUpdate={w => dispatch({ type: 'UPDATE_DAY', dayId: activeDay.id, patch: { weather: w } })}
      />

      <View className='itin-spots'>
        {activeDay.spots.map(s => (
          <SpotCard key={s.id} spot={s} onClick={() => setEditSpot({ dayId: activeDay.id, spot: s })} />
        ))}
        {activeDay.spots.length === 0 && (
          <View className='itin-empty'>这一天还没有地点</View>
        )}
        <View className='itin-add-spot' onClick={() => setSearchOpen(true)}>
          + 添加地点
        </View>
      </View>

      <SpotSearch
        open={searchOpen}
        defaultCity={activeDay.spots[0]?.city || trip.destinations?.[0]?.name}
        onClose={() => setSearchOpen(false)}
        onSelect={handleAddSpot}
      />

      <EditSpotSheet
        open={!!editSpot}
        spot={editSpot?.spot || null}
        defaultCity={activeDay.spots[0]?.city || trip.destinations?.[0]?.name}
        onClose={() => setEditSpot(null)}
        onSave={patch => {
          if (!editSpot) return
          dispatch({ type: 'UPDATE_SPOT', dayId: editSpot.dayId, spotId: editSpot.spot.id, patch })
        }}
        onDelete={() => {
          if (!editSpot) return
          dispatch({ type: 'DELETE_SPOT', dayId: editSpot.dayId, spotId: editSpot.spot.id })
        }}
      />
    </View>
  )
}
