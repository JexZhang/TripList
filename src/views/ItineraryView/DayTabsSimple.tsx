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

export default function DayTabsSimple({ days, activeId, onSelect, onLongPress, onAdd }: Props) {
  return (
    <ScrollView scrollX className='dt dt--simple'>
      {days.map((d, idx) => (
        <View
          key={d.id}
          className={`dt-item dt-item--simple ${activeId === d.id ? 'on' : ''}`}
          onClick={() => onSelect(d.id)}
          onLongPress={() => onLongPress(d.id, idx)}
        >
          <Text className='dt-simple-num'>{idx + 1}</Text>
          <Text className='dt-simple-date'>{dayjs(d.date).format('M.D')}</Text>
        </View>
      ))}
      <View className='dt-add dt-add--simple' onClick={() => onAdd('back')}>
        <Text>+</Text>
      </View>
    </ScrollView>
  )
}
