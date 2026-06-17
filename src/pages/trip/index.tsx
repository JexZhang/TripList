import { useEffect, useState } from 'react'
import { View } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import { TripProvider, useTripStore } from '../../store/trip-store'
import { useMe } from '../../store/me-store'
import { useThemeClass } from '../../utils/theme-class'
import ItineraryView from '../../views/ItineraryView'
import BudgetView from '../../views/BudgetView'
import PackingView from '../../views/PackingView'
import MapView from '../../views/MapView'
import CollaboratorsSheet from '../../components/CollaboratorsSheet'
import TripActionSheet, { type TripAction } from '../../components/TripActionSheet'
import ShareTypeSheet from '../../components/ShareTypeSheet'
import AIInterview from '../../components/AIInterview'
import AILoadingTheater from '../../components/AILoadingTheater'
import TripAIStatusBar, { type TripAIStatusBarStatus } from '../../components/TripAIStatusBar'
import AIPlanPreview from '../../components/AIPlanPreview'
import { draftKeyEnrich } from '../../components/AIInterview'
import TripHeader from './TripHeader'
import TripPhaseHero from '../../components/TripPhaseHero'
import { buildShareMessage, shareRef, resetShareRef } from '../../utils/share'
import { smartDeleteTrip, renameTrip, copyTripLocally, updateTrip } from '../../utils/db'
import { mergePlanIntoDays } from '../../utils/trip-helpers'
import { mergeAIDraft } from '../../utils/ai-apply'
import type { ShareKind } from '../../utils/cloud'
import type { AIPreferences } from '../../types/trip'
import { newAITaskId, fireAITask } from '../../utils/ai-task'
import './index.scss'

type ViewKey = 'itinerary' | 'budget' | 'packing' | 'map'

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'itinerary', label: '攻略' },
  { key: 'map', label: '地图' },
  { key: 'budget', label: '开销' },
  { key: 'packing', label: '清单' },
]

function TripBody() {
  const { state, dispatch } = useTripStore()
  const { openid } = useTripStore()
  const { me } = useMe()
  const themeCls = useThemeClass('trip')
  const [view, setView] = useState<ViewKey>('itinerary')
  const [actionOpen, setActionOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareReady, setShareReady] = useState({ readonly: false, collab: false })
  const [collabSheetOpen, setCollabSheetOpen] = useState(false)

  // === AI 草稿流相关 ===
  const [aiFormOpen, setAiFormOpen] = useState(false)
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false)
  const [theaterMinimized, setTheaterMinimized] = useState(false)
  
  const t = state.trip
  const isOwner = t ? t._openid === openid : false

  // ── 覆盖当前用户的显示信息，绕过 trips 集合中的旧快照 ──
  // 修复：用户编辑资料后，攻略头部/协作者列表仍显示旧昵称/头像
  const displayTrip = t ? (() => {
    let dt = t
    // 当前用户是 owner → 用 me 的最新 nickname/avatar
    if (isOwner && me) {
      dt = { ...dt,
        ownerNickname: me.nickname || dt.ownerNickname,
        ownerAvatarUrl: me.avatarUrl || dt.ownerAvatarUrl,
      }
    }
    // 当前用户在 collaborators 中 → 用 me 的最新 info
    if (me && dt.collaborators?.length) {
      const myIdx = dt.collaborators.findIndex(c => c.openid === openid)
      if (myIdx >= 0) {
        const updated = dt.collaborators.slice()
        updated[myIdx] = {
          ...updated[myIdx],
          nickname: me.nickname || updated[myIdx].nickname,
          avatarUrl: me.avatarUrl || updated[myIdx].avatarUrl,
        }
        dt = { ...dt, collaborators: updated }
      }
    }
    return dt
  })() : null

  shareRef.tripName = t?.name || ''
  
  // 进入 ready 状态首次自动弹 Preview
  // 注意: 小程序没有 sessionStorage, 用 Taro.getStorageSync (持久 storage), 但 key 含 aiTaskId,
  // 重新生成会换新 taskId 所以新 task 仍会自动弹一次。应用/舍弃后 aiTaskId 清空, 不再触发。
  useEffect(() => {
    if (!t || !isOwner) return
    if (t.aiStatus !== 'ready') return
    if (!t.aiTaskId) return
    const key = `ai-preview-shown:${t._id}:${t.aiTaskId}`
    try {
      if (!Taro.getStorageSync(key)) {
        setAiPreviewOpen(true)
        Taro.setStorageSync(key, '1')
      }
    } catch (_) {}
  }, [t?._id, t?.aiTaskId, t?.aiStatus, isOwner])
  
  if (state.loading) return <View className='trip-empty'>加载中...</View>
  if (state.error) return <View className='trip-empty'>{state.error}</View>
  if (!t) return <View className='trip-empty'>未找到攻略</View>
  
  // === AI 行为函数 ===
  const triggerAiTask = async (prefs: AIPreferences) => {
    if (!t || !isOwner) return
    setAiFormOpen(false)
    setTheaterMinimized(false)
    try {
      const taskId = newAITaskId()
      // 先把 aiTaskId 写到 trip 落库, 再发云函数. 反过来云函数会在
      // updateTrip 完成前先读 trip, 看到旧 aiTaskId 立刻 CANCELLED.
      await updateTrip(t._id, {
        aiTaskId: taskId,
        aiStatus: 'generating',
        aiDraft: null,
        aiError: null,
      }, openid)
      fireAITask(taskId, {
        tripId: t._id,
        tripContext: {
          name: t.name,
          destinations: t.destinations,
          startDate: t.startDate,
          endDate: t.endDate,
          pax: t.pax,
        },
        preferences: prefs,
      })
    } catch (e: unknown) {
      console.error('[ai trigger]', e)
      Taro.showToast({ title: 'AI 启动失败', icon: 'none' })
    }
  }
  
  const clearAiFields = async () => {
    if (!t) return
    await updateTrip(t._id, {
      aiTaskId: null,
      aiStatus: null,
      aiDraft: null,
      aiError: null,
    }, openid)
    dispatch({ type: 'UPDATE_TRIP', patch: { aiTaskId: null, aiStatus: null, aiDraft: null, aiError: null } })
  }
  
  const handleInlineBarTap = () => {
    if (!t || !isOwner) return
    if (t.aiStatus === 'generating') {
      setTheaterMinimized(false)
    } else if (t.aiStatus === 'ready') {
      setAiPreviewOpen(true)
    } else if (t.aiStatus === 'error') {
      setAiFormOpen(true)
    }
  }
  
  const handleAiButtonTap = () => {
    if (!t || !isOwner) return
    if (t.aiStatus === null || t.aiStatus === undefined) setAiFormOpen(true)
    // 否则什么都不做 (用户应该点状态条)
  }

  const handleTheaterCancel = async () => {
    const res = await Taro.showModal({
      title: '停止 AI 生成?',
      content: '已生成的部分会被舍弃, 后台运行的剩余轮次也会终止',
      confirmText: '停止',
      confirmColor: '#c43d3d',
    })
    if (res.confirm) {
      await clearAiFields()
      setTheaterMinimized(false)
    }
  }

  const handleTheaterMinimize = () => {
    setTheaterMinimized(true)
  }
  
  const handlePreviewApply = async (selectedDates: string[]) => {
    if (!t || !t.aiDraft) return
    try {
      const aiDraft = t.aiDraft as any
      const patch = mergeAIDraft(t, aiDraft)
      const newDays = mergePlanIntoDays(t.days, aiDraft, selectedDates)
      await updateTrip(t._id, {
        ...patch,
        days: newDays,
        aiTaskId: null,
        aiStatus: null,
        aiDraft: null,
        aiError: null,
      }, openid)
      dispatch({ type: 'UPDATE_TRIP', patch: {
        ...patch,
        days: newDays,
        aiTaskId: null,
        aiStatus: null,
        aiDraft: null,
        aiError: null,
      } })
      setAiPreviewOpen(false)
      // Clear enrich draft on apply
      if (t._id) { try { Taro.removeStorageSync(draftKeyEnrich(t._id)) } catch { /* ignore */ } }
      Taro.showToast({ title: '已应用', icon: 'success' })
    } catch (e: unknown) {
      console.error('[ai apply]', e)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }
  
  const handlePreviewDiscard = async () => {
    setAiPreviewOpen(false)
    await clearAiFields()
    // Clear enrich draft on discard
    if (t?._id) { try { Taro.removeStorageSync(draftKeyEnrich(t._id)) } catch { /* ignore */ } }
    Taro.showToast({ title: '已舍弃', icon: 'none' })
  }
  
  const handlePreviewRegenerate = () => {
    // 关 Preview, 弹 Form 让用户重填 preferences. Form submit 会启动新 task 并覆盖 ai* 字段
    setAiPreviewOpen(false)
    setAiFormOpen(true)
  }

  const handleAction = async (action: TripAction) => {
    if (!t) return

    if (action === 'rename') {
      const res = await Taro.showModal({
        title: '重命名',
        content: t.name,
        editable: true,
        placeholderText: '攻略名',
      } as any)
      if (res.confirm && (res as any).content?.trim()) {
        await renameTrip(t._id, (res as any).content.trim(), openid)
      }
      return
    }
    if (action === 'copy') {
      const newId = await copyTripLocally(t._id, openid, me ? { nickname: me.nickname, avatarUrl: me.avatarUrl } : undefined)
      Taro.showToast({ title: '已复制', icon: 'success', duration: 600 })
      setTimeout(() => {
        Taro.hideToast()
        Taro.redirectTo({ url: `/pages/trip/index?id=${newId}` })
      }, 650)
      return
    }
    if (action === 'delete') {
      const collabCount = (t.collaborators || []).length
      const title = isOwner ? '删除攻略？' : '退出协作？'
      const content = isOwner
        ? (collabCount > 0
            ? `还有 ${collabCount} 位协作者将失去访问，确认删除？`
            : `「${t.name}」将被永久删除`)
        : `退出后，「${t.name}」不再出现在你的攻略册中`
      const confirmText = isOwner ? '删除' : '退出'
      const res = await Taro.showModal({ title, content, confirmText, confirmColor: '#c43d3d' })
      if (res.confirm) {
        await smartDeleteTrip(t, openid)
        Taro.showToast({ title: isOwner ? '已删除' : '已退出', icon: 'success', duration: 500 })
        setTimeout(() => {
          Taro.hideToast()
          Taro.reLaunch({ url: '/pages/home/index' })
        }, 550)
      }
      return
    }
    if (action === 'share') {
      resetShareRef(t.name)
      setShareReady({ readonly: false, collab: false })
      setShareOpen(true)
      return
    }
  }

  const prepareShare = async (kind: ShareKind) => {
    if (!t) return
    if (!isOwner) {
      Taro.showToast({ title: '仅 owner 可分享', icon: 'none' })
      return
    }
    try {
      const payload = await buildShareMessage(t._id, t.name, kind)
      shareRef.byKind[kind] = { title: payload.title, path: payload.path }
      setShareReady(prev => ({ ...prev, [kind]: true }))
    } catch (e) {
      console.error('[buildShareMessage failed]', kind, e)
      Taro.showToast({ title: '生成分享失败', icon: 'error' })
    }
  }

  return (
    <View className={themeCls}>
      <TripHeader
        trip={displayTrip || t}
        isOwner={isOwner}
        aiStatus={t.aiStatus as 'generating' | 'ready' | 'error' | null | undefined}
        onAITap={handleAiButtonTap}
        onAIBarTap={handleInlineBarTap}
        onMenuTap={() => setActionOpen(true)}
        onBack={() => Taro.navigateBack().catch(() => Taro.reLaunch({ url: '/pages/home/index' }))}
        onPaxChange={(next) => dispatch({ type: 'UPDATE_TRIP', patch: { pax: next } })}
        onCollabTap={() => setCollabSheetOpen(true)}
      />

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
        {view === 'itinerary' && (
          <>
            <TripPhaseHero trip={t} />
            {t.aiStatus && (
              <TripAIStatusBar
                status={t.aiStatus as TripAIStatusBarStatus}
                onTap={handleInlineBarTap}
              />
            )}
            <ItineraryView />
          </>
        )}
        {view === 'budget' && <BudgetView />}
        {view === 'packing' && <PackingView />}
        {view === 'map' && <MapView />}
      </View>

      <TripActionSheet
        open={actionOpen}
        tripName={t.name}
        onSelect={handleAction}
        onClose={() => setActionOpen(false)}
      />

      <ShareTypeSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        prepare={prepareShare}
        ready={shareReady}
      />

      <CollaboratorsSheet
        open={collabSheetOpen}
        collaborators={displayTrip?.collaborators || t.collaborators || []}
        ownerNickname={displayTrip?.ownerNickname || t.ownerNickname}
        ownerAvatarUrl={displayTrip?.ownerAvatarUrl || t.ownerAvatarUrl}
        onClose={() => setCollabSheetOpen(false)}
      />

      <AIInterview
        open={aiFormOpen}
        mode='enrich'
        tripId={t?._id}
        onClose={() => setAiFormOpen(false)}
        onSubmit={(data) => {
          if (data.mode !== 'enrich') return
          setAiFormOpen(false)
          void triggerAiTask(data.preferences)
        }}
      />
      <AILoadingTheater
        open={t.aiStatus === 'generating' && !theaterMinimized}
        status='thinking'
        onCancel={handleTheaterCancel}
        onMinimize={handleTheaterMinimize}
      />
      <AIPlanPreview
        open={aiPreviewOpen}
        plan={t.aiDraft || null}
        status={t.aiStatus === 'ready' ? 'done' : 'pending'}
        generating={t.aiStatus === 'generating'}
        existingDays={t.days}
        onRegenerate={handlePreviewRegenerate}
        onApply={handlePreviewApply}
        onDiscard={handlePreviewDiscard}
        onClose={() => setAiPreviewOpen(false)}
      />
    </View>
  )
}

export default function TripPage() {
  const router = useRouter()
  const tripId = router.params.id || ''
  const { me } = useMe()
  const openid = me?.openid || ''

  // 用户点 <Button open-type="share"> 时 WeChat 触发,根据 button dataset.kind 选 payload
  useShareAppMessage((options) => {
    const kind = (options as { target?: { dataset?: { kind?: ShareKind } } })?.target?.dataset?.kind
    const picked = kind ? shareRef.byKind[kind] : null
    return picked || {
      title: shareRef.tripName ? `行册 · ${shareRef.tripName}` : '行册',
      path: '/pages/home/index',
    }
  })

  if (!tripId) return <View className='trip-empty'>缺少 trip id</View>
  if (!openid) return <View className='trip-empty'>登录中...</View>

  return (
    <TripProvider tripId={tripId} openid={openid}>
      <TripBody />
    </TripProvider>
  )
}
