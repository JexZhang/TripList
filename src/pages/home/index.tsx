import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, usePullDownRefresh } from '@tarojs/taro'
import type { Trip } from '../../types/trip'
import { listMyTrips, renameTrip, copyTripLocally, smartDeleteTrip, updateTrip } from '../../utils/db'
import { listFeaturedTemplates, getFeaturedCache } from '../../utils/templates'
import type { TemplateCard } from '../../types/template'
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
  // A2/A3：命中缓存则立即显示，loading 仅表示「用户真实行程未就绪」
  const [trips, setTrips] = useState<Trip[]>(() => {
    try {
      const cached = Taro.getStorageSync(STORAGE_KEY) as Trip[] | ''
      if (Array.isArray(cached) && cached.length) return cached
    } catch { /* ignore */ }
    return []
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
  // 云端精选模板：先回缓存即时渲染，挂载后并行刷新
  const [featuredTemplates, setFeaturedTemplates] = useState<TemplateCard[]>(() => getFeaturedCache() || [])
  useEffect(() => {
    listFeaturedTemplates(8).then(setFeaturedTemplates).catch((e) => console.warn('[home] featured', e))
  }, [])

  const openidRef = useRef(openid)
  useEffect(() => { openidRef.current = openid }, [openid])
  const didInitialShowRef = useRef(false)

  // A1：listMyTrips 服务端自取 OPENID，客户端无需等 ensure-user → 挂载即可并行发起
  const loadTrips = useCallback(async () => {
    try {
      const list = await listMyTrips(openidRef.current)
      setTrips(list)
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

  // 顶部下拉刷新：重载行程 + 配额
  usePullDownRefresh(() => {
    Promise.all([loadTrips(), refreshQuota?.()].filter(Boolean))
      .finally(() => Taro.stopPullDownRefresh())
  })

  // A5：仅在「有生成中的行程」翻转时开/关定时器，不再因 trips 变化每轮重建
  const hasGenerating = trips.some((t) => t.aiStatus === 'generating')
  useEffect(() => {
    if (!hasGenerating) return
    const timer = setInterval(() => {
      listMyTrips(openidRef.current)
        .then((list) => {
          setTrips(list)
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
          ownerNickname: me.nickname || '行迹旅人',
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
        try {
          const performed = await smartDeleteTrip(t, openid)
          setTrips((prev) => {
            const next = prev.filter((x) => x._id !== t._id)
            try { Taro.setStorageSync(STORAGE_KEY, next) } catch { /* ignore */ }
            return next
          })
          Taro.showToast({ title: performed === 'delete' ? '已删除' : '已退出', icon: 'success' })
        } catch (e: any) {
          console.error('[home] delete/leave failed', e)
          Taro.showToast({ title: e?.message || '操作失败，请重试', icon: 'none' })
        }
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
      console.error('[prepareShare] failed', kind, e)
      Taro.showToast({ title: '生成分享失败', icon: 'none' })
    }
  }

  const openShareFor = (trip: Trip) => {
    resetShareRef(trip.name)
    setShareReady({ readonly: false, collab: false })
    setShareTrip(trip)
  }

  useShareAppMessage((options) => {
    // Taro 中 data-kind 可能丢失，优先用 dataset，fallback 到模块级 lastKind
    const dsKind = (options as { target?: { dataset?: { kind?: ShareKind } } })?.target?.dataset?.kind
    const kind = dsKind || shareRef.lastKind
    const picked = kind ? shareRef.byKind[kind] : null
    if (picked) return picked
    // fallback：至少显示攻略名称
    const name = shareRef.tripName || 'AI旅行攻略'
    return { title: `行迹 · ${name}`, path: '/pages/home/index' }
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

  // 4.1 排序：live → pre → post；live/pre 按 startDate 升序，post 按 endDate 降序
  const sortedTrips = useMemo(() => {
    const phaseOrder = { live: 0, pre: 1, post: 2 }
    return [...trips].sort((a, b) => {
      const pa = getTripPhase(a.startDate, a.endDate)
      const pb = getTripPhase(b.startDate, b.endDate)
      if (phaseOrder[pa] !== phaseOrder[pb]) return phaseOrder[pa] - phaseOrder[pb]
      if (pa === 'post') return b.endDate.localeCompare(a.endDate)
      return a.startDate.localeCompare(b.startDate)
    })
  }, [trips])

  const props: HomeViewProps = {
    trips: sortedTrips,
    loading,
    openid,
    onOpenTrip: (t) => Taro.navigateTo({ url: `/pages/trip/index?id=${t._id}` }),
    onLongPressTrip: (t) => setActionTrip(t),
    onNewTrip: () => Taro.navigateTo({ url: '/pages/new-trip/index' }),
    onAITrip: () => setInterviewOpen(true),
    onCoverLongPress: (t) => setCoverTrip(t),
    featuredTemplates,
    onOpenTemplate: (id) => Taro.navigateTo({ url: `/pages/template/index?id=${id}` }),
    onOpenLibrary: () => Taro.navigateTo({ url: '/pages/library/index' }),
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
