import { useEffect, useState } from 'react'
import { ScrollView, View, Text } from '@tarojs/components'
import type { Day, Destination, DayWeather } from '../../types/trip'
import { loadWeather } from '../../utils/weather'

interface Props {
  day: Day
  fallbackDestination?: Destination | null
  onWeatherUpdate: (w: Day['weather']) => void
}

// 单日最多展示 3 个城市的天气；超出一屏可在天气条内左右滑动查看。
const MAX_CITIES = 3
const WEATHER_TTL = 30 * 60 * 1000

interface CityRef {
  city: string
  adcode: string
}

export default function DayHeader({ day, fallbackDestination }: Props) {
  const [cityWeathers, setCityWeathers] = useState<Record<string, DayWeather | null>>({})

  // 当日所有城市按出现顺序去重，最多取 MAX_CITIES 个；无城市时回退到目的地
  const cityRefs: CityRef[] = []
  const seen = new Set<string>()
  for (const s of day.spots) {
    if (!s.city || seen.has(s.city)) continue
    seen.add(s.city)
    cityRefs.push({ city: s.city, adcode: s.adcode || '' })
    if (cityRefs.length >= MAX_CITIES) break
  }
  if (cityRefs.length === 0 && fallbackDestination?.name) {
    cityRefs.push({ city: fallbackDestination.name, adcode: fallbackDestination.adcode || '' })
  }

  // 加载每个城市的天气（loadWeather 自带 30min 缓存）
  const adcodeKey = cityRefs.map((c) => c.adcode).join(',')
  useEffect(() => {
    cityRefs.forEach((c) => {
      if (!c.adcode) return
      const cached = cityWeathers[c.adcode]
      if (cached && Date.now() - cached.fetchedAt < WEATHER_TTL) return
      loadWeather(c.adcode, false).then((w) => {
        if (w) setCityWeathers((prev) => ({ ...prev, [c.adcode]: w }))
      })
    })
    // 仅在城市集合变化时重新拉取；cityWeathers 仅用于读缓存，不入依赖避免反复触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adcodeKey])

  if (cityRefs.length === 0) {
    return (
      <View className='day-header'>
        <Text className='dh-empty'>未定城市</Text>
      </View>
    )
  }

  // 横向可滑动的天气条：每个城市一项「城市 天气描述 低°–高°」
  return (
    <ScrollView scrollX showScrollbar={false} className='day-header'>
      <View className='dh-track'>
        {cityRefs.map((c) => {
          const w = cityWeathers[c.adcode]
          return (
            <Text key={c.city} className='dh-city'>
              {w ? `${c.city} ${w.desc} ${w.low}°–${w.high}°` : c.city}
            </Text>
          )
        })}
      </View>
    </ScrollView>
  )
}
