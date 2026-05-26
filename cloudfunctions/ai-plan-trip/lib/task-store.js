const cloud = require('wx-server-sdk')

const COL = 'ai_tasks'

async function createTask({ taskId, openid, tripId, modelAlias, tripContext, preferences }) {
  const db = cloud.database()
  const now = Date.now()
  const data = {
    _openid: openid,
    tripId: tripId || null,
    status: 'pending',
    modelAlias,
    tripContext,
    preferences,
    // 不再写 progress (前端不订阅 ai_tasks)
    result: {},  // 初始化为空对象, 避免后续 dot-path 写入 result.xxx 时 502001
    error: null,
    meta: { turns: 0 },
    createdAt: now,
    updatedAt: now,
  }
  if (taskId) data._id = taskId
  const res = await db.collection(COL).add({ data })
  return res._id
}

async function updateTask(taskId, patch) {
  const db = cloud.database()
  await db.collection(COL).doc(taskId).update({
    data: { ...patch, updatedAt: Date.now() },
  })
}

async function getTask(taskId) {
  const db = cloud.database()
  const r = await db.collection(COL).doc(taskId).get().catch(() => null)
  return r && r.data ? r.data : null
}

/** 仅读 trips 的 _id + aiTaskId, 用于 checkCancelled.
 *  - 文档不存在: 返回 null (说明 trip 被删了, 上层应放弃);
 *  - 网络/DB 错误: 抛 transient 错误, 不要静默吞成 null —— 否则 checkCancelled 会把
 *    单次抖动误判为"用户取消", 触发 false-cancel + 回收路径. */
async function getTripLight(tripId) {
  const db = cloud.database()
  try {
    const r = await db.collection('trips')
      .doc(tripId)
      .field({ _id: true, aiTaskId: true })
      .get()
    return r && r.data ? r.data : null
  } catch (e) {
    // 文档不存在 (errCode -502002 / -1 / DOCUMENT_NOT_EXIST): 当 null 处理
    const code = e && (e.errCode || e.code)
    const msg = (e && e.errMsg || '').toLowerCase()
    if (code === -502002 || msg.includes('not exist') || msg.includes('document.get:fail')) {
      return null
    }
    // 其他错误向上抛, 让 checkCancelled 自己决定是 retry 还是 throw
    const err = new Error(`getTripLight transient: ${e.message || e}`)
    err.transient = true
    throw err
  }
}

/** 终结写入 trip; 若 trip.aiTaskId !== myTaskId, 放弃写入 (用户已停止或重新生成). */
async function finalizeTrip(tripId, myTaskId, patch) {
  const t = await getTripLight(tripId)
  if (!t) {
    console.warn('[finalizeTrip] trip 已不存在, taskId=', myTaskId)
    return { written: false, reason: 'trip-missing' }
  }
  if (t.aiTaskId !== myTaskId) {
    console.warn('[finalizeTrip] task superseded, current trip.aiTaskId=', t.aiTaskId, 'my=', myTaskId)
    return { written: false, reason: 'superseded' }
  }
  const db = cloud.database()
  try {
    await db.collection('trips').doc(tripId).update({
      data: { ...patch, updatedAt: Date.now() },
    })
    return { written: true }
  } catch (e) {
    console.error('[finalizeTrip] update failed', e && e.message)
    return { written: false, reason: 'db-error', error: e && e.message }
  }
}

module.exports = { createTask, updateTask, getTask, getTripLight, finalizeTrip, COL }
