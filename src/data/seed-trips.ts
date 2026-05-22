import type { Trip } from '../types/trip'
import data from './seed-trips.json'

export const SEED_TRIPS: Trip[] = data as unknown as Trip[]

export function isSeedTripId(id: string): boolean {
  return typeof id === 'string' && id.startsWith('seed-')
}

export function getSeedTrip(id: string): Trip | null {
  return SEED_TRIPS.find(t => t._id === id) || null
}
