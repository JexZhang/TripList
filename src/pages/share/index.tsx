import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import { cloud, type ShareKind } from '../../utils/cloud'
import { fmtDateShort } from '../../utils/format'
import { tripSummary } from '../../utils/trip-helpers'
import { useThemeClass } from '../../utils/theme-class'
import { useMe } from '../../store/me-store'
import type { Trip } from '../../types/trip'
import './index.scss'

export default function SharePage() {
  const router = useRouter()
  const token = router.params.token || ''
  const kind = (router.params.kind as ShareKind) || 'readonly'
  const tripId = router.params.tripId || ''

  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const themeCls = useThemeClass('share')
  const { consented, reopenPrivacy } = useMe()
  const [acting, setActing] = useState(false)

  // 阻止转发泄漏 token
  useShareAppMessage(() => ({
    title: '行迹 · 旅行攻略册',
    path: '/pages/home/index',
  }))

  useEffect(() => {
    if (!tripId || !token) {
      setError('链接不完整')
      setLoading(false)
      return
    }
    // 两种类型都通过 token 云函数获取预览（接收者不是 owner/协作者，无法直读）
    const fetchTrip = kind === 'readonly'
      ? cloud.previewShareTrip({ sourceTripId: tripId, token })
      : cloud.previewCollabTrip({ tripId, token })
    fetchTrip.then(r => {
      const t = r.trip as unknown as Trip
      if (!t) setError('攻略不存在或已被删除')
      else setTrip(t)
      setLoading(false)
    }).catch(e => {
      console.error('[share] fetch trip', e)
      setError((e as Error)?.message || '加载失败')
      setLoading(false)
    })
  }, [tripId, token, kind])

  const accept = async () => {
    if (!trip || acting) return
    if (!consented) {
      reopenPrivacy()
      return
    }
    setActing(true)
    try {
      if (kind === 'readonly') {
        const res = await cloud.cloneTrip({ sourceTripId: trip._id, token })
        await Taro.showToast({ title: '已复制', icon: 'success', duration: 1200 })
        setTimeout(() => Taro.redirectTo({ url: `/pages/trip/index?id=${res.newTripId}` }), 800)
      } else {
        const res = await cloud.joinCollab({ tripId: trip._id, token })
        if (res.alreadyOwner) {
          await Taro.showToast({ title: '这是你自己的攻略', icon: 'none' })
        } else if (res.alreadyJoined) {
          await Taro.showToast({ title: '你已加入', icon: 'none' })
        } else {
          await Taro.showToast({ title: '已加入协作', icon: 'success' })
        }
        setTimeout(() => Taro.redirectTo({ url: `/pages/trip/index?id=${trip._id}` }), 800)
      }
    } catch (e) {
      console.error('[share accept]', e)
      const msg = (e as Error).message || '操作失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setActing(false)
    }
  }

  if (loading) return <View className='share-empty'>加载中...</View>
  if (error) return <View className='share-empty'>{error}</View>
  if (!trip) return <View className='share-empty'>未找到攻略</View>

  return (
    <View className={themeCls}>
      <View className='share-head'>
        <Text className='sh-label'>{kind === 'readonly' ? '一份只读攻略' : '协作邀请'}</Text>
      </View>

      <View className='share-card'>
        <Text className='sc-name'>{trip.name}</Text>
        <Text className='sc-meta'>
          {fmtDateShort(trip.startDate)} → {fmtDateShort(trip.endDate)} · {tripSummary(trip.startDate, trip.endDate, trip.pax)}
        </Text>
        <View className='sc-dest'>
          {trip.destinations.map(d => (
            <Text key={d.adcode} className='sc-dest-chip'>{d.name}</Text>
          ))}
        </View>
      </View>

      <View className='share-foot'>
        <View
          className={`share-btn ${acting || !consented ? 'disabled' : ''}`}
          onClick={accept}
        >{kind === 'readonly' ? '复制到我的攻略册' : '加入协作'}</View>
        <Text className='share-back' onClick={() => Taro.reLaunch({ url: '/pages/home/index' })}>
          先回首页看看
        </Text>
      </View>
    </View>
  )
}
