import { cloud, type WeatherInfo } from './cloud'

const CACHE_TTL = 30 * 60 * 1000  // 30 min
const CACHE_MAX = 50

interface CacheEntry {
  data: WeatherInfo
  ts: number
}

const cache = new Map<string, CacheEntry>()

function putCache(adcode: string, entry: CacheEntry) {
  // 容量满时淘汰最早插入项（Map 保留插入顺序）
  if (!cache.has(adcode) && cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(adcode, entry)
}

export async function loadWeather(adcode: string, force = false): Promise<WeatherInfo | null> {
  const now = Date.now()
  const cached = cache.get(adcode)
  if (cached && (now - cached.ts) >= CACHE_TTL) {
    cache.delete(adcode)  // 过期惰性清理
  }
  if (!force && cached && (now - cached.ts) < CACHE_TTL) {
    return cached.data
  }
  try {
    const res = await cloud.getWeather({ adcode })
    if (res.weather) {
      putCache(adcode, { data: res.weather, ts: now })
      return res.weather
    }
  } catch (e) {
    console.error('[weather]', e)
  }
  return null
}
