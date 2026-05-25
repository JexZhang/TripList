import { useState, useEffect, useRef } from 'react'
import { View, Text, Input, Button, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import dayjs from 'dayjs'
import DatePicker from '../../components/DatePicker'
import DestinationPicker from '../../components/DestinationPicker'
import AILoading from '../../components/AILoading'
import AIPlanForm from '../../components/AIPlanForm'
import AIPlanPreview from '../../components/AIPlanPreview'
import AITaskFab from '../../components/AITaskFab'
import type { Destination, AIPreferences, AITask, GeneratedPlan } from '../../types/trip'
import { buildNewTrip, planDayToDay } from '../../utils/trip-helpers'
import { createTrip } from '../../utils/db'
import { useMe } from '../../store/me-store'
import {
  startAITask, watchAITask, getAITask,
  savePendingTask, loadPendingTask, clearPendingTask,
  PENDING_TIMEOUT_MS, STREAMING_HEARTBEAT_MS, type TaskWatcher,
} from '../../utils/ai-task'

const NEW_TRIP_SCOPE = 'new-trip'
import './index.scss'

export default function NewTrip() {
  const [name, setName] = useState('')
  const [pax, setPax] = useState(2)
  const [dates, setDates] = useState({
    start: dayjs().format('YYYY-MM-DD'),
    end: dayjs().add(2, 'day').format('YYYY-MM-DD'),
  })
  const [destinations, setDestinations] = useState<Destination[]>([])
  const PAX_OPTIONS = Array.from({ length: 99 }, (_, i) => `${i + 1} 人`)
  const { me } = useMe()
  const openid = me?.openid || ''
  const [submitting, setSubmitting] = useState(false)

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
  const heartbeatTimerRef = useRef<any>(null)
  const previewAutoOpenedRef = useRef(false)
  // 后台仍在跑但 AILoading 弹窗已经收起 -> 显示 FAB
  const [fabVisible, setFabVisible] = useState(false)

  const canSubmit = !!name.trim() && !!openid && pax >= 1 && !dayjs(dates.end).isBefore(dates.start)

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      const input = buildNewTrip({
        name,
        pax,
        startDate: dates.start,
        endDate: dates.end,
        destinations,
      })
      input.ownerOpenid = openid
      input.ownerNickname = me?.nickname || '行册旅人'
      input.ownerAvatarUrl = me?.avatarUrl || ''
      const tripId = await createTrip(input)
      Taro.showToast({ title: '已创建', icon: 'success' })
      setTimeout(() => Taro.redirectTo({ url: `/pages/trip/index?id=${tripId}` }), 600)
    } catch (e) {
      console.error('createTrip failed', e)
      Taro.showToast({ title: '创建失败', icon: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  // === AI 函数 ===
  const stopWatch = () => {
    if (watcherRef.current) { watcherRef.current.close(); watcherRef.current = null }
    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null }
    if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null }
    if (heartbeatTimerRef.current) { clearInterval(heartbeatTimerRef.current); heartbeatTimerRef.current = null }
  }

  // 统一处理 task 更新: 设状态、判完成/失败、维护 FAB
  const onTaskUpdate = (tk: AITask) => {
    setAiTask(tk)
    if (!previewAutoOpenedRef.current && tk.progress && tk.progress.days && tk.progress.days.length > 0) {
      previewAutoOpenedRef.current = true
      setAiPreviewOpen(true)
    }
    if (tk.status === 'done') {
      stopWatch()
      setAiLoadingOpen(false)
      setAiPreviewOpen(true)
      setFabVisible(false)
      clearPendingTask(NEW_TRIP_SCOPE)
    } else if (tk.status === 'error') {
      stopWatch()
      setAiLoadingOpen(false)
      setFabVisible(false)
      Taro.showToast({ title: tk.error || 'AI 生成失败', icon: 'none' })
      clearPendingTask(NEW_TRIP_SCOPE)
    }
  }

  // 启动心跳监测: streaming 状态下若 updatedAt 长时间不变 -> 视为后台已死
  const startHeartbeat = (taskId: string) => {
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)
    heartbeatTimerRef.current = setInterval(() => {
      setAiTask(prev => {
        if (!prev) return prev
        if (prev.status === 'streaming' || prev.status === 'pending') {
          const last = prev.updatedAt || 0
          if (last > 0 && Date.now() - last > STREAMING_HEARTBEAT_MS) {
            console.warn('[ai] streaming heartbeat lost, taskId=', taskId)
            stopWatch()
            setAiLoadingOpen(false)
            setFabVisible(false)
            Taro.showToast({ title: '后台无响应, 请重试', icon: 'none' })
            clearPendingTask(NEW_TRIP_SCOPE)
            return { ...prev, status: 'error', error: '后台无响应' }
          }
        }
        return prev
      })
    }, 10_000)
  }

  const startAi = async (prefs: AIPreferences, previousResult?: GeneratedPlan, userFeedback?: string) => {
    stopWatch()
    setAiPrefs(prefs)
    setAiElapsed(0)
    setAiTask(null)
    setAiLoadingOpen(true)
    setAiPreviewOpen(false)
    setFabVisible(false)
    previewAutoOpenedRef.current = false
    const ctx = {
      name: name || '未命名',
      destinations,
      startDate: dates.start,
      endDate: dates.end,
      pax,
    }
    try {
      const taskId = startAITask({
        tripContext: ctx,
        preferences: prefs,
        previousResult,
        userFeedback,
      })
      // 持久化, 关弹窗/切页都能恢复
      savePendingTask({ taskId, prefs, tripContext: ctx, scope: NEW_TRIP_SCOPE, startedAt: Date.now() })

      elapsedTimerRef.current = setInterval(() => setAiElapsed(e => e + 1), 1000)
      pendingTimerRef.current = setTimeout(() => {
        setAiTask(prev => {
          if (!prev || prev.status === 'pending') {
            stopWatch(); setAiLoadingOpen(false); setFabVisible(false)
            Taro.showToast({ title: 'AI 启动超时, 请重试', icon: 'none' })
            clearPendingTask(NEW_TRIP_SCOPE)
          }
          return prev
        })
      }, PENDING_TIMEOUT_MS)

      watcherRef.current = watchAITask(taskId, onTaskUpdate)
      startHeartbeat(taskId)
    } catch (e: any) {
      stopWatch()
      setAiLoadingOpen(false)
      setFabVisible(false)
      clearPendingTask(NEW_TRIP_SCOPE)
      Taro.showToast({ title: e.message || '启动失败', icon: 'none' })
    }
  }

  // 恢复未完成的任务 (用户关闭弹窗/切页/重进小程序后)
  const resumeAi = async (rec: ReturnType<typeof loadPendingTask>) => {
    if (!rec) return
    // 先 get 一次, 看 task 当前状态
    const tk = await getAITask(rec.taskId)
    if (!tk) { clearPendingTask(NEW_TRIP_SCOPE); return }
    if (tk.status === 'done' || tk.status === 'error') {
      // 已结束, 直接显示结果, 不需要 watcher
      setAiPrefs(rec.prefs)
      setAiTask(tk)
      if (tk.status === 'done') setAiPreviewOpen(true)
      else Taro.showToast({ title: tk.error || 'AI 生成失败', icon: 'none' })
      clearPendingTask(NEW_TRIP_SCOPE)
      return
    }
    // 还在 pending/streaming - 恢复 watcher + FAB + 计时
    setAiPrefs(rec.prefs)
    setAiTask(tk)
    setAiElapsed(Math.floor((Date.now() - rec.startedAt) / 1000))
    setFabVisible(true)  // 默认不弹大窗, 只显示 FAB, 让用户主动点开
    previewAutoOpenedRef.current = (tk.progress && tk.progress.days && tk.progress.days.length > 0) || false
    elapsedTimerRef.current = setInterval(() => setAiElapsed(e => e + 1), 1000)
    watcherRef.current = watchAITask(rec.taskId, onTaskUpdate)
    startHeartbeat(rec.taskId)
  }

  const handleAiSubmit = (prefs: AIPreferences) => {
    setAiFormOpen(false)
    startAi(prefs)
  }
  const handleAiRegenerate = (feedback: string) => {
    if (!aiPrefs || !aiTask || !aiTask.result) return
    startAi(aiPrefs, aiTask.result, feedback || '请优化方案')
  }

  const handleAiApply = async (selectedDates: string[]) => {
    if (!aiTask || !aiTask.result || !openid) return
    try {
      const plan = aiTask.result
      const input = buildNewTrip({
        name: name || '未命名',
        pax,
        startDate: dates.start,
        endDate: dates.end,
        destinations,
      })
      input.ownerOpenid = openid
      input.ownerNickname = me?.nickname || '行册旅人'
      input.ownerAvatarUrl = me?.avatarUrl || ''
      // 新建场景: 选中的天用 AI, 未选中的天保持 seedDays(空)
      const selectedSet = new Set(selectedDates)
      const aiByDate = new Map(plan.days.map(gd => [gd.date, gd]))
      input.days = input.days.map(d =>
        selectedSet.has(d.date) && aiByDate.has(d.date)
          ? { ...d, spots: planDayToDay(aiByDate.get(d.date)!).spots }
          : d
      )
      const tripId = await createTrip(input)
      setAiPreviewOpen(false)
      Taro.showToast({ title: '已创建', icon: 'success' })
      setTimeout(() => Taro.redirectTo({ url: `/pages/trip/index?id=${tripId}` }), 600)
    } catch (e: any) {
      console.error('[ai apply]', e)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  // 进入页面恢复未完成任务; 卸载清理订阅
  useEffect(() => {
    const rec = loadPendingTask(NEW_TRIP_SCOPE)
    if (rec) resumeAi(rec)
    return () => stopWatch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View className='new-trip theme-tegami'>
      <View className='nt-field'>
        <Text className='nt-label'>攻略名</Text>
        <Input
          className='nt-input'
          placeholder='例：南京 · 金陵四日'
          value={name}
          onInput={e => setName(e.detail.value)}
        />
      </View>

      <View className='nt-field'>
        <Text className='nt-label'>日期</Text>
        <DatePicker value={dates} onChange={setDates} />
      </View>

      <View className='nt-field'>
        <Text className='nt-label'>目的地</Text>
        <DestinationPicker value={destinations} onChange={setDestinations} />
      </View>

      <View className='nt-field'>
        <Text className='nt-label'>人数</Text>
        <Picker
          mode='selector'
          range={PAX_OPTIONS}
          value={Math.max(0, Math.min(98, pax - 1))}
          onChange={e => setPax(Number(e.detail.value) + 1)}
        >
          <View className='nt-pax-picker'>
            <Text className='nt-pax-value'>{pax} 人</Text>
            <Text className='nt-pax-arrow'>▾</Text>
          </View>
        </Picker>
      </View>

      <View className='nt-foot'>
        <View className='nt-row-btns'>
          <Button
            className='nt-cancel'
            onClick={() => Taro.navigateBack()}
          >取消</Button>
          <Button
            className='nt-submit'
            disabled={!canSubmit || submitting}
            onClick={submit}
          >{submitting ? '创建中...' : '创建'}</Button>
        </View>

        <Button
          className='nt-submit-ai'
          disabled={!canSubmit}
          onClick={() => setAiFormOpen(true)}
        >✨ AI 帮我规划</Button>
      </View>

      <AIPlanForm
        open={aiFormOpen}
        onClose={() => setAiFormOpen(false)}
        onSubmit={handleAiSubmit}
      />
      <AILoading
        open={aiLoadingOpen}
        status={aiTask?.status || 'pending'}
        doneCount={aiTask?.progress?.days?.length || 0}
        totalDays={dayjs(dates.end).diff(dayjs(dates.start), 'day') + 1}
        onClose={() => {
          setAiLoadingOpen(false)
          // 关大窗时如果任务还在跑 -> 留 FAB 让用户能再打开
          const st = aiTask?.status
          if (st === 'pending' || st === 'streaming') setFabVisible(true)
        }}
        elapsedSec={aiElapsed}
      />
      <AITaskFab
        visible={fabVisible}
        task={aiTask}
        elapsedSec={aiElapsed}
        onTap={() => {
          setFabVisible(false)
          if (aiTask?.status === 'done') setAiPreviewOpen(true)
          else setAiLoadingOpen(true)
        }}
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
