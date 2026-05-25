import { useEffect, useState, useRef } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import { TripProvider, useTripStore } from '../../store/trip-store'
import ItineraryView from '../../views/ItineraryView'
import BudgetView from '../../views/BudgetView'
import PackingView from '../../views/PackingView'
import MapView from '../../views/MapView'
import CollaboratorsBar from '../../components/CollaboratorsBar'
import CollaboratorsSheet from '../../components/CollaboratorsSheet'
import TripActionSheet, { type TripAction } from '../../components/TripActionSheet'
import ShareTypeSheet from '../../components/ShareTypeSheet'
import AILoading from '../../components/AILoading'
import AIPlanForm from '../../components/AIPlanForm'
import AIPlanPreview from '../../components/AIPlanPreview'
import { buildShareMessage, shareRef, resetShareRef } from '../../utils/share'
import { smartDeleteTrip, renameTrip, copyTripLocally, updateTrip } from '../../utils/db'
import { isSeedTripId } from '../../data/seed-trips'
import { mergePlanIntoDays } from '../../utils/trip-helpers'
import type { ShareKind } from '../../utils/cloud'
import type { AIPreferences, AITask, GeneratedPlan } from '../../types/trip'
import { startAITask, watchAITask, PENDING_TIMEOUT_MS, type TaskWatcher } from '../../utils/ai-task'
import './index.scss'

type ViewKey = 'itinerary' | 'budget' | 'packing' | 'map'

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'itinerary', label: '攻略' },
  { key: 'budget', label: '开销' },
  { key: 'packing', label: '清单' },
  { key: 'map', label: '地图' },
]

const PAX_OPTIONS = Array.from({ length: 99 }, (_, i) => `${i + 1} 人`)

function TripBody() {
  const { state, dispatch } = useTripStore()
  const { openid } = useTripStore()
  const [view, setView] = useState<ViewKey>('itinerary')
  const [actionOpen, setActionOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareReady, setShareReady] = useState({ readonly: false, collab: false })
  const [collabSheetOpen, setCollabSheetOpen] = useState(false)

  // === AI 相关状态 ===
  const [aiFormOpen, setAiFormOpen] = useState(false)
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false)
  const [aiLoadingOpen, setAiLoadingOpen] = useState(false)
  const [aiTask, setAiTask] = useState<AITask | null>(null)
  const [aiPrefs, setAiPrefs] = useState<AIPreferences | null>(null)
  const [aiElapsed, setAiElapsed] = useState(0)
  const watcherRef = useRef<TaskWatcher | null>(null)
  const elapsedTimerRef = useRef<any>(null)
  const pendingTimerRef = useRef<any>(null)
  const previewAutoOpenedRef = useRef(false)

  const t = state.trip
  const isOwner = t ? t._openid === openid : false

  shareRef.tripName = t?.name || ''

  if (state.loading) return <View className='trip-empty'>加载中...</View>
  if (state.error) return <View className='trip-empty'>{state.error}</View>
  if (!t) return <View className='trip-empty'>未找到攻略</View>

  // === AI 函数 ===
  const stopWatch = () => {
    if (watcherRef.current) { watcherRef.current.close(); watcherRef.current = null }
    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null }
    if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null }
  }

  const startAi = async (prefs: AIPreferences, previousResult?: GeneratedPlan, userFeedback?: string) => {
    if (!t) return
    stopWatch()
    setAiPrefs(prefs)
    setAiElapsed(0)
    setAiTask(null)
    setAiLoadingOpen(true)
    setAiPreviewOpen(false)
    previewAutoOpenedRef.current = false
    try {
      const taskId = await startAITask({
        tripContext: {
          name: t.name,
          destinations: t.destinations,
          startDate: t.startDate,
          endDate: t.endDate,
          pax: t.pax,
        },
        preferences: prefs,
        tripId: t._id,
        previousResult,
        userFeedback,
      })
      elapsedTimerRef.current = setInterval(() => setAiElapsed(e => e + 1), 1000)
      pendingTimerRef.current = setTimeout(() => {
        setAiTask(prev => {
          if (!prev || prev.status === 'pending') {
            stopWatch(); setAiLoadingOpen(false)
            Taro.showToast({ title: 'AI 启动超时, 请重试', icon: 'none' })
          }
          return prev
        })
      }, PENDING_TIMEOUT_MS)

      watcherRef.current = watchAITask(taskId, (tk) => {
        setAiTask(tk)
        if (!previewAutoOpenedRef.current && tk.progress && tk.progress.days && tk.progress.days.length > 0) {
          previewAutoOpenedRef.current = true
          setAiPreviewOpen(true)
        }
        if (tk.status === 'done') {
          stopWatch(); setAiLoadingOpen(false); setAiPreviewOpen(true)
        } else if (tk.status === 'error') {
          stopWatch(); setAiLoadingOpen(false)
          Taro.showToast({ title: tk.error || 'AI 生成失败', icon: 'none' })
        }
      })
    } catch (e: any) {
      stopWatch(); setAiLoadingOpen(false)
      Taro.showToast({ title: e.message || '启动失败', icon: 'none' })
    }
  }

  const handleAiOpen = () => { if (isOwner) setAiFormOpen(true) }
  const handleAiSubmit = (prefs: AIPreferences) => { setAiFormOpen(false); startAi(prefs) }
  const handleAiRegenerate = (feedback: string) => {
    if (!aiPrefs || !aiTask || !aiTask.result) return
    startAi(aiPrefs, aiTask.result, feedback || '请优化方案')
  }

  const handleAiApply = async (selectedDates: string[]) => {
    if (!t || !aiTask || !aiTask.result) return
    const confirm = await Taro.showModal({
      title: `应用 AI 的 ${selectedDates.length} 天?`,
      content: '将覆盖选中天的现有 spots, 未选中的天保持不变',
      confirmText: '应用',
      confirmColor: '#c43d3d',
    })
    if (!confirm.confirm) return
    try {
      const newDays = mergePlanIntoDays(t.days, aiTask.result, selectedDates)
      await updateTrip(t._id, { days: newDays }, openid)
      dispatch({ type: 'UPDATE_TRIP', patch: { days: newDays } })
      setAiPreviewOpen(false)
      Taro.showToast({ title: '已应用', icon: 'success' })
    } catch (e: any) {
      console.error('[ai apply]', e)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  useEffect(() => () => stopWatch(), [])

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
      const newId = await copyTripLocally(t._id, openid)
      Taro.showToast({ title: '已复制', icon: 'success', duration: 600 })
      setTimeout(() => {
        Taro.hideToast()
        Taro.redirectTo({ url: `/pages/trip/index?id=${newId}` })
      }, 650)
      return
    }
    if (isSeedTripId(t._id)) {
      Taro.showToast({ title: '示例攻略仅支持复制', icon: 'none' })
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
    <View className='trip theme-tegami'>
      <View className='trip-head'>
        <View className='th-row'>
          <Text className='th-name'>{t.name}</Text>
          <View style={{ display: 'flex', alignItems: 'center' }}>
            {isOwner && (
              <View className='th-ai-btn' onClick={handleAiOpen}>✨ AI</View>
            )}
            <View className='th-menu' onClick={() => setActionOpen(true)}>⋯</View>
          </View>
        </View>
        <View className='th-meta'>
          <Text>
            {t.days[0]?.date || t.startDate} → {t.days[t.days.length - 1]?.date || t.endDate} · {t.days.length || 0} 天 ·{' '}
          </Text>
          <Picker
            mode='selector'
            range={PAX_OPTIONS}
            value={Math.max(0, Math.min(98, (t.pax || 1) - 1))}
            onChange={e => {
              const next = Number(e.detail.value) + 1
              if (next !== t.pax) dispatch({ type: 'UPDATE_TRIP', patch: { pax: next } })
            }}
          >
            <Text className='th-pax-edit'>{t.pax} 人 ▾</Text>
          </Picker>
        </View>
        <CollaboratorsBar
          collaborators={t.collaborators || []}
          ownerNickname={t.ownerNickname}
          isOwner={isOwner}
          onTap={() => setCollabSheetOpen(true)}
        />
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
        {view === 'map' && <MapView />}
      </View>

      <TripActionSheet
        open={actionOpen}
        tripName={t.name}
        actions={isSeedTripId(t._id) ? ['copy'] : undefined}
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
        collaborators={t.collaborators || []}
        ownerNickname={t.ownerNickname}
        ownerAvatarUrl={t.ownerAvatarUrl}
        onClose={() => setCollabSheetOpen(false)}
      />

      <AIPlanForm open={aiFormOpen} onClose={() => setAiFormOpen(false)} onSubmit={handleAiSubmit} />
      <AILoading
        open={aiLoadingOpen}
        status={aiTask?.status || 'pending'}
        doneCount={aiTask?.progress?.days?.length || 0}
        totalDays={t?.days?.length || 0}
        onClose={() => setAiLoadingOpen(false)}
        elapsedSec={aiElapsed}
      />
      <AIPlanPreview
        open={aiPreviewOpen}
        plan={(aiTask?.result || aiTask?.progress) || null}
        status={aiTask?.status || 'pending'}
        generating={aiTask?.status === 'streaming' || aiTask?.status === 'pending'}
        onRegenerate={handleAiRegenerate}
        onApply={handleAiApply}
        onClose={() => setAiPreviewOpen(false)}
      />
    </View>
  )
}

export default function TripPage() {
  const router = useRouter()
  const tripId = router.params.id || ''
  const [openid, setOpenid] = useState('')

  // 用户点 <Button open-type="share"> 时 WeChat 触发,根据 button dataset.kind 选 payload
  useShareAppMessage((options) => {
    const kind = (options as { target?: { dataset?: { kind?: ShareKind } } })?.target?.dataset?.kind
    const picked = kind ? shareRef.byKind[kind] : null
    return picked || {
      title: shareRef.tripName ? `行册 · ${shareRef.tripName}` : '行册',
      path: '/pages/home/index',
    }
  })

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
