import { View, Text, Picker } from '@tarojs/components'
import { fmtDate } from '../../utils/format'
import './index.scss'

interface DateRange {
  start: string  // 'YYYY-MM-DD'
  end: string
}

interface Props {
  value: DateRange
  onChange: (v: DateRange) => void
}

export default function DatePicker({ value, onChange }: Props) {
  return (
    <View className='date-picker'>
      <Picker
        mode='date'
        value={value.start}
        onChange={e => onChange({ ...value, start: String(e.detail.value) })}
      >
        <View className='dp-field'>
          <Text className='dp-label'>起</Text>
          <Text className='dp-value'>{fmtDate(value.start)}</Text>
        </View>
      </Picker>

      <Text className='dp-arrow'>→</Text>

      <Picker
        mode='date'
        value={value.end}
        start={value.start}
        onChange={e => onChange({ ...value, end: String(e.detail.value) })}
      >
        <View className='dp-field'>
          <Text className='dp-label'>止</Text>
          <Text className='dp-value'>{fmtDate(value.end)}</Text>
        </View>
      </Picker>
    </View>
  )
}
