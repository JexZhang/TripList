export interface Spot {
  id: string
  name: string
  time: string
  lat: number
  lng: number
  type: 'arrive' | 'hotel' | 'spot' | 'meal' | string
  note: string
  photos: string[]
}

export interface Hotel {
  name: string
  price: number
  nights: number
  note: string
}

export interface Weather {
  temp: number
  low: number
  desc: string
  icon: string
}

export interface Day {
  id: number
  date: string
  title: string
  city: string
  cityLabel: string
  weather: Weather
  hotel: Hotel | null
  meals: number
  tickets: number
  spots: Spot[]
}

export interface TransportSegment {
  id: string
  from: string
  to: string
  mode: string
  price: number
  duration: string
  icon: string
  category: string
}

export interface TripData {
  pax: number
  currency: string
  meta: {
    title: string
    dateRange: string
    edition: string
  }
  days: Day[]
  transport?: TransportSegment[]
}

export interface Trip {
  id: string
  name: string
  data: TripData
}

export interface TripStore {
  version: number
  savedAt: string
  store: {
    currentId: string
    trips: Trip[]
  }
}
