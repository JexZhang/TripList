import type { Day, Spot } from '../../types/trip'

// 按 day 索引循环取色;同一天的 marker 用同一色
const DAY_COLORS = [
  '#c43d3d', '#d98c2a', '#3a7d4f', '#2a6b9e',
  '#7a4ca0', '#a85a8e', '#5c5c5c',
]

export function dayColor(dayIndex: number): string {
  return DAY_COLORS[dayIndex % DAY_COLORS.length]
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
