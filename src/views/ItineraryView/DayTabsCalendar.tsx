import { ScrollView, View, Text } from '@tarojs/components'
import dayjs from 'dayjs'
import type { Day } from '../../types/trip'

interface Props {
  days: Day[]
  activeId: string
  onSelect: (id: string) => void
  onLongPress: (id: string, idx: number) => void
  onAdd: (pos: 'front' | 'back') => void
}

export default function DayTabsCalendar({ days, activeId, onSelect, onLongPress, onAdd }: Props) {
  return (
    <View className='dt-pp-wrap'>
      <ScrollView scrollX className='dt dt--calendar'>
        <View className='dt-track dt-track--calendar'>
          {days.map((d, idx) => {
            const date = dayjs(d.date)
            const isActive = activeId === d.id
            return (
              <View
                key={d.id}
                className={`dt-item dt-item--calendar ${isActive ? 'on' : ''}`}
                onClick={() => onSelect(d.id)}
                onLongPress={() => onLongPress(d.id, idx)}
              >
                <View className='dt-cal-ring' />
                <View className='dt-cal-inner'>
                  <Text className='dt-cal-month'>{date.format('M')}月</Text>
                  <Text className='dt-cal-bigday'>{date.format('D')}</Text>
                  <Text className='dt-cal-label'>DAY {idx + 1}</Text>
                </View>
              </View>
            )
          })}
          <View className='dt-add dt-add--cal' onClick={() => onAdd('back')}>
            <Text className='dt-add-cal-icon'>+</Text>
            <Text className='dt-add-cal-text'>加一天</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
