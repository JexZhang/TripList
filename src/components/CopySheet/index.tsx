import { useState } from 'react'
import { View, Text, Picker, RootPortal } from '@tarojs/components'
import { useTheme } from '../../store/theme-store'
import './index.scss'

interface Props {
  open: boolean
  dayCount: number
  onClose: () => void
  onCopy: (startDate: string) => void
  copying: boolean
}

export default function CopySheet({ open, dayCount, onClose, onCopy, copying }: Props) {
  const { theme } = useTheme()
  const [startDate, setStartDate] = useState('')

  if (!open) return null

  return (
    <RootPortal>
      <View className={`copy-sheet-mask theme-tokens theme-${theme}`} onClick={() => !copying && onClose()}>
        <View className='copy-sheet' onClick={(e) => e.stopPropagation()}>
          <Text className='copy-sheet-title'>选择出发日期</Text>
          <Picker mode='date' value={startDate} onChange={(e) => setStartDate(String(e.detail.value))}>
            <View className='copy-sheet-date'>
              <Text className='copy-sheet-date-l'>出发</Text>
              <Text className={`copy-sheet-date-v${startDate ? '' : ' copy-sheet-date-placeholder'}`}>{startDate || '请选择日期'}</Text>
            </View>
          </Picker>
          <Text className='copy-sheet-note'>共 {dayCount} 天,日期将自动顺延。</Text>
          <View className={`copy-sheet-go${copying ? ' busy' : ''}${!startDate ? ' disabled' : ''}`} onClick={() => startDate && onCopy(startDate)}>
            <Text>{copying ? '复制中…' : '确认复制'}</Text>
          </View>
        </View>
      </View>
    </RootPortal>
  )
}
