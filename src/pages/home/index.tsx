import { useEffect, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import type { Trip } from '../../types/trip'
import { listMyTrips, watchMyTrips, renameTrip, copyTripLocally, smartDeleteTrip } from '../../utils/db'
import { fmtDateShort, fmtCurrency } from '../../utils/format'
import { destinationLabel, tripSummary } from '../../utils/trip-helpers'
import TripActionSheet, { type TripAction } from '../../components/TripActionSheet'
import ShareTypeSheet from '../../components/ShareTypeSheet'
import { buildShareMessage, promptUserToShare } from '../../utils/share'
import type { ShareKind } from '../../utils/cloud'
import './index.scss'

export default function Home() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [actionTrip, setActionTrip] = useState<Trip | null>(null)
  const [shareTrip, setShareTrip] = useState<Trip | null>(null)
  const [sharePayload, setSharePayload] = useState<{ title: string; path: string } | null>(null)
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

    if (action === 'share') {
      setShareTrip(t)
      return
    }

    if (action === 'delete') {
      const isOwner = t._openid === openid
      const collabCount = (t.collaborators || []).length
      const title = isOwner ? (collabCount > 0 ? '删除攻略？' : '删除攻略？') : '退出协作？'
      const content = isOwner
        ? collabCount > 0
          ? `还有 ${collabCount} 位协作者将失去访问，确认删除？`
          : `「${t.name}」将被永久删除`
        : `退出后，「${t.name}」不再出现在你的攻略册中（原作者仍可见）`
      const confirmText = isOwner ? '删除' : '退出'
      const res = await Taro.showModal({ title, content, confirmText, confirmColor: '#c43d3d' })
      if (res.confirm) {
        const action = await smartDeleteTrip(t, openid)
        Taro.showToast({ title: action === 'delete' ? '已删除' : '已退出', icon: 'success' })
      }
      return
    }
  }

  const onSelectShareKind = async (kind: ShareKind) => {
    if (!shareTrip) return
    try {
      const payload = await buildShareMessage(shareTrip._id, shareTrip.name, kind)
      setSharePayload({ title: payload.title, path: payload.path })
      setShareTrip(null)
      promptUserToShare()
    } catch (e) {
      console.error('[share]', e)
      Taro.showToast({ title: '生成分享失败', icon: 'error' })
    }
  }

  useShareAppMessage(() => {
    if (sharePayload) {
      return {
        title: sharePayload.title,
        path: sharePayload.path,
      }
    }
    return {
      title: '行册 · 旅行攻略册',
      path: '/pages/home/index',
    }
  })

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

      <ShareTypeSheet
        open={!!shareTrip}
        onClose={() => setShareTrip(null)}
        onSelect={onSelectShareKind}
      />
    </View>
  )
}
