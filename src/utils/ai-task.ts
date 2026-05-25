import Taro from '@tarojs/taro'
import type { AIPreferences, GeneratedPlan } from '../types/trip'

interface StartParams {
  tripId: string  // 现在必传, 新建场景在调用前先 createTrip 拿到 _id
  tripContext: {
    name: string
    destinations: unknown[]
    startDate: string
    endDate: string
    pax: number
  }
  preferences: AIPreferences
  previousResult?: GeneratedPlan
  userFeedback?: string
}

/** 客户端预生成 taskId, 用作 ai_tasks 集合的 _id */
function generateTaskId(): string {
  const ts = Date.now().toString(36)
  const rand = Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('')
  return `${ts}${rand}`.slice(0, 32)
}

/**
 * 启动 AI 任务. fire-and-forget:
 *  - 客户端生成 taskId 并立即返回
 *  - 云函数在后台跑完整个 600s timeout, 进度和终态都直接写 trip 文档
 *  - 客户端只需 watch trip 文档 (现有 trip-store 已订阅), 不再订阅 ai_tasks
 *
 * 调用方流程通常是:
 *   1. await createTrip(...)  // 拿 tripId
 *   2. const taskId = startAITask({ tripId, ... })
 *   3. await updateTrip(tripId, { aiTaskId: taskId, aiStatus: 'generating' }, openid)
 *   4. redirect 或留页, trip-store watch 会推送 aiStatus 变化
 */
export function startAITask(p: StartParams): string {
  if (!p.tripId) throw new Error('startAITask: tripId is required')
  const taskId = generateTaskId()
  ;(Taro as { cloud?: { callFunction: (args: unknown) => Promise<unknown> } }).cloud?.callFunction({
    name: 'ai-plan-trip',
    data: { _mode: 'plan', taskId, ...p },
  })?.catch((err: { errMsg?: string }) => {
    // 客户端 RPC 超时是预期的, 服务端仍在跑. log 一下就好
    console.warn('[startAITask] callFunction settled:', err?.errMsg)
  })
  return taskId
}
