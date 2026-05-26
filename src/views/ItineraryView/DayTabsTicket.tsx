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

export default function DayTabsTicket({ days, activeId, onSelect, onLongPress, onAdd }: Props) {
  return (
    <ScrollView scrollX className='dt dt--ticket'>
      <View className='dt-add dt-add--front' onClick={() => onAdd('front')}>
        <Text>+</Text>
      </View>
      {days.map((d, idx) => (
        <View
          key={d.id}
          className={`dt-item dt-item--ticket ${activeId === d.id ? 'on' : ''}`}
          onClick={() => onSelect(d.id)}
          onLongPress={() => onLongPress(d.id, idx)}
        >
          <Text className='dt-month'>{dayjs(d.date).format('MMM').toUpperCase()}</Text>
          <Text className='dt-bigday'>{dayjs(d.date).format('D')}</Text>
          <Text className='dt-no'>{String(idx + 1).padStart(2, '0')}</Text>
          <View className='dt-sep' />
          <Text className='dt-date'>{dayjs(d.date).format('M/D')}</Text>
          <Text className='dt-label'>Day {idx + 1}</Text>
          <View className='dt-notch dt-notch--t' />
          <View className='dt-notch dt-notch--b' />
        </View>
      ))}
      <View className='dt-add' onClick={() => onAdd('back')}>
        <Text>+</Text>
      </View>
    </ScrollView>
  )
}
