import { useEffect, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import type { Trip } from '../../types/trip'
import { listMyTrips, watchMyTrips, renameTrip, deleteTrip, copyTripLocally } from '../../utils/db'
import { fmtDateShort, fmtCurrency } from '../../utils/format'
import { destinationLabel, tripSummary } from '../../utils/trip-helpers'
import TripActionSheet, { type TripAction } from '../../components/TripActionSheet'
import './index.scss'

export default function Home() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [actionTrip, setActionTrip] = useState<Trip | null>(null)
  const [openid, setOpenid] = useState<string>('')

  // 获取当前用户 openid（通过 ensure-user 同步）
  useEffect(() => {
    // 调用 ensure-user 拿 openid
    // @ts-ignore Taro.cloud
    Taro.cloud.callFunction({
      name: 'ensure-user',
      data: { nickname: '行册旅人', avatarUrl: '' }
    }).then((r: any) => {
      setOpenid(r.result.openid)
    }).catch(e => {
      console.error('ensure-user failed', e)
    })
  }, [])

  // 初次拉 + watch
  useEffect(() => {
    if (!openid) return
    let watcher: { close: () => void } | null = null
    listMyTrips(openid).then(list => {
      setTrips(list)
      setLoading(false)
    })
    watcher = watchMyTrips(openid, list => {
      setTrips(list)
      setLoading(false)
    })
    return () => { watcher?.close() }
  }, [openid])

  // 从 new-trip 返回时刷新一次
  useDidShow(() => {
    if (openid) listMyTrips(openid).then(setTrips)
  })

  const handleAction = async (action: TripAction) => {
    if (!actionTrip) return
    const t = actionTrip
    setActionTrip(null)

    if (action === 'copy') {
      await copyTripLocally(t._id, openid)
      Taro.showToast({ title: '已复制', icon: 'success' })
      return
    }

    if (action === 'rename') {
      const res = await Taro.showModal({
        title: '重命名',
        editable: true,
        placeholderText: '请输入新的攻略名称',
        content: t.name,
      })
      if (res.confirm) {
        const newName = (res.content || '').trim()
        if (!newName) {
          Taro.showToast({ title: '名称不能为空', icon: 'none' })
          return
        }
        if (newName === t.name) return
        await renameTrip(t._id, newName, openid)
        Taro.showToast({ title: '已重命名', icon: 'success' })
      }
      return
    }

    if (action === 'delete') {
      const res = await Taro.showModal({
        title: '删除攻略？',
        content: `「${t.name}」将被永久删除，无法恢复`,
        confirmText: '删除',
        confirmColor: '#c43d3d',
      })
      if (res.confirm) {
        await deleteTrip(t._id)
        Taro.showToast({ title: '已删除', icon: 'success' })
      }
      return
    }

    if (action === 'share') {
      Taro.showToast({ title: '分享待 Phase 5', icon: 'none' })
      return
    }
  }

  return (
    <View className='home theme-tegami'>
      <View className='home-head'>
        <Text className='home-brand'>行册</Text>
        <Text className='home-sub'>旅行攻略 · 清单 · 地图</Text>
      </View>

      {loading && <View className='home-empty'>加载中...</View>}

      {!loading && trips.length === 0 && (
        <View className='home-empty'>
          <Text className='home-empty-text'>还没有攻略</Text>
          <Text className='home-empty-hint'>点下面"新建攻略"开启第一段旅程</Text>
        </View>
      )}

      <View className='home-list'>
        {trips.map(t => (
          <View
            key={t._id}
            className='trip-card'
            onClick={() => Taro.navigateTo({ url: `/pages/trip/index?id=${t._id}` })}
            onLongPress={() => setActionTrip(t)}
          >
            <Text className='tc-name'>{t.name}</Text>
            <Text className='tc-meta'>
              {fmtDateShort(t.startDate)} → {fmtDateShort(t.endDate)} · {tripSummary(t.startDate, t.endDate, t.pax)}
            </Text>
            <View className='tc-dest'>
              {t.destinations.map(d => (
                <Text key={d.adcode} className='tc-dest-chip'>{d.name}</Text>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View className='home-foot'>
        <Button
          className='home-new-btn'
          onClick={() => Taro.navigateTo({ url: '/pages/new-trip/index' })}
        >
          + 新建攻略
        </Button>
      </View>

      <TripActionSheet
        open={!!actionTrip}
        tripName={actionTrip?.name || ''}
        onSelect={handleAction}
        onClose={() => setActionTrip(null)}
      />
    </View>
  )
}
