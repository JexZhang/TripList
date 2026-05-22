export type SpotType = 'spot' | 'hotel' | 'meal' | 'transport' | 'arrive'

export interface Spot {
  id: string
  type: SpotType
  time?: string          // 'HH:mm' 可选
  name: string
  city?: string
  adcode?: string
  lat?: number
  lng?: number
  price?: number
  note?: string

  // type='hotel'
  nights?: number

  // type='transport'
  mode?: string
  from?: string
  to?: string
}

export interface DayWeather {
  city: string
  cityAdcode: string
  high: number
  low: number
  desc: string
  icon: string
  fetchedAt: number
}

export interface Day {
  id: string             // nanoid
  date: string           // 'YYYY-MM-DD'
  title?: string
  weather?: DayWeather | null
  spots: Spot[]
}

export interface Destination {
  name: string
  adcode: string
  lat: number
  lng: number
}

export interface Collaborator {
  openid: string
  nickname: string
  avatarUrl: string
  role: 'editor'
  joinedAt: number
}

export interface PackingItem {
  id: string
  category: string
  label: string
  checked: boolean
}

export interface Trip {
  _id: string
  _openid: string
  ownerOpenid: string
  ownerNickname?: string
  ownerAvatarUrl?: string

  name: string
  pax: number
  startDate: string      // 'YYYY-MM-DD'
  endDate: string
  destinations: Destination[]

  collaborators: Collaborator[]
  days: Day[]
  packing: PackingItem[]

  createdAt: number
  updatedAt: number
  updatedBy: string
}

// 新建 trip 时未落库前的形状
export type NewTripInput = Omit<Trip, '_id' | '_openid' | 'createdAt' | 'updatedAt' | 'updatedBy'>
