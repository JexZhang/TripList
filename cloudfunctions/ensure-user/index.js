const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    throw new Error('OPENID missing — not called from miniprogram')
  }
  const { nickname, avatarUrl } = event || {}
  const db = cloud.database()
  const now = Date.now()

  // 用 OPENID 作为 _id，简化查找
  const existing = await db.collection('users').doc(OPENID).get().catch(() => null)

  if (existing && existing.data) {
    await db.collection('users').doc(OPENID).update({
      data: {
        nickname: nickname || existing.data.nickname || '',
        avatarUrl: avatarUrl || existing.data.avatarUrl || '',
        lastSeenAt: now,
      }
    })
  } else {
    await db.collection('users').add({
      data: {
        _id: OPENID,
        nickname: nickname || '行册旅人',
        avatarUrl: avatarUrl || '',
        createdAt: now,
        lastSeenAt: now,
      }
    })
  }

  return { openid: OPENID }
}
