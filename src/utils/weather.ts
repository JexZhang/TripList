import { cloud, type WeatherInfo } from './cloud'

const CACHE_TTL = 30 * 60 * 1000  // 30 min

interface CacheEntry {
  data: WeatherInfo
  ts: number
}

const cache = new Map<string, CacheEntry>()

export async function loadWeather(adcode: string, force = false): Promise<WeatherInfo | null> {
  const now = Date.now()
  const cached = cache.get(adcode)
  if (!force && cached && (now - cached.ts) < CACHE_TTL) {
    return cached.data
  }
  try {
    const res = await cloud.getWeather({ adcode })
    if (res.weather) {
      cache.set(adcode, { data: res.weather, ts: now })
      return res.weather
    }
  } catch (e) {
    console.error('[weather]', e)
  }
  return null
}
