import { ScrollView, View, Text } from '@tarojs/components'
import dayjs from 'dayjs'
import type { Day } from '../../types/trip'
import { dayColor } from './helpers'

export type MapMode = 'all' | number
export type ModeBarVariant = 'track' | 'segmented' | 'route'

interface Props {
  days: Day[]
  mode: MapMode
  variant?: ModeBarVariant
  onChange: (mode: MapMode) => void
}

export default function ModeBar({ days, mode, variant = 'track', onChange }: Props) {
  if (variant === 'segmented') return <SegmentedBar days={days} mode={mode} onChange={onChange} />
  if (variant === 'route') return <RouteBar days={days} mode={mode} onChange={onChange} />
  return <TrackBar days={days} mode={mode} onChange={onChange} />
}

/* ---------- A. 颜色胶囊条 ---------- */
function TrackBar({ days, mode, onChange }: Omit<Props, 'variant'>) {
  return (
    <ScrollView scrollX className='mv-modebar mv-track'>
      <View
        className={`mv-track-item ${mode === 'all' ? 'on' : ''}`}
        style={{ '--c': '#2B1A10' } as any}
        onClick={() => onChange('all')}
      >
        <View className='mv-track-dot' />
        <Text className='mv-track-label'>全部</Text>
      </View>
      {days.map((d, idx) => (
        <View
          key={d.id}
          className={`mv-track-item ${mode === idx ? 'on' : ''}`}
          style={{ '--c': dayColor(idx) } as any}
          onClick={() => onChange(idx)}
        >
          <View className='mv-track-dot' />
          <Text className='mv-track-label'>D{idx + 1} {dayjs(d.date).format('M/D')}</Text>
        </View>
      ))}
    </ScrollView>
  )
}

/* ---------- B. 分段控制器 ---------- */
function SegmentedBar({ days, mode, onChange }: Omit<Props, 'variant'>) {
  const items: Array<{ key: string; label: string; sub?: string; mode: MapMode }> = [
    { key: 'all', label: '全部', mode: 'all' },
    ...days.map((d, idx) => ({
      key: d.id,
      label: `D${idx + 1}`,
      sub: dayjs(d.date).format('M/D'),
      mode: idx as MapMode,
    })),
  ]
  return (
    <View className='mv-modebar mv-seg-wrap'>
      <View className='mv-seg'>
        {items.map((it, i) => (
          <View
            key={it.key}
            className={`mv-seg-item ${mode === it.mode ? 'on' : ''} ${i === 0 ? 'first' : ''}`}
            onClick={() => onChange(it.mode)}
          >
            <Text className='mv-seg-label'>{it.label}</Text>
            {it.sub && <Text className='mv-seg-sub'>{it.sub}</Text>}
          </View>
        ))}
      </View>
    </View>
  )
}

/* ---------- C. 路线卡片条 ---------- */
function RouteBar({ days, mode, onChange }: Omit<Props, 'variant'>) {
  return (
    <ScrollView scrollX className='mv-modebar mv-route'>
      <View
        className={`mv-route-item mv-route-all ${mode === 'all' ? 'on' : ''}`}
        onClick={() => onChange('all')}
      >
        <Text className='mv-route-no'>全部</Text>
        <Text className='mv-route-sub'>{days.length} 天</Text>
      </View>
      {days.map((d, idx) => (
        <View key={d.id} className='mv-route-cell'>
          <View className='mv-route-link' />
          <View
            className={`mv-route-item ${mode === idx ? 'on' : ''}`}
            style={{ '--c': dayColor(idx) } as any}
            onClick={() => onChange(idx)}
          >
            <Text className='mv-route-no'>D{idx + 1}</Text>
            <Text className='mv-route-date'>{dayjs(d.date).format('M/D')}</Text>
            <Text className='mv-route-sub'>{d.spots.length} 点</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  )
}
