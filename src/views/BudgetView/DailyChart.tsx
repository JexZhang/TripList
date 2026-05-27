import { ScrollView, View, Text } from '@tarojs/components'
import dayjs from 'dayjs'
import type { DailyTotal } from './helpers'

interface Props {
  daily: DailyTotal[]
}

const PER_DAY_RPX = 120
const MIN_TOTAL_RPX = 540
const H = 80
const PAD_TOP = 22
const PAD_BOTTOM = 8

export default function DailyChart({ daily }: Props) {
  if (daily.length === 0) {
    return <View className='bv-chart-empty'>暂无数据</View>
  }

  const totalRpx = Math.max(MIN_TOTAL_RPX, daily.length * PER_DAY_RPX)
  const W = totalRpx / 2
  const slot = W / daily.length

  const maxV = Math.max(1, ...daily.map((d) => d.v))
  const innerH = H - PAD_TOP - PAD_BOTTOM
  const points = daily.map((d, i) => {
    const x = (i + 0.5) * slot
    const y = PAD_TOP + (1 - d.v / maxV) * innerH
    return { x, y, d }
  })
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')
  const last = points[points.length - 1]
  const first = points[0]
  const areaPath = `${path} L${last.x.toFixed(1)},${H} L${first.x.toFixed(1)},${H} Z`
  const maxIdx = daily.findIndex((d) => d.v === maxV)

  return (
    <View className='bv-chart'>
      <ScrollView scrollX enhanced showScrollbar={false} className='bv-chart-scroll'>
        <View className='bv-chart-track' style={{ width: `${totalRpx}rpx` }}>
          <View
            className='bv-chart-svg'
            style={{
              width: `${totalRpx}rpx`,
              backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svgString({ W, H, path, areaPath, points, maxIdx }))}")`,
            }}
          />
          <View className='bv-chart-axis'>
            {daily.map((d, i) => (
              <Text
                key={d.dayId}
                className={`bv-chart-axis-l ${i === maxIdx ? 'on' : ''}`}
                style={{ width: `${PER_DAY_RPX}rpx` }}
              >
                {dayjs(d.date).format('M/D')}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

function svgString({
  W, H, path, areaPath, points, maxIdx,
}: {
  W: number; H: number
  path: string
  areaPath: string
  points: { x: number; y: number; d: DailyTotal }[]
  maxIdx: number
}): string {
  return `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' preserveAspectRatio='none'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='currentColor' stop-opacity='0.28'/>
      <stop offset='100%' stop-color='currentColor' stop-opacity='0'/>
    </linearGradient>
  </defs>
  <path d='${areaPath}' fill='url(#g)'/>
  <path d='${path}' stroke='currentColor' stroke-width='1.5' fill='none' stroke-linejoin='round'/>
  ${points.map((p, i) => `<circle cx='${p.x}' cy='${p.y}' r='${i === maxIdx ? 3 : 2}' fill='currentColor'/>`).join('')}
  ${points.map((p, i) => {
    const y = Math.max(8, p.y - 5)
    const weight = i === maxIdx ? 700 : 500
    const opacity = i === maxIdx ? 1 : 0.78
    return `<text x='${p.x}' y='${y}' fill='currentColor' fill-opacity='${opacity}' font-size='8.5' text-anchor='middle' font-weight='${weight}'>¥${p.d.v}</text>`
  }).join('')}
</svg>`.trim()
}
