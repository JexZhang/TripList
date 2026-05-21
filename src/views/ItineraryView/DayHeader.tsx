import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import type { Day } from '../../types/trip'
import { loadWeather } from '../../utils/weather'

interface Props {
  day: Day
  onWeatherUpdate: (w: Day['weather']) => void
}

export default function DayHeader({ day, onWeatherUpdate }: Props) {
  const [showCityPicker, setShowCityPicker] = useState(false)

  // 取当日所有城市去重
  const cities = Array.from(
    new Set(day.spots.map(s => s.city).filter(Boolean))
  ) as string[]
  const mainCityAdcode = day.weather?.cityAdcode
    || day.spots.find(s => s.adcode)?.adcode
    || ''

  // 首次进入时拉天气
  useEffect(() => {
    if (!mainCityAdcode) return
    const cached = day.weather
    const stale = !cached || (Date.now() - cached.fetchedAt) > 30 * 60 * 1000
    if (!stale) return
    loadWeather(mainCityAdcode).then(w => {
      if (w) onWeatherUpdate(w)
    })
  }, [mainCityAdcode])

  return (
    <View className='day-header'>
      <View className='dh-cities' onClick={() => cities.length > 1 && setShowCityPicker(v => !v)}>
        {cities.length > 0 ? cities.join(' → ') : '未定城市'}
        {cities.length > 1 && <Text className='dh-arrow'>▾</Text>}
      </View>
      {day.weather && (
        <Text className='dh-weather'>
          {day.weather.desc} {day.weather.low}°-{day.weather.temp}°
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
