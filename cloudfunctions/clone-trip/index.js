const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const { sourceTripId, token } = event || {}
  if (!sourceTripId || !token) throw new Error('sourceTripId and token required')

  const db = cloud.database()
  const _ = db.command

  const tokenQuery = await db.collection('share_tokens').where({ token }).get()
  const t = tokenQuery.data[0]
  if (!t) throw new Error('token invalid')
  if (t.kind !== 'readonly') throw new Error('token kind mismatch')
  if (Date.now() > t.expiresAt) throw new Error('token expired')
  if (t.tripId !== sourceTripId) throw new Error('tripId mismatch')

  const src = await db.collection('trips').doc(sourceTripId).get().catch(() => null)
  if (!src || !src.data) throw new Error('source trip not found')

  // 排除身份/时间戳字段，其它字段全量克隆
  const {
    _id: _srcId,
    _openid: _srcOpenid,
    ownerOpenid: _srcOwner,
    ownerNickname: _srcOwnerNick,
    ownerAvatarUrl: _srcOwnerAvatar,
    collaborators: _srcCollabs,
    collaboratorOpenids: _srcCollabIds,
    createdAt: _srcCreatedAt,
    updatedAt: _srcUpdatedAt,
    updatedBy: _srcUpdatedBy,
    aiTaskId: _srcAiTaskId,
    aiStatus: _srcAiStatus,
    aiDraft: _srcAiDraft,
    aiError: _srcAiError,
    ...rest
  } = src.data

  // 拉当前用户资料，写入新攻略的 owner 字段
  const meDoc = await db.collection('users').doc(OPENID).get().catch(() => null)
  const me = (meDoc && meDoc.data) || {}

  const now = Date.now()
  const created = await db.collection('trips').add({
    data: {
      _openid: OPENID,
      ...rest,
      ownerOpenid: OPENID,
      ownerNickname: me.nickname || '行迹旅人',
      ownerAvatarUrl: me.avatarUrl || '',
      collaborators: [],
      collaboratorOpenids: [],
      createdAt: now,
      updatedAt: now,
      updatedBy: OPENID,
    }
  })

  await db.collection('share_tokens').doc(t._id).update({
    data: { usedBy: _.addToSet(OPENID) }
  })

  return { newTripId: created._id }
}
