import { useState, useEffect } from 'react'
import { View, Text, Input, Button, Picker } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import dayjs from 'dayjs'
import DatePicker from '../../components/DatePicker'
import DestinationPicker from '../../components/DestinationPicker'
import AIPlanForm from '../../components/AIPlanForm'
import AIInterview from '../../components/AIInterview'
import type { Destination, AIPreferences } from '../../types/trip'
import { buildNewTrip } from '../../utils/trip-helpers'
import { createTrip, updateTrip } from '../../utils/db'
import { useMe } from '../../store/me-store'
import { useThemeClass } from '../../utils/theme-class'
import { newAITaskId, fireAITask } from '../../utils/ai-task'
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
  const themeCls = useThemeClass('new-trip')
  const openid = me?.openid || ''
  const [submitting, setSubmitting] = useState(false)
  const [aiFormOpen, setAiFormOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (router.params?.openAI === '1') {
      setAiFormOpen(true)
    }
  }, [router.params])

  const canSubmit = !!name.trim() && !!openid && pax >= 1 && !dayjs(dates.end).isBefore(dates.start)

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      const input = buildNewTrip({ name, pax, startDate: dates.start, endDate: dates.end, destinations })
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

  const handleAiSubmit = async (prefs: AIPreferences) => {
    if (!name.trim()) {
      Taro.showToast({ title: '请先填写攻略名', icon: 'none' })
      return
    }
    if (!destinations.length) {
      Taro.showToast({ title: '请先选择目的地', icon: 'none' })
      return
    }
    if (!canSubmit) return
    setAiFormOpen(false)
    Taro.showLoading({ title: '准备中…' })
    try {
      // 1. 用空 days 创建 trip
      const input = buildNewTrip({ name, pax, startDate: dates.start, endDate: dates.end, destinations })
      input.ownerOpenid = openid
      input.ownerNickname = me?.nickname || '行册旅人'
      input.ownerAvatarUrl = me?.avatarUrl || ''
      const tripId = await createTrip(input)

      // 2. 先把 aiTaskId / aiStatus 落库 (云函数 checkCancelled 会读这条记录)
      const taskId = newAITaskId()
      await updateTrip(tripId, { aiTaskId: taskId, aiStatus: 'generating', aiDraft: null, aiError: null }, openid)

      // 3. 再触发云函数 (fire-and-forget)
      fireAITask(taskId, {
        tripId,
        tripContext: { name: input.name, destinations, startDate: dates.start, endDate: dates.end, pax },
        preferences: prefs,
      })

      Taro.hideLoading()
      Taro.showToast({ title: 'AI 正在生成…', icon: 'none', duration: 1200 })
      // 跳回首页, 用户在首页看 generating 状态条
      setTimeout(() => Taro.reLaunch({ url: '/pages/home/index' }), 800)
    } catch (e: unknown) {
      Taro.hideLoading()
      console.error('[ai submit]', e)
      Taro.showToast({ title: 'AI 启动失败', icon: 'none' })
    }
  }

  return (
    <View className={themeCls}>
      <View className='nt-field'>
        <Text className='nt-label'>攻略名</Text>
        <Input className='nt-input' placeholder='例：南京 · 金陵四日' value={name} onInput={e => setName(e.detail.value)} />
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
          <Button className='nt-cancel' onClick={() => Taro.navigateBack()}>取消</Button>
          <Button className='nt-submit' disabled={!canSubmit || submitting} onClick={submit}>
            {submitting ? '创建中...' : '创建'}
          </Button>
        </View>

        <Button className='nt-submit-ai' disabled={!canSubmit} onClick={() => setAiFormOpen(true)}>
          ✨ AI 帮我规划
        </Button>
      </View>

      <AIPlanForm
        open={aiFormOpen}
        onClose={() => setAiFormOpen(false)}
        onSubmit={handleAiSubmit}
      />

      <AIInterview
        open={aiFormOpen}
        onClose={() => setAiFormOpen(false)}
        onSubmit={(prefs) => { setAiFormOpen(false); void handleAiSubmit(prefs) }}
      />
    </View>
  )
}
