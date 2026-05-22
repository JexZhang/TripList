import { ScrollView, View, Text } from '@tarojs/components'
import type { Day } from '../../types/trip'

export type MapMode = 'all' | number  // 'all' 或 dayIdx (0-based)

interface Props {
  days: Day[]
  mode: MapMode
  onChange: (mode: MapMode) => void
}

export default function ModeBar({ days, mode, onChange }: Props) {
  return (
    <ScrollView scrollX className='mv-modebar'>
      <View
        className={`mv-mode-item ${mode === 'all' ? 'on' : ''}`}
        onClick={() => onChange('all')}
      >
        <Text>全部</Text>
      </View>
      {days.map((d, idx) => (
        <View
          key={d.id}
          className={`mv-mode-item ${mode === idx ? 'on' : ''}`}
          onClick={() => onChange(idx)}
        >
          <Text>{`Day${idx + 1}`}</Text>
        </View>
      ))}
    </ScrollView>
  )
}
