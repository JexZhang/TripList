const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const PLACEHOLDER_NICKNAME = '行迹旅人'

/** 校验 collab share token */
async function validateToken(db, token, tripId) {
  const tokenQuery = await db.collection('share_tokens').where({ token }).get()
  const t = tokenQuery.data[0]
  if (!t) throw new Error('token invalid')
  if (t.kind !== 'collab') throw new Error('token kind mismatch')
  if (Date.now() > t.expiresAt) throw new Error('token expired')
  if (t.tripId !== tripId) throw new Error('tripId mismatch')
  return t
}

async function ensureUserDocument(db, openid, now) {
  const ref = db.collection('users').doc(openid)
  const existing = await ref.get().catch(() => null)
  if (existing && existing.data) {
    await ref.update({ data: { lastSeenAt: now } }).catch(() => {})
    return existing.data
  }

  const user = {
    _id: openid,
    nickname: PLACEHOLDER_NICKNAME,
    avatarUrl: '',
    theme: null,
    plan: 'free',
    createdAt: now,
    lastSeenAt: now,
  }
  await db.collection('users').add({ data: user })
  return user
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const { tripId, token, action } = event || {}
  if (!tripId || !token) throw new Error('tripId and token required')

  const db = cloud.database()
  const _ = db.command

  // ── preview: 通过 token 获取攻略预览信息（分享页展示用）──
  if (action === 'preview') {
    await validateToken(db, token, tripId)
    const trip = await db.collection('trips').doc(tripId).get().catch(() => null)
    if (!trip || !trip.data) throw new Error('trip not found')
    const d = trip.data
    return {
      ok: true,
      trip: {
        _id: d._id,
        name: d.name,
        startDate: d.startDate,
        endDate: d.endDate,
        destinations: d.destinations || [],
        pax: d.pax,
        coverImage: d.coverImage,
        theme: d.theme,
      },
    }
  }

  // ── join: 加入协作 ──
  const t = await validateToken(db, token, tripId)

  const trip = await db.collection('trips').doc(tripId).get().catch(() => null)
  if (!trip || !trip.data) throw new Error('trip not found')

  // owner 加入是无操作
  if (trip.data._openid === OPENID) {
    return { ok: true, alreadyOwner: true }
  }

  // 已加入也是无操作
  const now = Date.now()
  const user = await ensureUserDocument(db, OPENID, now)

  // Already joined is a no-op after repairing any missing users document.
  const collabs = trip.data.collaborators || []
  if (collabs.some(c => c.openid === OPENID)) {
    return { ok: true, alreadyJoined: true }
  }

  await db.collection('trips').doc(tripId).update({
    data: {
      collaborators: _.push([{
        openid: OPENID,
        nickname: user.nickname || PLACEHOLDER_NICKNAME,
        avatarUrl: user.avatarUrl || '',
        role: 'editor',
        joinedAt: now,
      }]),
      collaboratorOpenids: _.addToSet(OPENID),
      updatedAt: now,
      updatedBy: OPENID,
    }
  })

  await db.collection('share_tokens').doc(t._id).update({
    data: { usedBy: _.addToSet(OPENID) }
  })

  return { ok: true }
}
