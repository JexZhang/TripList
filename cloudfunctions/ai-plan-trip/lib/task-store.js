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

/** 仅读 trips 的 _id + aiTaskId, 用于 checkCancelled. 失败返回 null. */
async function getTripLight(tripId) {
  const db = cloud.database()
  const r = await db.collection('trips')
    .doc(tripId)
    .field({ _id: true, aiTaskId: true })
    .get()
    .catch(() => null)
  return r && r.data ? r.data : null
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
