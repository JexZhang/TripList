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

export async function startAITask(p: StartParams): Promise<string> {
  const r: any = await (Taro as any).cloud.callFunction({
    name: 'ai-plan-trip',
    data: { _mode: 'start', ...p },
  })
  const taskId = r && r.result && r.result.taskId
  if (!taskId) throw new Error('启动 AI 任务失败')
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
