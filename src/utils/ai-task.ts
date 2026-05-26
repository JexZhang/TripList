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

/** 仅生成 taskId, 不发请求. 调用方需先把 taskId 写到 trip.aiTaskId 落库, 再 fireAITask. */
export function newAITaskId(): string {
  return generateTaskId()
}

/** fire-and-forget 触发云函数. 必须在 updateTrip(aiTaskId=taskId) 落库之后再调, 否则
 *  云函数 runLoop 第一轮的 checkCancelled 会读到旧的 aiTaskId, 立即抛 CANCELLED. */
export function fireAITask(taskId: string, p: StartParams): void {
  if (!p.tripId) throw new Error('fireAITask: tripId is required')
  ;(Taro as { cloud?: { callFunction: (args: unknown) => Promise<unknown> } }).cloud?.callFunction({
    name: 'ai-plan-trip',
    data: { _mode: 'plan', taskId, ...p },
  })?.catch((err: { errMsg?: string }) => {
    console.warn('[fireAITask] callFunction settled:', err?.errMsg)
  })
}

/**
 * @deprecated 存在竞态: 云函数会在客户端 updateTrip 落库前先读 trip, 看到旧 aiTaskId
 * 立即被判 CANCELLED. 改用 newAITaskId() + await updateTrip + fireAITask().
 */
export function startAITask(p: StartParams): string {
  const taskId = newAITaskId()
  fireAITask(taskId, p)
  return taskId
}
