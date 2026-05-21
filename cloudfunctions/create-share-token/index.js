const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const { tripId, kind } = event || {}
  if (!tripId) throw new Error('tripId required')
  if (kind !== 'readonly' && kind !== 'collab') {
    throw new Error('kind must be readonly or collab')
  }

  const db = cloud.database()
  const trip = await db.collection('trips').doc(tripId).get().catch(() => null)
  if (!trip || !trip.data) throw new Error('trip not found')
  if (trip.data._openid !== OPENID) throw new Error('only owner can share')

  const token = crypto.randomBytes(16).toString('hex')
  const now = Date.now()

  await db.collection('share_tokens').add({
    data: {
      token,
      tripId,
      kind,
      createdBy: OPENID,
      createdAt: now,
      expiresAt: now + SEVEN_DAYS_MS,
      usedBy: [],
    }
  })

  return { token }
}
