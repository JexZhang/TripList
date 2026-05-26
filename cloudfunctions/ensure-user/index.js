const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const VALID_THEMES = ['tegami', 'magazine', 'postcard', 'minimal']

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    throw new Error('OPENID missing — not called from miniprogram')
  }
  const { nickname, avatarUrl, theme } = event || {}
  const safeTheme = VALID_THEMES.includes(theme) ? theme : undefined

  const db = cloud.database()
  const now = Date.now()

  const existing = await db.collection('users').doc(OPENID).get().catch(() => null)

  if (existing && existing.data) {
    const updateData = {
      nickname: nickname || existing.data.nickname || '',
      avatarUrl: avatarUrl || existing.data.avatarUrl || '',
      lastSeenAt: now,
    }
    if (safeTheme !== undefined) {
      updateData.theme = safeTheme
    }
    await db.collection('users').doc(OPENID).update({ data: updateData })
  } else {
    await db.collection('users').add({
      data: {
        _id: OPENID,
        nickname: nickname || '行册旅人',
        avatarUrl: avatarUrl || '',
        theme: safeTheme || null,
        createdAt: now,
        lastSeenAt: now,
      },
    })
  }

  const fresh = await db.collection('users').doc(OPENID).get().catch(() => null)
  const u = (fresh && fresh.data) || {}
  return {
    openid: OPENID,
    nickname: u.nickname || nickname || '行册旅人',
    avatarUrl: u.avatarUrl || avatarUrl || '',
    theme: u.theme || null,
  }
}
