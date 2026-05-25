const cloud = require('wx-server-sdk')

const COL = 'ai_tasks'

async function createTask({ openid, tripId, modelAlias, tripContext, preferences }) {
  const db = cloud.database()
  const now = Date.now()
  const res = await db.collection(COL).add({
    data: {
      _openid: openid,
      tripId: tripId || null,
      status: 'pending',
      modelAlias,
      tripContext,
      preferences,
      progress: { days: [] },
      result: null,
      error: null,
      meta: { turns: 0 },
      createdAt: now,
      updatedAt: now,
    },
  })
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

module.exports = { createTask, updateTask, getTask, COL }
