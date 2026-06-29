import { useEffect, useMemo, useState } from 'react'
import { View, Text, Picker, RootPortal } from '@tarojs/components'
import dayjs from 'dayjs'
import { useTheme } from '../../store/theme-store'
import type { Trip } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  trip: Trip
  onClose: () => void
  onConfirm: (startDate: string) => void
  onOrganize: () => void
}

function mmdd(date: string): string {
  return dayjs(date).format('MM/DD')
}

export default function TripDateAdjustSheet({ open, trip, onClose, onConfirm, onOrganize }: Props) {
  const { theme } = useTheme()
  const initialStart = trip.days[0]?.date || trip.startDate || dayjs().format('YYYY-MM-DD')
  const [startDate, setStartDate] = useState(initialStart)

  useEffect(() => {
    if (open) setStartDate(initialStart)
  }, [initialStart, open])

  const previewEnd = useMemo(() => {
    const count = Math.max(0, trip.days.length - 1)
    return dayjs(startDate).add(count, 'day').format('YYYY-MM-DD')
  }, [startDate, trip.days.length])

  if (!open) return null

  const hasDays = trip.days.length > 0

  return (
    <RootPortal>
      <View className={`tdas-mask theme-tokens theme-${theme}`} onClick={onClose}>
        <View className='tdas-sheet' onClick={(e) => e.stopPropagation()}>
          <View className='tdas-head'>
            <Text className='tdas-title'>调整整体日期</Text>
          </View>

          <Picker
            mode='date'
            value={startDate}
            disabled={!hasDays}
            onChange={(e) => setStartDate(String(e.detail.value))}
          >
            <View className={`tdas-picker ${hasDays ? '' : 'is-disabled'}`}>
              <Text className='tdas-picker-label'>出发日期</Text>
              <Text className='tdas-picker-value'>{hasDays ? startDate : '暂无行程日期'}</Text>
            </View>
          </Picker>

          <View className='tdas-preview'>
            <Text>{hasDays ? `调整后范围 ${mmdd(startDate)} - ${mmdd(previewEnd)}` : '请先添加行程天数'}</Text>
          </View>

          <View className='tdas-group'>
            <View className='tdas-group-copy'>
              <Text className='tdas-group-title'>整理每天内容</Text>
              <Text className='tdas-group-desc'>拖动排序或删除某一天</Text>
            </View>
            <View className='tdas-organize' onClick={onOrganize}>
              <Text>去整理</Text>
            </View>
          </View>

          <View
            className={`tdas-confirm ${hasDays ? '' : 'is-disabled'}`}
            onClick={() => {
              if (!hasDays) return
              onConfirm(startDate)
              onClose()
            }}
          >
            <Text>确认调整</Text>
          </View>
          <View className='tdas-cancel' onClick={onClose}><Text>取消</Text></View>
        </View>
      </View>
    </RootPortal>
  )
}
