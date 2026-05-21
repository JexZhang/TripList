import Taro from '@tarojs/taro'

export interface DayOverride {
  hotelPrice?: number
  meals?: number
  tickets?: number
}

export interface PackingItem {
  id: string
  category: string
  label: string
  checked: boolean
}

export interface TripOverride {
  days: Record<number, DayOverride>
  packing: PackingItem[]
  transport: Record<string, number>
}

const KEY = (tripId: string): string => `trip-override::${tripId}`

export function loadOverride(tripId: string): TripOverride {
  const raw = Taro.getStorageSync(KEY(tripId)) as TripOverride | ''
  if (raw && typeof raw === 'object') {
    return {
      days: raw.days || {},
      packing: raw.packing || [],
      transport: raw.transport || {},
    }
  }
  return { days: {}, packing: [], transport: {} }
}

export function saveOverride(tripId: string, ov: TripOverride): void {
  Taro.setStorageSync(KEY(tripId), ov)
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}
