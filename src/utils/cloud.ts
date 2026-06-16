import Taro from '@tarojs/taro'

export interface PoiResult {
  name: string
  address: string
  city: string
  adcode: string
  lat: number
  lng: number
}

export interface WeatherInfo {
  city: string
  cityAdcode: string
  high: number
  low: number
  desc: string
  icon: string
  fetchedAt: number
}

export type ShareKind = 'readonly' | 'collab'

interface CallResult<T> {
  errMsg: string
  result: T
  requestID?: string
}

async function call<TIn extends Record<string, unknown>, TOut>(
  name: string,
  data: TIn,
): Promise<TOut> {
  // @ts-ignore Taro.cloud 在 weapp 端可用
  const res = (await Taro.cloud.callFunction({ name, data })) as CallResult<TOut>
  return res.result
}

// ── POI 搜索缓存：相同关键词 10min 内复用，LRU 上限 30，减少高频搜索的重复云调用 ──
const POI_CACHE_TTL = 10 * 60 * 1000
const POI_CACHE_MAX = 30
const poiCache = new Map<string, { results: PoiResult[]; ts: number }>()

async function searchPoiCached(data: { keyword: string; city?: string }): Promise<{ results: PoiResult[] }> {
  const key = `${data.keyword}::${data.city || ''}`
  const now = Date.now()
  const hit = poiCache.get(key)
  if (hit && now - hit.ts < POI_CACHE_TTL) {
    poiCache.delete(key)        // 命中后移到队尾，维持 LRU 顺序
    poiCache.set(key, hit)
    return { results: hit.results }
  }
  const res = await call<typeof data, { results: PoiResult[] }>('amap-poi-search', data)
  poiCache.set(key, { results: res.results, ts: now })
  if (poiCache.size > POI_CACHE_MAX) {
    const oldest = poiCache.keys().next().value
    if (oldest) poiCache.delete(oldest)
  }
  return res
}

export const cloud = {
  ensureUser: (data: { nickname: string; avatarUrl: string }) =>
    call<typeof data, { openid: string }>('ensure-user', data),

  searchPoi: searchPoiCached,

  getWeather: (data: { adcode: string }) =>
    call<typeof data, { weather: WeatherInfo | null }>('amap-weather', data),

  createShareToken: (data: { tripId: string; kind: ShareKind }) =>
    call<typeof data, { token: string }>('create-share-token', data),

  cloneTrip: (data: { sourceTripId: string; token: string }) =>
    call<typeof data, { newTripId: string }>('clone-trip', data),

  cloneTemplate: (data: { templateId: string; startDate: string }) =>
    call<typeof data, { newTripId: string }>('clone-template', data),

  joinCollab: (data: { tripId: string; token: string }) =>
    call<typeof data, { ok: boolean; alreadyOwner?: boolean; alreadyJoined?: boolean }>(
      'join-collab',
      data,
    ),

  updateTrip: (data: { tripId: string; patch: Record<string, unknown> }) =>
    call<typeof data, { ok: boolean }>('update-trip', data),
}
