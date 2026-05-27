import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { useTripStore } from '../../store/trip-store'
import { fmtCurrency } from '../../utils/format'
import EditSpotSheet from '../../components/EditSpotSheet'
import type { Spot } from '../../types/trip'
import { aggregateBudget, conicFromBuckets } from './helpers'
import DailyChart from './DailyChart'
import './index.scss'

export default function BudgetView() {
  const { state, dispatch } = useTripStore()
  const trip = state.trip!
  const [editSpot, setEditSpot] = useState<{ dayId: string; spot: Spot } | null>(null)

  const { buckets, total, perPax, daily, expensive } = aggregateBudget(trip)
  const conic = conicFromBuckets(buckets)
  const hotelPct = buckets.find((b) => b.type === 'hotel')?.pct || 0

  return (
    <ScrollView scrollY className='bv'>
      {/* 1. 顶部总览 */}
      <View className='bv-head'>
        <View className='bv-head-l'>
          <Text className='bv-total-label'>本次总开销</Text>
          <Text className='bv-total-value'>¥{total.toLocaleString()}</Text>
          <Text className='bv-perpax'>
            人均 <Text className='bv-perpax-v'>¥{perPax.toLocaleString()}</Text>
          </Text>
        </View>
        <View className='bv-donut-wrap'>
          <View className='bv-donut' style={{ background: `conic-gradient(${conic})` }}>
            <View className='bv-donut-hole' />
          </View>
          <View className='bv-donut-center'>
            <Text className='bv-donut-pct'>{Math.round(hotelPct)}%</Text>
            <Text className='bv-donut-cap'>住宿占比</Text>
          </View>
        </View>
      </View>

      {/* 2. 图例 */}
      <View className='bv-legend'>
        {buckets.map((b) => (
          <View key={b.type} className='bv-legend-row'>
            <View className='bv-legend-sw' style={{ background: b.color }} />
            <Text className='bv-legend-label'>{b.label}</Text>
            <Text className='bv-legend-pct'>{Math.round(b.pct)}%</Text>
            <Text className='bv-legend-v'>¥{b.total.toLocaleString()}</Text>
          </View>
        ))}
      </View>

      {/* 3. 每日折线 */}
      <View className='bv-card'>
        <View className='bv-card-head'>
          <Text className='bv-card-title'>每日花销</Text>
          <Text className='bv-card-cap'>{daily.length} 天 · 走势</Text>
        </View>
        <DailyChart daily={daily} />
      </View>

      {/* 4. 最贵一笔 */}
      {expensive && (
        <View
          className='bv-expensive'
          onClick={() => setEditSpot({ dayId: expensive.dayId, spot: expensive.spot })}
        >
          <Text className='bv-exp-kicker'>本次最贵一笔</Text>
          <Text className='bv-exp-name'>{expensive.spot.name}</Text>
          <View className='bv-exp-meta'>
            <Text className='bv-exp-price'>¥{(expensive.spot.price || 0).toLocaleString()}</Text>
            <Text className='bv-exp-pct'>占总开销 {Math.round(expensive.pctOfTotal)}%</Text>
          </View>
        </View>
      )}

      {/* 5. 分类明细：每类下展开该类所有 spot */}
      <View className='bv-details'>
        {buckets.map((b) => {
          const items = trip.days.flatMap((d) =>
            d.spots.filter((s) => s.type === b.type && (s.price || 0) > 0)
              .map((s) => ({ dayId: d.id, spot: s })),
          )
          if (items.length === 0) return null
          return (
            <View key={b.type} className='bv-detail-group'>
              <View className='bv-detail-head'>
                <View className='bv-detail-sw' style={{ background: b.color }} />
                <Text className='bv-detail-label'>{b.label}</Text>
                <Text className='bv-detail-total'>¥{b.total.toLocaleString()}</Text>
              </View>
              {items.map(({ dayId, spot }) => (
                <View
                  key={spot.id}
                  className='bv-detail-row'
                  onClick={() => setEditSpot({ dayId, spot })}
                >
                  <Text className='bv-detail-name'>{spot.name}</Text>
                  <Text className='bv-detail-price'>{fmtCurrency(spot.price || 0)}</Text>
                </View>
              ))}
            </View>
          )
        })}
      </View>

      <EditSpotSheet
        open={!!editSpot}
        spot={editSpot?.spot || null}
        defaultCity={editSpot?.spot.city || trip.destinations?.[0]?.name}
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
    </ScrollView>
  )
}
