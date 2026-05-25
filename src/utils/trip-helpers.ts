import dayjs from 'dayjs'
import { uid } from './id'
import type { Day, NewTripInput, Destination, GeneratedDay, GeneratedPlan } from '../types/trip'

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

/**
 * 把一个 LLM 生成的 day 转成 Trip.days 形态(补 id, 丢掉 _unresolved 标记)。
 */
export function planDayToDay(gd: GeneratedDay): Day {
  return {
    id: uid(),
    date: gd.date,
    spots: gd.spots.map(gs => ({
      id: uid(),
      type: gs.type,
      name: gs.name,
      city: gs.city,
      note: gs.note,
      price: gs.price,
      time: gs.time,
      lat: gs.lat,
      lng: gs.lng,
      adcode: gs.adcode,
    })),
    weather: null,
  }
}

/**
 * 按用户勾选的日期, 把 AI 生成的对应天合并进原 days 数组。
 * - existing 中未被选中的天保持不变
 * - 选中的天用 AI 版本替换(按 date 匹配)
 * - 若 AI 给的日期在 existing 中不存在(不该发生), 忽略
 */
export function mergePlanIntoDays(
  existing: Day[],
  plan: GeneratedPlan,
  selectedDates: string[],
): Day[] {
  const selectedSet = new Set(selectedDates)
  const aiByDate = new Map<string, GeneratedDay>()
  for (const gd of plan.days) aiByDate.set(gd.date, gd)

  return existing.map(d => {
    if (!selectedSet.has(d.date)) return d
    const gd = aiByDate.get(d.date)
    if (!gd) return d
    const replaced = planDayToDay(gd)
    // 保留原 day 的 id 和 weather, 只替换 spots
    return { ...d, spots: replaced.spots }
  })
}
