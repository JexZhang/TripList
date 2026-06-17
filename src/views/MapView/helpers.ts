import type { Day, Spot } from '../../types/trip'

// 按 day 索引循环取色;同一天的 marker 用同一色
const DAY_COLORS = [
  '#FF7A2E', '#FF5B5B', '#FFC247', '#4FB286',
  '#2A9DF4', '#A06CD5', '#FF8FAB',
]

export function dayColor(dayIndex: number): string {
  return DAY_COLORS[dayIndex % DAY_COLORS.length]
}

// 地图 callout 名称截断：过长名称截断为 8 字 + 省略号，避免标签过宽相互遮挡
export function truncateName(name: string, max = 8): string {
  if (!name) return ''
  return name.length > max ? `${name.slice(0, max)}…` : name
}

// weapp <Map> 要求 marker.id 为整数。dayIdx/spotIdx 都从 0 起。
// 单日最多 1000 个 spot 足够。
export function encodeMarkerId(dayIdx: number, spotIdx: number): number {
  return dayIdx * 1000 + spotIdx
}

export function decodeMarkerId(id: number): { dayIdx: number; spotIdx: number } {
  return { dayIdx: Math.floor(id / 1000), spotIdx: id % 1000 }
}

export interface Located {
  dayIdx: number
  spotIdx: number
  spot: Spot
  lat: number
  lng: number
}

// 仅取同时具备 lat/lng 的 spot;缺坐标的静默忽略
export function collectLocated(days: Day[], onlyDayIdx?: number): Located[] {
  const out: Located[] = []
  days.forEach((d, dIdx) => {
    if (onlyDayIdx !== undefined && dIdx !== onlyDayIdx) return
    d.spots.forEach((s, sIdx) => {
      if (typeof s.lat === 'number' && typeof s.lng === 'number') {
        out.push({ dayIdx: dIdx, spotIdx: sIdx, spot: s, lat: s.lat, lng: s.lng })
      }
    })
  })
  return out
}
