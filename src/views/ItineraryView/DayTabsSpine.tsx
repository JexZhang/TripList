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

export default function DayTabsSpine({ days, activeId, onSelect, onLongPress, onAdd }: Props) {
  return (
    <View className='dt-spine-wrap'>
      <ScrollView scrollX className='dt dt--spine'>
        {days.map((d, idx) => (
          <View
            key={d.id}
            className={`dt-item dt-item--spine ${activeId === d.id ? 'on' : ''}`}
            onClick={() => onSelect(d.id)}
            onLongPress={() => onLongPress(d.id, idx)}
          >
            <View className='dt-spine-dot' />
            <Text className='dt-spine-no'>D{idx + 1}</Text>
            <Text className='dt-spine-date'>{dayjs(d.date).format('M/D')}</Text>
          </View>
        ))}
        <View className='dt-add' onClick={() => onAdd('back')}>
          <Text>+</Text>
        </View>
      </ScrollView>
      <View className='dt-spine-line' />
    </View>
  )
}
