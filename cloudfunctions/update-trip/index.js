const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 允许通过本函数修改的字段(白名单,防止协作者改 _openid / ownerOpenid 等)
const ALLOWED_FIELDS = [
  'name',
  'pax',
  'startDate',
  'endDate',
  'destinations',
  'days',
  'packing',
]

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

  // 只保留白名单字段
  const cleaned = {}
  for (const k of ALLOWED_FIELDS) {
    if (patch[k] !== undefined) cleaned[k] = patch[k]
  }
  cleaned.updatedAt = Date.now()
  cleaned.updatedBy = OPENID

  await db.collection('trips').doc(tripId).update({ data: cleaned })
  return { ok: true }
}
