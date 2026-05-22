import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import type { Day, Destination } from '../../types/trip'
import { loadWeather } from '../../utils/weather'

interface Props {
  day: Day
  fallbackDestination?: Destination | null
  onWeatherUpdate: (w: Day['weather']) => void
}

export default function DayHeader({ day, fallbackDestination, onWeatherUpdate }: Props) {
  const [showCityPicker, setShowCityPicker] = useState(false)

  // 取当日所有城市去重
  const cities = Array.from(
    new Set(day.spots.map(s => s.city).filter(Boolean))
  ) as string[]

  // 优先跟随当日 spots 的首个 adcode；若当日还没添加地点，回退到攻略目的地
  const spotAdcode = day.spots.find(s => s.adcode)?.adcode || ''
  const mainCityAdcode = spotAdcode || fallbackDestination?.adcode || ''

  // 头部展示用的城市文案（spots 优先；无 spots 时显示目的地占位）
  const headerCities = cities.length > 0
    ? cities
    : fallbackDestination?.name ? [fallbackDestination.name] : []

  useEffect(() => {
    if (!mainCityAdcode) return
    const cached = day.weather
    const sameCity = cached?.cityAdcode === mainCityAdcode
    const fresh = sameCity && cached && (Date.now() - cached.fetchedAt) < 30 * 60 * 1000
    if (fresh) return
    loadWeather(mainCityAdcode, !sameCity).then(w => {
      if (w) onWeatherUpdate(w)
    })
  }, [mainCityAdcode])

  return (
    <View className='day-header'>
      <View className='dh-cities' onClick={() => cities.length > 1 && setShowCityPicker(v => !v)}>
        {headerCities.length > 0 ? headerCities.join(' → ') : '未定城市'}
        {cities.length > 1 && <Text className='dh-arrow'>▾</Text>}
      </View>
      {day.weather && (
        <Text className='dh-weather'>
          {day.weather.desc} {day.weather.low}°-{day.weather.high}°
        </Text>
      )}
      {showCityPicker && (
        <View className='dh-city-picker'>
          {cities.map(c => {
            const spot = day.spots.find(s => s.city === c && s.adcode)
            const adcode = spot?.adcode
            if (!adcode) return null
            return (
              <View
                key={c}
                className='dh-city-item'
                onClick={async () => {
                  const w = await loadWeather(adcode, true)
                  if (w) onWeatherUpdate(w)
                  setShowCityPicker(false)
                }}
              >{c}</View>
            )
          })}
        </View>
      )}
    </View>
  )
}
