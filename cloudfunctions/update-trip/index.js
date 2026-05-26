const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const ALLOWED_FIELDS = [
  'name',
  'pax',
  'startDate',
  'endDate',
  'destinations',
  'days',
  'packing',
  'aiTaskId',
  'aiStatus',
  'aiDraft',
  'aiError',
  'coverUrl',
]

// 这些字段只能 owner 改 (协作者不能触发/停止/应用 AI)
const OWNER_ONLY_FIELDS = new Set(['aiTaskId', 'aiStatus', 'aiDraft', 'aiError'])

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const { tripId, patch } = event || {}
  if (!tripId || !patch || typeof patch !== 'object') {
    throw new Error('tripId and patch required')
  }

  const db = cloud.database()
  const trip = await db.collection('trips').doc(tripId).get().catch(() => null)
  if (!trip || !trip.data) throw new Error('trip not found')

  const isOwner = trip.data._openid === OPENID
  const collabIds = trip.data.collaboratorOpenids || []
  const isCollab = collabIds.includes(OPENID)
  if (!isOwner && !isCollab) {
    throw new Error('forbidden: not owner or collaborator')
  }

  const cleaned = {}
  for (const k of ALLOWED_FIELDS) {
    if (patch[k] === undefined) continue
    if (OWNER_ONLY_FIELDS.has(k) && !isOwner) {
      throw new Error(`forbidden: 协作者不能修改 ${k}`)
    }
    cleaned[k] = patch[k]
  }
  cleaned.updatedAt = Date.now()
  cleaned.updatedBy = OPENID

  // aiDraft/aiTaskId/aiStatus/aiError 写 null 是有意的 (清空草稿), 直接 update 走 dot-path 没问题
  // 因为它们的字段原本就是顶层标量/对象, 不存在嵌套, 不会有上一次"result=null"那种 502001 bug
  await db.collection('trips').doc(tripId).update({ data: cleaned })
  return { ok: true }
}
