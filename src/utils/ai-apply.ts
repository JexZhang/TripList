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
 * - 仅当 trip 名是占位符时写入 AI 命名
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
  const isPlaceholderName = !trip.name || trip.name === 'AI 生成中…'
  if (isPlaceholderName && draft.name) {
    patch.name = draft.name
  } else if (isPlaceholderName && !draft.name) {
    patch.name = '未命名攻略'
  }
  return patch
}
