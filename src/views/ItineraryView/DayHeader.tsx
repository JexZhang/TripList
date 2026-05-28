import { useEffect, useState, useRef, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Day, Destination, DayWeather } from '../../types/trip'
import { loadWeather } from '../../utils/weather'

interface Props {
  day: Day
  fallbackDestination?: Destination | null
  onWeatherUpdate: (w: Day['weather']) => void
}

interface CityWeather {
  city: string
  adcode: string
  weather: DayWeather | null
}

export default function DayHeader({ day, fallbackDestination, onWeatherUpdate }: Props) {
  const [visibleCount, setVisibleCount] = useState(3)
  const containerRef = useRef<any>(null)
  const measureRef = useRef<any>(null)
  const [cityWeathers, setCityWeathers] = useState<Record<string, DayWeather | null>>({})

  // 取当日所有城市去重
  const cities = Array.from(
    new Set(day.spots.map(s => s.city).filter(Boolean))
  ) as string[]

  // 构建城市+天气数据
  const cityWeatherList: CityWeather[] = cities.length > 0
    ? cities.map(c => {
        const spot = day.spots.find(s => s.city === c && s.adcode)
        return {
          city: c,
          adcode: spot?.adcode || '',
          weather: null,
        }
      })
    : fallbackDestination?.name
      ? [{ city: fallbackDestination.name, adcode: fallbackDestination.adcode || '', weather: null }]
      : []

  // 加载所有城市的天气
  useEffect(() => {
    cityWeatherList.forEach((cw) => {
      if (!cw.adcode) return
      const cached = cityWeathers[cw.adcode]
      const fresh = cached && (Date.now() - cached.fetchedAt) < 30 * 60 * 1000
      if (fresh) return
      
      loadWeather(cw.adcode, false).then(w => {
        if (w) {
          setCityWeathers(prev => ({ ...prev, [cw.adcode]: w }))
        }
      })
    })
  }, [cityWeatherList.map(c => c.adcode).join(',')])

  // 测量文本宽度并计算可显示数量
  const measureAndFit = useCallback(() => {
    if (!measureRef.current || !containerRef.current || cityWeatherList.length === 0) return

    // 使用 Taro.createSelectorQuery 测量容器和文本宽度
    const query = Taro.createSelectorQuery()
    query.select('.dh-measure-container').boundingClientRect()
    query.select('.dh-measure-item').boundingClientRect()
    query.exec((res) => {
      if (!res || !res[0] || !res[1]) return
      const containerWidth = res[0].width
      const itemWidth = res[1].width
      
      // 计算最多能显示几个
      const maxCount = Math.floor(containerWidth / itemWidth)
      setVisibleCount(Math.max(1, Math.min(maxCount, cityWeatherList.length)))
    })
  }, [cityWeatherList])

  // 初次渲染和窗口变化时测量
  useEffect(() => {
    const timer = setTimeout(measureAndFit, 100)
    return () => clearTimeout(timer)
  }, [cityWeatherList, measureAndFit])

  // 生成显示文案
  const displayCities = cityWeatherList.slice(0, visibleCount)
  const weather = day.weather
  
  // 构建每个城市+天气的文本
  const cityItems = displayCities.map(cw => {
    const cityWeather = cityWeathers[cw.adcode]
    const weatherText = cityWeather ? `${cityWeather.desc} ${cityWeather.low}°–${cityWeather.high}°` : ''
    return weatherText ? `${cw.city} · ${weatherText}` : cw.city
  })

  const fullText = cityItems.join('  ')

  if (cityWeatherList.length === 0) {
    return (
      <View className='day-header'>
        <Text className='dh-empty'>未定城市</Text>
      </View>
    )
  }

  return (
    <>
      {/* 隐藏的测量容器 */}
      <View className='dh-measure-container' ref={measureRef}>
        <Text className='dh-measure-item'>
          {cityWeatherList[0].city} · {weather ? `${weather.desc} ${weather.low}°–${weather.high}°` : ''}
        </Text>
      </View>

      <View className='day-header' ref={containerRef}>
        <Text className='dh-content'>{fullText}</Text>
      </View>
    </>
  )
}
