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
        <View className='dt-track dt-track--spine'>
          {days.map((d, idx) => (
            <View
              key={d.id}
              className={`dt-item dt-item--spine ${activeId === d.id ? 'on' : ''}`}
              onClick={() => onSelect(d.id)}
              onLongPress={() => onLongPress(d.id, idx)}
            >
              <Text className='dt-spine-no'>{String(idx + 1).padStart(2, '0')}</Text>
              <Text className='dt-spine-date'>{dayjs(d.date).format('M/D')}</Text>
              {activeId === d.id && <View className='dt-spine-bar' />}
            </View>
          ))}
          <View className='dt-add dt-add--spine' onClick={() => onAdd('back')}>
            <Text className='dt-add-spine-icon'>+</Text>
            <Text className='dt-add-spine-label'>DAY</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
