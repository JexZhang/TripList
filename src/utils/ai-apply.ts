import type { Trip, GeneratedPlan } from '../types/trip'

/** 云函数返回的 recommendedDestinations 形状 */
interface CloudDestRec {
  name: string
  country?: string
  city?: string
}

interface AIDraftLite extends GeneratedPlan {
  name?: string
  recommendedDestinations?: CloudDestRec[]
}

/**
 * 把云函数返回的 aiDraft 中的 name / recommendedDestinations 合并到 trip patch。
 * - days 始终覆盖
 * - 仅当 trip 无目的地时写入 recommendedDestinations
 * - 仅当 draft 中携带了 name 时写入（云函数只在用户未命名时才在 draft 中加入 name）
 */
export function mergeAIDraft(trip: Trip, draft: AIDraftLite): Partial<Trip> {
  const patch: Partial<Trip> = {
    days: draft.days as Trip['days'],
  }
  if ((!trip.destinations || trip.destinations.length === 0) &&
      Array.isArray(draft.recommendedDestinations) &&
      draft.recommendedDestinations.length > 0) {
    // 云函数返回 { name, country, city }, 转为 Destination 兼容结构
    patch.destinations = draft.recommendedDestinations.map((d) => ({
      name: d.name,
      adcode: '',
      lat: 0,
      lng: 0,
    }))
  }
  if (draft.name) {
    patch.name = draft.name
  }
  return patch
}
