import { useEffect, useState } from 'react'
import { View, Text, Button, Image } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import type { Trip } from '../../types/trip'
import { listMyTrips, renameTrip, copyTripLocally, smartDeleteTrip } from '../../utils/db'
import { SEED_TRIPS, isSeedTripId } from '../../data/seed-trips'
import { useMe } from '../../store/me-store'
import { fmtDateShort } from '../../utils/format'
import { tripSummary } from '../../utils/trip-helpers'
import TripActionSheet, { type TripAction } from '../../components/TripActionSheet'
import ShareTypeSheet from '../../components/ShareTypeSheet'
import AILoadingBar, { type AIBarStatus } from '../../components/AILoadingBar'
import { buildShareMessage, shareRef, resetShareRef } from '../../utils/share'
import type { ShareKind } from '../../utils/cloud'
import './index.scss'

export default function Home() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const { me } = useMe()
  const openid = me?.openid || ''
  const [actionTrip, setActionTrip] = useState<Trip | null>(null)
  const [shareTrip, setShareTrip] = useState<Trip | null>(null)
  const [shareReady, setShareReady] = useState({ readonly: false, collab: false })

  // 初次拉取
  useEffect(() => {
    if (!openid) return
    let cancelled = false
    listMyTrips(openid)
      .then(list => { if (!cancelled) { setTrips([...SEED_TRIPS, ...list]); setLoading(false) } })
      .catch(e => {
        console.error('[home] listMyTrips failed', e)
        Taro.showToast({ title: '加载失败', icon: 'none' })
        if (!cancelled) { setTrips([...SEED_TRIPS]); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [openid])

  // 从 new-trip 返回时刷新一次
  useDidShow(() => {
    if (!openid) return
    Taro.showNavigationBarLoading()
    listMyTrips(openid)
      .then(list => setTrips([...SEED_TRIPS, ...list]))
      .finally(() => Taro.hideNavigationBarLoading())
  })

  // AI 任务实时刷新: 只要列表里还有 generating 的 trip, 每 5s 轮询一次
  // (home 没用 trip watch, 需要这个兗底; trip 一切完后轮询自动停)
  useEffect(() => {
    if (!openid) return
    const hasGenerating = trips.some(t => t.aiStatus === 'generating')
    if (!hasGenerating) return
    const timer = setInterval(() => {
      listMyTrips(openid)
        .then(list => setTrips([...SEED_TRIPS, ...list]))
        .catch(e => console.error('[home] ai polling failed', e))
    }, 5000)
    return () => clearInterval(timer)
  }, [openid, trips])

  const handleAction = async (action: TripAction) => {
    if (!actionTrip) return
    const t = actionTrip
    setActionTrip(null)

    if (action === 'copy') {
      const newId = await copyTripLocally(t._id, openid, me ? { nickname: me.nickname, avatarUrl: me.avatarUrl } : undefined)
      Taro.showToast({ title: '已复制', icon: 'success', duration: 600 })
      setTimeout(() => {
        Taro.hideToast()
        Taro.navigateTo({ url: `/pages/trip/index?id=${newId}` })
      }, 650)
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
        setTrips(prev => prev.map(x => x._id === t._id ? { ...x, name: newName } : x))
        Taro.showToast({ title: '已重命名', icon: 'success' })
      }
      return
    }

    if (action === 'share') {
      openShareFor(t)
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
        setTrips(prev => prev.filter(x => x._id !== t._id))
        Taro.showToast({ title: action === 'delete' ? '已删除' : '已退出', icon: 'success' })
      }
      return
    }
  }

  const prepareShare = async (kind: ShareKind) => {
    if (!shareTrip) return
    try {
      const payload = await buildShareMessage(shareTrip._id, shareTrip.name, kind)
      shareRef.byKind[kind] = { title: payload.title, path: payload.path }
      setShareReady(prev => ({ ...prev, [kind]: true }))
    } catch (e) {
      console.error('[share]', e)
      Taro.showToast({ title: '生成分享失败', icon: 'error' })
    }
  }

  // 打开 sheet 时重置(切换不同 trip 时,避免上次的 payload 残留)
  const openShareFor = (trip: Trip) => {
    resetShareRef(trip.name)
    setShareReady({ readonly: false, collab: false })
    setShareTrip(trip)
  }

  useShareAppMessage((options) => {
    const kind = (options as { target?: { dataset?: { kind?: ShareKind } } })?.target?.dataset?.kind
    const picked = kind ? shareRef.byKind[kind] : null
    return picked || { title: '行册 · 旅行攻略册', path: '/pages/home/index' }
  })

  return (
    <View className='home theme-tegami'>
      <View className='home-head'>
        <Text className='home-brand'>行册</Text>
        <Text className='home-sub'>你的旅行，值得被好好记录</Text>
      </View>

      {loading && <View className='home-empty'>加载中...</View>}

      {!loading && trips.length === 0 && (
        <View className='home-empty'>
          <Text className='home-empty-text'>还没有攻略</Text>
          <Text className='home-empty-hint'>点下面"新建攻略"开启第一段旅程</Text>
        </View>
      )}

      <View className='home-list'>
        {trips.map(t => {
          const isSeed = isSeedTripId(t._id)
          const isCollab = !isSeed && t._openid !== openid
          return (
            <View
              key={t._id}
              className='trip-card'
              onClick={() => Taro.navigateTo({ url: `/pages/trip/index?id=${t._id}` })}
              onLongPress={() => setActionTrip(t)}
            >
              {!isCollab && !isSeed && t.aiStatus && (
                <AILoadingBar
                  status={t.aiStatus as AIBarStatus}
                  onTap={() => Taro.navigateTo({ url: `/pages/trip/index?id=${t._id}` })}
                />
              )}
              {isSeed && <View className='tc-badge tc-badge-seed'>示例</View>}
              {isCollab && <View className='tc-badge'>协作</View>}
              <Text className='tc-name'>{t.name}</Text>
              <Text className='tc-meta'>
                {fmtDateShort(t.startDate)} → {fmtDateShort(t.endDate)} · {tripSummary(t.startDate, t.endDate, t.pax)}
              </Text>
              <View className='tc-dest'>
                {t.destinations.map((d, i) => (
                  <Text key={`${d.adcode || 'na'}-${i}`} className='tc-dest-chip'>{d.name}</Text>
                ))}
              </View>
              {isCollab && (
                <View className='tc-owner'>
                  {t.ownerAvatarUrl
                    ? <Image className='tc-owner-avatar' src={t.ownerAvatarUrl} mode='aspectFill' />
                    : <View className='tc-owner-avatar tc-owner-avatar-fallback'>
                        <Text>{(t.ownerNickname || '?').slice(0, 1)}</Text>
                      </View>
                  }
                  <Text className='tc-owner-name'>来自 {t.ownerNickname || '未知'}</Text>
                </View>
              )}
            </View>
          )
        })}
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
        actions={actionTrip && isSeedTripId(actionTrip._id) ? ['copy'] : undefined}
        onSelect={handleAction}
        onClose={() => setActionTrip(null)}
      />

      <ShareTypeSheet
        open={!!shareTrip}
        onClose={() => setShareTrip(null)}
        prepare={prepareShare}
        ready={shareReady}
      />
    </View>
  )
}
