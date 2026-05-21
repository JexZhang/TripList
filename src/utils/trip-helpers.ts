import dayjs from 'dayjs'
import { uid } from './id'
import type { Day, NewTripInput, Destination } from '../types/trip'

/**
 * 按日期范围生成空的 day 数组（每天一条，无 spot）
 */
export function seedDays(startDate: string, endDate: string): Day[] {
  const days: Day[] = []
  let cursor = dayjs(startDate)
  const end = dayjs(endDate)
  while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
    days.push({
      id: uid(),
      date: cursor.format('YYYY-MM-DD'),
      spots: [],
      weather: null,
    })
    cursor = cursor.add(1, 'day')
  }
  return days
}

/**
 * 构造新 trip 的初始数据（未落库版本）
 */
export function buildNewTrip(input: {
  name: string
  pax: number
  startDate: string
  endDate: string
  destinations: Destination[]
}): NewTripInput {
  return {
    name: input.name.trim(),
    pax: input.pax,
    startDate: input.startDate,
    endDate: input.endDate,
    destinations: input.destinations,
    collaborators: [],
    ownerOpenid: '',  // 由调用方写入（来自 wx.cloud 上下文）
    days: seedDays(input.startDate, input.endDate),
    packing: [],
  }
}

/**
 * 攻略卡片摘要的目的地标签：南京 / 大兴安岭
 */
export function destinationLabel(destinations: Destination[]): string {
  if (!destinations || destinations.length === 0) return '未定'
  return destinations.map(d => d.name).join(' · ')
}

/**
 * 攻略卡片摘要的"4 天 · 4 人"
 */
export function tripSummary(startDate: string, endDate: string, pax: number): string {
  const days = dayjs(endDate).diff(dayjs(startDate), 'day') + 1
  return `${days} 天 · ${pax} 人`
}
