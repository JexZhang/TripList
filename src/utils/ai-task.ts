import Taro from '@tarojs/taro'
import type { AITask, AIPreferences, GeneratedPlan } from '../types/trip'

interface StartParams {
  tripContext: {
    name: string
    destinations: any[]
    startDate: string
    endDate: string
    pax: number
  }
  preferences: AIPreferences
  tripId?: string
  previousResult?: GeneratedPlan
  userFeedback?: string
}

/** 客户端预生成 taskId, 用作 ai_tasks 集合的 _id */
function generateTaskId(): string {
  // 24 字节: 8 时间戳 + 16 随机. 与 ai_tasks 的 _id 风格兼容
  const ts = Date.now().toString(36)
  const rand = Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('')
  return `${ts}${rand}`.slice(0, 32)
}

/**
 * 启动 AI 任务. 流程:
 *  1. 客户端生成 taskId
 *  2. 触发 cloud.callFunction 但不 await (云函数会跑完它自己的 600s, 客户端 RPC 超时与否都不影响服务端)
 *  3. 立刻返回 taskId, 让调用方建立 watcher
 *
 *  为什么不 await: 微信小程序云函数最大单次 RPC 实际可观察 timeout 约 60s, 但 AI 生成可能 3-5 分钟.
 *  await 必然报 timeout. 不 await 则客户端不等待, 服务端继续跑, 进度通过 watcher 看 DB.
 */
export function startAITask(p: StartParams): string {
  const taskId = generateTaskId()
  // 故意不 await. catch 留底, 避免 unhandled rejection
  ;(Taro as any).cloud.callFunction({
    name: 'ai-plan-trip',
    data: { _mode: 'plan', taskId, ...p },
  }).catch((err: any) => {
    // 客户端超时是预期的, 服务端仍在跑. 真错误才打 warn
    console.warn('[startAITask] callFunction settled (likely client-side timeout, server keeps running):', err && err.errMsg)
  })
  return taskId
}

export interface TaskWatcher {
  close: () => void
}

/**
 * 订阅一条 ai_tasks 记录。onChange 会在任务 update 时被调用。
 * 返回的 watcher.close() 用来取消订阅。
 */
export function watchAITask(taskId: string, onChange: (t: AITask) => void): TaskWatcher {
  const db = (Taro as any).cloud.database()
  // 注意: 用 .where({_id}) 而非 .doc().watch(), 兼容性更稳, 也是官方文档推荐写法
  const watcher = db.collection('ai_tasks').where({ _id: taskId }).watch({
    onChange: (snap: any) => {
      if (snap && snap.docs && snap.docs[0]) onChange(snap.docs[0] as AITask)
    },
    onError: (err: any) => console.error('[watchAITask]', err),
  })
  return { close: () => { try { watcher.close() } catch (_) {} } }
}

/** 兜底:任务 > 10s 仍 pending 视为失败 */
export const PENDING_TIMEOUT_MS = 10000

/**
 * 心跳超时:streaming 状态下 updatedAt 距今超过 STREAMING_HEARTBEAT_MS
 * 视为后台被强杀, 前端主动报错
 */
export const STREAMING_HEARTBEAT_MS = 180_000

// ============ 持久化:让用户关闭弹窗/切页/重进小程序后能恢复任务 ============

export interface PersistedAITask {
  taskId: string
  prefs: AIPreferences
  /** new-trip 页用的 trip 上下文; trip 页留空 */
  tripContext?: StartParams['tripContext']
  /** 'new-trip' 或 trip 页的 tripId */
  scope: string
  startedAt: number
}

const STORAGE_PREFIX = 'ai_task_pending::'

function storageKey(scope: string) {
  return STORAGE_PREFIX + scope
}

export function savePendingTask(rec: PersistedAITask): void {
  try {
    Taro.setStorageSync(storageKey(rec.scope), rec)
  } catch (e) {
    console.error('[ai-task] savePendingTask failed', e)
  }
}

export function loadPendingTask(scope: string): PersistedAITask | null {
  try {
    const v = Taro.getStorageSync(storageKey(scope))
    if (v && typeof v === 'object' && v.taskId) return v as PersistedAITask
  } catch (_) {}
  return null
}

export function clearPendingTask(scope: string): void {
  try { Taro.removeStorageSync(storageKey(scope)) } catch (_) {}
}

/** 启动后立即调用一次 get, 确认任务还活着 (用于恢复场景) */
export async function getAITask(taskId: string): Promise<AITask | null> {
  try {
    const db = (Taro as any).cloud.database()
    const r = await db.collection('ai_tasks').doc(taskId).get()
    return r && r.data ? (r.data as AITask) : null
  } catch (e) {
    console.error('[getAITask]', e)
    return null
  }
}
