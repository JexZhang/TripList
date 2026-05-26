import { useEffect, useState } from 'react'
import { View } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import type { Trip } from '../../types/trip'
import { listMyTrips, renameTrip, copyTripLocally, smartDeleteTrip, updateTrip } from '../../utils/db'
import { SEED_TRIPS, isSeedTripId } from '../../data/seed-trips'
import { useMe } from '../../store/me-store'
import { useTheme } from '../../store/theme-store'
import { useThemeClass } from '../../utils/theme-class'
import TripActionSheet, { type TripAction } from '../../components/TripActionSheet'
import ShareTypeSheet from '../../components/ShareTypeSheet'
import CoverPicker from '../../components/CoverPicker'
import { buildShareMessage, shareRef, resetShareRef } from '../../utils/share'
import type { ShareKind } from '../../utils/cloud'
import HomeTegami from './HomeTegami'
import HomeMagazine from './HomeMagazine'
import HomePostcard from './HomePostcard'
import HomeMinimal from './HomeMinimal'
import type { HomeViewProps } from './shared'
import './index.scss'

export default function Home() {
  const themeCls = useThemeClass()
  const { theme } = useTheme()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const { me } = useMe()
  const openid = me?.openid || ''
  const [actionTrip, setActionTrip] = useState<Trip | null>(null)
  const [shareTrip, setShareTrip] = useState<Trip | null>(null)
  const [shareReady, setShareReady] = useState({ readonly: false, collab: false })
  const [coverTrip, setCoverTrip] = useState<Trip | null>(null)

  useEffect(() => {
    if (!openid) return
    let cancelled = false
    listMyTrips(openid)
      .then((list) => { if (!cancelled) { setTrips([...SEED_TRIPS, ...list]); setLoading(false) } })
      .catch((e) => {
        console.error('[home] listMyTrips failed', e)
        Taro.showToast({ title: '加载失败', icon: 'none' })
        if (!cancelled) { setTrips([...SEED_TRIPS]); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [openid])

  useDidShow(() => {
    if (!openid) return
    Taro.showNavigationBarLoading()
    listMyTrips(openid)
      .then((list) => setTrips([...SEED_TRIPS, ...list]))
      .finally(() => Taro.hideNavigationBarLoading())
  })

  useEffect(() => {
    if (!openid) return
    const hasGenerating = trips.some((t) => t.aiStatus === 'generating')
    if (!hasGenerating) return
    const timer = setInterval(() => {
      listMyTrips(openid)
        .then((list) => setTrips([...SEED_TRIPS, ...list]))
        .catch((e) => console.error('[home] ai polling failed', e))
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
      setTimeout(() => { Taro.hideToast(); Taro.navigateTo({ url: `/pages/trip/index?id=${newId}` }) }, 650)
      return
    }
    if (action === 'rename') {
      const res = await Taro.showModal({
        title: '重命名',
        // @ts-ignore wechat-specific editable
        editable: true,
        placeholderText: '请输入新的攻略名称', content: t.name,
      } as Parameters<typeof Taro.showModal>[0])
      if (res.confirm) {
        const newName = ((res as unknown as { content?: string }).content || '').trim()
        if (!newName) { Taro.showToast({ title: '名称不能为空', icon: 'none' }); return }
        if (newName === t.name) return
        await renameTrip(t._id, newName, openid)
        setTrips((prev) => prev.map((x) => x._id === t._id ? { ...x, name: newName } : x))
        Taro.showToast({ title: '已重命名', icon: 'success' })
      }
      return
    }
    if (action === 'share') { openShareFor(t); return }
    if (action === 'delete') {
      const isOwner = t._openid === openid
      const collabCount = (t.collaborators || []).length
      const title = isOwner ? '删除攻略？' : '退出协作？'
      const content = isOwner
        ? (collabCount > 0 ? `还有 ${collabCount} 位协作者将失去访问，确认删除？` : `「${t.name}」将被永久删除`)
        : `退出后，「${t.name}」不再出现在你的攻略册中（原作者仍可见）`
      const confirmText = isOwner ? '删除' : '退出'
      const res = await Taro.showModal({ title, content, confirmText, confirmColor: '#c43d3d' })
      if (res.confirm) {
        const performed = await smartDeleteTrip(t, openid)
        setTrips((prev) => prev.filter((x) => x._id !== t._id))
        Taro.showToast({ title: performed === 'delete' ? '已删除' : '已退出', icon: 'success' })
      }
    }
  }

  const prepareShare = async (kind: ShareKind) => {
    if (!shareTrip) return
    try {
      const payload = await buildShareMessage(shareTrip._id, shareTrip.name, kind)
      shareRef.byKind[kind] = { title: payload.title, path: payload.path }
      setShareReady((prev) => ({ ...prev, [kind]: true }))
    } catch (e) {
      console.error('[share]', e)
      Taro.showToast({ title: '生成分享失败', icon: 'error' })
    }
  }

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

  const handleCoverPicked = async (fileIDOrNull: string | null) => {
    if (!coverTrip) return
    const target = coverTrip
    setCoverTrip(null)
    try {
      await updateTrip(target._id, { coverUrl: fileIDOrNull }, openid)
      setTrips((prev) => prev.map((x) => x._id === target._id ? { ...x, coverUrl: fileIDOrNull } : x))
    } catch (e) {
      console.error('[home] save cover failed', e)
      Taro.showToast({ title: '保存封面失败', icon: 'none' })
    }
  }

  const props: HomeViewProps = {
    trips,
    loading,
    openid,
    onOpenTrip: (t) => Taro.navigateTo({ url: `/pages/trip/index?id=${t._id}` }),
    onLongPressTrip: (t) => setActionTrip(t),
    onNewTrip: () => Taro.navigateTo({ url: '/pages/new-trip/index' }),
    onAITrip: () => Taro.navigateTo({ url: '/pages/new-trip/index?openAI=1' }),
    onCoverLongPress: (t) => {
      if (isSeedTripId(t._id)) {
        Taro.showToast({ title: '示例攻略不能改封面', icon: 'none' })
        return
      }
      setCoverTrip(t)
    },
  }

  return (
    <View className={themeCls}>
      {theme === 'tegami'   && <HomeTegami   {...props} />}
      {theme === 'magazine' && <HomeMagazine {...props} />}
      {theme === 'postcard' && <HomePostcard {...props} />}
      {theme === 'minimal'  && <HomeMinimal  {...props} />}

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
      <CoverPicker
        open={!!coverTrip}
        openid={openid}
        onPicked={handleCoverPicked}
        onClose={() => setCoverTrip(null)}
      />
    </View>
  )
}
