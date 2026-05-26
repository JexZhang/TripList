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
    <ScrollView scrollX className='dt dt--calendar'>
      {days.map((d, idx) => {
        const date = dayjs(d.date)
        return (
          <View
            key={d.id}
            className={`dt-item dt-item--calendar ${activeId === d.id ? 'on' : ''}`}
            onClick={() => onSelect(d.id)}
            onLongPress={() => onLongPress(d.id, idx)}
          >
            <Text className='dt-cal-month'>{date.format('M')} 月</Text>
            <Text className='dt-cal-bigday'>{date.format('D')}</Text>
            <Text className='dt-cal-label'>Day {idx + 1}</Text>
          </View>
        )
      })}
      <View className='dt-add dt-add--cal' onClick={() => onAdd('back')}>
        <Text>+</Text>
      </View>
    </ScrollView>
  )
}
