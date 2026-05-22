import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { useTripStore } from '../../store/trip-store'
import { fmtCurrency } from '../../utils/format'
import EditSpotSheet from '../../components/EditSpotSheet'
import type { Spot, SpotType } from '../../types/trip'
import './index.scss'

interface Bucket {
  type: SpotType
  label: string
  total: number
}

const CATEGORIES: { type: SpotType; label: string; seg: string }[] = [
  { type: 'hotel', label: '住宿', seg: 'seg-hotel' },
  { type: 'transport', label: '交通', seg: 'seg-transport' },
  { type: 'meal', label: '餐饮', seg: 'seg-meal' },
  { type: 'spot', label: '杂项', seg: 'seg-ticket' },
]

export default function BudgetView() {
  const { state, dispatch } = useTripStore()
  const trip = state.trip!
  const [editSpot, setEditSpot] = useState<{ dayId: string; spot: Spot } | null>(null)

  // 聚合 4 类
  const totals: Record<SpotType, number> = { spot: 0, hotel: 0, meal: 0, transport: 0 }
  for (const d of trip.days) {
    for (const s of d.spots) {
      totals[s.type] = (totals[s.type] || 0) + (s.price || 0)
    }
  }
  const grandTotal = totals.spot + totals.hotel + totals.meal + totals.transport
  const perPax = trip.pax > 0 ? Math.round(grandTotal / trip.pax) : grandTotal
  const pct = (n: number) => grandTotal > 0 ? `${(n / grandTotal) * 100}%` : '0%'

  return (
    <View className='budget'>
      {/* 总览 */}
      <View className='bg-total-row'>
        <View className='bg-total-block'>
          <Text className='bg-total-label'>总开销</Text>
          <Text className='bg-total-value'>{fmtCurrency(grandTotal)}</Text>
        </View>
        <View className='bg-total-block'>
          <Text className='bg-total-label'>人均 ({trip.pax}人)</Text>
          <Text className='bg-total-sub'>{fmtCurrency(perPax)}</Text>
        </View>
      </View>

      {/* 分布条 */}
      <View className='bg-dist'>
        <View className='bg-dist-bar'>
          {CATEGORIES.map(c => (
            <View
              key={c.type}
              className={`dist-seg ${c.seg}`}
              style={{ width: pct(totals[c.type]) }}
            />
          ))}
        </View>
        <View className='bg-dist-legend'>
          {CATEGORIES.map(c => (
            <View key={c.type} className='legend-item'>
              <View className={`legend-dot ${c.seg}`} />
              <Text className='legend-label'>{c.label}</Text>
              <Text className='legend-value'>{fmtCurrency(totals[c.type])}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 按天展开 */}
      <ScrollView className='bg-days' scrollY>
        {trip.days.map((d, idx) => {
          const dayTotal = d.spots.reduce((s, sp) => s + (sp.price || 0), 0)
          if (d.spots.length === 0) return null
          return (
            <View key={d.id} className='bg-day'>
              <View className='bg-day-head'>
                <Text className='bg-day-no'>DAY {String(idx + 1).padStart(2, '0')}</Text>
                <Text className='bg-day-date'>{d.date}</Text>
                <Text className='bg-day-total'>{fmtCurrency(dayTotal)}</Text>
              </View>
              {d.spots.map(s => (
                <View
                  key={s.id}
                  className='bg-spot'
                  onClick={() => setEditSpot({ dayId: d.id, spot: s })}
                >
                  <Text className='bg-spot-cat'>{CATEGORIES.find(c => c.type === s.type)?.label || '其他'}</Text>
                  <Text className='bg-spot-name'>{s.name}</Text>
                  <Text className='bg-spot-price'>{fmtCurrency(s.price || 0)}</Text>
                </View>
              ))}
            </View>
          )
        })}
        {trip.days.every(d => d.spots.length === 0) && (
          <View className='bg-empty'>还没有任何 spot；去攻略 tab 添加</View>
        )}
      </ScrollView>

      <EditSpotSheet
        open={!!editSpot}
        spot={editSpot?.spot || null}
        defaultCity={editSpot?.spot.city}
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
