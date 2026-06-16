import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import type { Trip } from '../../types/trip'
import { listMyTrips, renameTrip, copyTripLocally, smartDeleteTrip, updateTrip } from '../../utils/db'
import { SEED_TRIPS, isSeedTripId } from '../../data/seed-trips'
import { getTripPhase } from '../../utils/trip-phase'
import { useMe } from '../../store/me-store'
import { useTheme } from '../../store/theme-store'
import { useThemeClass } from '../../utils/theme-class'
import TripActionSheet, { type TripAction } from '../../components/TripActionSheet'
import ShareTypeSheet from '../../components/ShareTypeSheet'
import CoverPicker from '../../components/CoverPicker'
import AIInterview, { type AIInterviewSubmit } from '../../components/AIInterview'
import { createTripAndFireAI } from '../../utils/ai-task'
import { buildShareMessage, shareRef, resetShareRef } from '../../utils/share'
import type { ShareKind } from '../../utils/cloud'
import HomeTegami from './HomeTegami'
import HomeMagazine from './HomeMagazine'
import HomePostcard from './HomePostcard'
import HomeMinimal from './HomeMinimal'
import type { HomeViewProps } from './shared'
import './index.scss'

const STORAGE_KEY = 'home-trips-cache'  // 仅缓存网络列表部分（不含种子）

export default function Home() {
  const themeCls = useThemeClass()
  const { theme } = useTheme()
  // A2/A3：种子立即可见；命中缓存则一并显示，loading 仅表示「用户真实行程未就绪」
  const [trips, setTrips] = useState<Trip[]>(() => {
    try {
      const cached = Taro.getStorageSync(STORAGE_KEY) as Trip[] | ''
      if (Array.isArray(cached) && cached.length) return [...SEED_TRIPS, ...cached]
    } catch { /* ignore */ }
    return [...SEED_TRIPS]
  })
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const cached = Taro.getStorageSync(STORAGE_KEY)
      return !(Array.isArray(cached) && cached.length)
    } catch { return true }
  })
  const { me, refreshQuota } = useMe()
  const openid = me?.openid || ''
  const [actionTrip, setActionTrip] = useState<Trip | null>(null)
  const [shareTrip, setShareTrip] = useState<Trip | null>(null)
  const [shareReady, setShareReady] = useState({ readonly: false, collab: false })
  const [coverTrip, setCoverTrip] = useState<Trip | null>(null)
  const [interviewOpen, setInterviewOpen] = useState(false)

  const openidRef = useRef(openid)
  useEffect(() => { openidRef.current = openid }, [openid])
  const didInitialShowRef = useRef(false)

  // A1：listMyTrips 服务端自取 OPENID，客户端无需等 ensure-user → 挂载即可并行发起
  const loadTrips = useCallback(async () => {
    try {
      const list = await listMyTrips(openidRef.current)
      setTrips([...SEED_TRIPS, ...list])
      setLoading(false)
      try { Taro.setStorageSync(STORAGE_KEY, list) } catch { /* ignore storage full */ }
    } catch (e) {
      console.error('[home] listMyTrips failed', e)
      setLoading(false)
    }
  }, [])

  // 挂载即并行发起（不等 openid）
  useEffect(() => { void loadTrips() }, [loadTrips])

  // A4：useDidShow 在首次显示也会触发，跳过紧跟挂载的那一次，避免首进双拉；
  // 之后每次返回首页都刷新（不再节流，确保能看到详情页/他端的最新改动）
  useDidShow(() => {
    if (!didInitialShowRef.current) { didInitialShowRef.current = true; return }
    void loadTrips()
  })

  // A5：仅在「有生成中的行程」翻转时开/关定时器，不再因 trips 变化每轮重建
  const hasGenerating = trips.some((t) => t.aiStatus === 'generating')
  useEffect(() => {
    if (!hasGenerating) return
    const timer = setInterval(() => {
      listMyTrips(openidRef.current)
        .then((list) => {
          setTrips([...SEED_TRIPS, ...list])
          try { Taro.setStorageSync(STORAGE_KEY, list) } catch { /* ignore */ }
        })
        .catch((e) => console.error('[home] ai polling failed', e))
    }, 8000)
    return () => clearInterval(timer)
  }, [hasGenerating])

  // A5 + B2：生成由「进行中」→「完成」时刷新配额
  const prevGeneratingRef = useRef(hasGenerating)
  useEffect(() => {
    if (prevGeneratingRef.current && !hasGenerating) void refreshQuota()
    prevGeneratingRef.current = hasGenerating
  }, [hasGenerating, refreshQuota])

  const handleAiCreate = async (data: AIInterviewSubmit) => {
    if (data.mode !== 'create') return
    if (!me?.openid) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    Taro.showLoading({ title: '准备中…' })
    try {
      const tripId = await createTripAndFireAI(
        {
          destinations: data.destinations,
          startDate: data.startDate,
          endDate: data.endDate,
          pax: data.pax,
          name: data.name,
          ownerOpenid: me.openid,
          ownerNickname: me.nickname || '行册旅人',
          ownerAvatarUrl: me.avatarUrl || '',
        },
        data.preferences,
      )
      Taro.hideLoading()
      Taro.showToast({ title: 'AI 正在生成…', icon: 'none', duration: 1000 })
      setTimeout(() => Taro.redirectTo({ url: `/pages/trip/index?id=${tripId}` }), 500)
    } catch (e) {
      Taro.hideLoading()
      console.warn('[handleAiCreate]', e)
      Taro.showToast({ title: 'AI 启动失败', icon: 'none' })
    }
  }

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

  // 首页分区：active (pre/live) + archived (post 折叠展示)
  const { activeTrips, archivedTrips } = useMemo(() => {
    const active = trips.filter((t) => getTripPhase(t.startDate, t.endDate) !== 'post')
    const archived = trips.filter((t) => getTripPhase(t.startDate, t.endDate) === 'post')
    return { activeTrips: active, archivedTrips: archived }
  }, [trips])

  const props: HomeViewProps = {
    trips: activeTrips,
    archivedTrips,
    loading,
    openid,
    onOpenTrip: (t) => Taro.navigateTo({ url: `/pages/trip/index?id=${t._id}` }),
    onLongPressTrip: (t) => setActionTrip(t),
    onNewTrip: () => Taro.navigateTo({ url: '/pages/new-trip/index' }),
    onAITrip: () => setInterviewOpen(true),
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
      <AIInterview
        open={interviewOpen}
        mode='create'
        onClose={() => setInterviewOpen(false)}
        onSubmit={(data) => {
          if (data.mode !== 'create') return
          setInterviewOpen(false)
          void handleAiCreate(data)
        }}
      />
    </View>
  )
}
