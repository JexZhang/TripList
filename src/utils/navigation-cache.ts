/**
 * 跨页导航缓存：首页 navigateTo 前存 Trip 快照，trip 页取出用作 initialTrip，跳过 loading。
 * 独立模块，避免 home → trip 的跨页 import 导致 Taro 打包冲突。
 */
import type { Trip } from '../types/trip'

let _pending: Trip | null = null

export function cacheTripForNavigation(t: Trip) { _pending = t }

export function consumeCachedTrip(tripId: string): Trip | undefined {
  if (_pending && _pending._id === tripId) {
    const t = _pending
    _pending = null
    return t
  }
  return undefined
}
