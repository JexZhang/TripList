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
        end={value.end}
        onChange={e => {
          const start = String(e.detail.value)
          // 起始日晚于结束日时，把结束日一并顶到起始日，保证 start <= end
          onChange({ start, end: start > value.end ? start : value.end })
        }}
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
        onChange={e => {
          const end = String(e.detail.value)
          // 结束日早于起始日时回钳到起始日
          onChange({ ...value, end: end < value.start ? value.start : end })
        }}
      >
        <View className='dp-field'>
          <Text className='dp-label'>止</Text>
          <Text className='dp-value'>{fmtDate(value.end)}</Text>
        </View>
      </Picker>
    </View>
  )
}
