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

export const cloud = {
  ensureUser: (data: { nickname: string; avatarUrl: string }) =>
    call<typeof data, { openid: string }>('ensure-user', data),

  searchPoi: (data: { keyword: string; city?: string }) =>
    call<typeof data, { results: PoiResult[] }>('amap-poi-search', data),

  getWeather: (data: { adcode: string }) =>
    call<typeof data, { weather: WeatherInfo | null }>('amap-weather', data),

  createShareToken: (data: { tripId: string; kind: ShareKind }) =>
    call<typeof data, { token: string }>('create-share-token', data),

  cloneTrip: (data: { sourceTripId: string; token: string }) =>
    call<typeof data, { newTripId: string }>('clone-trip', data),

  joinCollab: (data: { tripId: string; token: string }) =>
    call<typeof data, { ok: boolean; alreadyOwner?: boolean; alreadyJoined?: boolean }>(
      'join-collab',
      data,
    ),
}
