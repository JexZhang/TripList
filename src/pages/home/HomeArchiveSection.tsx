import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import type { Trip } from '../../types/trip'
import { fmtDateShort } from '../../utils/format'
import { tripSummary } from '../../utils/trip-helpers'
import './styles/home-archive.scss'

interface Props {
  trips: Trip[]
  onOpenTrip: (trip: Trip) => void
  onLongPressTrip: (trip: Trip) => void
}

/** 首页底部「已归档」折叠区——4 主题共用 */
export default function HomeArchiveSection({ trips, onOpenTrip, onLongPressTrip }: Props) {
  const [open, setOpen] = useState(false)
  if (trips.length === 0) return null

  return (
    <View className='h-arch'>
      <View className='h-arch-toggle' onClick={() => setOpen(!open)}>
        <Text className='h-arch-label'>已归档</Text>
        <Text className='h-arch-count'>{trips.length}</Text>
        <Text className={`h-arch-arrow ${open ? 'up' : ''}`}>›</Text>
      </View>
      {open && (
        <View className='h-arch-list'>
          {trips.map((t) => (
            <View
              key={t._id}
              className='h-arch-row'
              onClick={() => onOpenTrip(t)}
              onLongPress={() => onLongPressTrip(t)}
            >
              <View className='h-arch-row-body'>
                <Text className='h-arch-row-name'>{t.name}</Text>
                <Text className='h-arch-row-meta'>
                  {fmtDateShort(t.startDate)} → {fmtDateShort(t.endDate)} · {tripSummary(t.startDate, t.endDate, t.pax)}
                </Text>
              </View>
              <Text className='h-arch-row-arrow'>›</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
