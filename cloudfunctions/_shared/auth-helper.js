const cloud = require('wx-server-sdk')

/**
 * 从 cloud context 获取 OPENID，缺失则 throw
 */
function requireOpenid() {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')
  return OPENID
}

/**
 * 读取 trip 并校验 owner，返回 trip doc
 */
async function requireTripOwner(db, tripId, openid) {
  const trip = await db.collection('trips').doc(tripId).get().catch(() => null)
  if (!trip || !trip.data) throw new Error('trip not found')
  if (trip.data._openid !== openid) throw new Error('forbidden: not owner')
  return trip.data
}

/**
 * 读取 trip 并校验 owner 或 collaborator，返回 { trip, isOwner, isCollab }
 */
async function requireTripAccess(db, tripId, openid) {
  const trip = await db.collection('trips').doc(tripId).get().catch(() => null)
  if (!trip || !trip.data) throw new Error('trip not found')
  const isOwner = trip.data._openid === openid
  const isCollab = (trip.data.collaboratorOpenids || []).includes(openid)
  if (!isOwner && !isCollab) throw new Error('forbidden')
  return { trip: trip.data, isOwner, isCollab }
}

module.exports = { requireOpenid, requireTripOwner, requireTripAccess }
