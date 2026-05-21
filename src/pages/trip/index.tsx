import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { TripProvider, useTripStore } from '../../store/trip-store'
import ItineraryView from '../../views/ItineraryView'
import BudgetView from '../../views/BudgetView'
import PackingView from '../../views/PackingView'
import './index.scss'

type ViewKey = 'itinerary' | 'budget' | 'packing'

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'itinerary', label: '攻略' },
  { key: 'budget', label: '开销' },
  { key: 'packing', label: '清单' },
]

function TripBody() {
  const { state } = useTripStore()
  const [view, setView] = useState<ViewKey>('itinerary')

  if (state.loading) return <View className='trip-empty'>加载中...</View>
  if (state.error) return <View className='trip-empty'>{state.error}</View>
  if (!state.trip) return <View className='trip-empty'>未找到攻略</View>

  const t = state.trip
  return (
    <View className='trip theme-tegami'>
      <View className='trip-head'>
        <Text className='th-name'>{t.name}</Text>
        <Text className='th-meta'>
          {t.startDate} → {t.endDate} · {t.pax} 人
        </Text>
      </View>

      <View className='trip-tabs'>
        {VIEWS.map(v => (
          <View
            key={v.key}
            className={`tt-item ${view === v.key ? 'on' : ''}`}
            onClick={() => setView(v.key)}
          >{v.label}</View>
        ))}
      </View>

      <View className='trip-content'>
        {view === 'itinerary' && <ItineraryView />}
        {view === 'budget' && <BudgetView />}
        {view === 'packing' && <PackingView />}
      </View>
    </View>
  )
}

export default function TripPage() {
  const router = useRouter()
  const tripId = router.params.id || ''
  const [openid, setOpenid] = useState('')

  useEffect(() => {
    // @ts-ignore Taro.cloud
    Taro.cloud.callFunction({
      name: 'ensure-user',
      data: { nickname: '行册旅人', avatarUrl: '' }
    }).then((r: any) => {
      if (r.result && r.result.openid) {
        setOpenid(r.result.openid)
      }
    })
  }, [])

  if (!tripId) return <View className='trip-empty'>缺少 trip id</View>
  if (!openid) return <View className='trip-empty'>登录中...</View>

  return (
    <TripProvider tripId={tripId} openid={openid}>
      <TripBody />
    </TripProvider>
  )
}
