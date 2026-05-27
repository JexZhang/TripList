import type { Spot, SpotType, Trip } from '../../types/trip'

export interface BudgetBucket {
  type: SpotType
  label: string
  /** 用于 conic-gradient 的 CSS color（指向 token） */
  color: string
  total: number
  pct: number
  /** conic 起止角度 */
  start: number
  end: number
}

export interface DailyTotal {
  dayId: string
  date: string
  v: number
}

export interface ExpensiveSpot {
  dayId: string
  spot: Spot
  pctOfTotal: number
}

const CATEGORY_LABEL: Record<SpotType, string> = {
  hotel: '住宿',
  transport: '交通',
  meal: '餐饮',
  spot: '景点/杂项',
}

const CATEGORY_COLOR: Record<SpotType, string> = {
  hotel:     'var(--plum)',
  transport: 'var(--leaf)',
  meal:      'var(--accent)',
  spot:      'var(--sun)',
}

export function aggregateBudget(trip: Trip): {
  buckets: BudgetBucket[]
  total: number
  perPax: number
  daily: DailyTotal[]
  expensive: ExpensiveSpot | null
} {
  const totals: Record<SpotType, number> = { hotel: 0, transport: 0, meal: 0, spot: 0 }
  let total = 0
  let maxSpot: ExpensiveSpot | null = null
  const daily: DailyTotal[] = []

  for (const d of trip.days) {
    let dayV = 0
    for (const s of d.spots) {
      const p = s.price || 0
      totals[s.type] = (totals[s.type] || 0) + p
      total += p
      dayV += p
      if (!maxSpot || p > maxSpot.spot.price!) {
        if (p > 0) maxSpot = { dayId: d.id, spot: s, pctOfTotal: 0 }
      }
    }
    daily.push({ dayId: d.id, date: d.date, v: dayV })
  }

  if (maxSpot && total > 0) {
    maxSpot.pctOfTotal = (maxSpot.spot.price || 0) / total * 100
  }

  const order: SpotType[] = ['hotel', 'transport', 'meal', 'spot']
  let acc = 0
  const buckets: BudgetBucket[] = order.map((type) => {
    const v = totals[type] || 0
    const pct = total > 0 ? (v / total) * 100 : 0
    const angle = total > 0 ? (v / total) * 360 : 0
    const start = acc
    acc += angle
    return {
      type,
      label: CATEGORY_LABEL[type],
      color: CATEGORY_COLOR[type],
      total: v,
      pct,
      start,
      end: acc,
    }
  })

  const perPax = trip.pax > 0 ? Math.round(total / trip.pax) : total
  return { buckets, total, perPax, daily, expensive: maxSpot }
}

/** conic-gradient CSS 字符串（var(--*) 颜色作为 stop） */
export function conicFromBuckets(buckets: BudgetBucket[]): string {
  const usable = buckets.filter((b) => b.total > 0)
  if (usable.length === 0) return 'var(--line)'
  return usable.map((b) => `${b.color} ${b.start}deg ${b.end}deg`).join(', ')
}
