const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const VALID_THEMES = ['tegami', 'magazine', 'postcard', 'minimal']
const PLACEHOLDER_NICKNAME = '行册旅人'

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    throw new Error('OPENID missing — not called from miniprogram')
  }
  const { nickname, avatarUrl, theme } = event || {}
  const safeTheme = VALID_THEMES.includes(theme) ? theme : undefined

  // 只有调用方显式传入非空且非占位值时才更新昵称/头像。
  // 否则保留 existing 值,避免被其他入口的默认值意外覆盖。
  const hasNickname = typeof nickname === 'string' && nickname.trim() && nickname !== PLACEHOLDER_NICKNAME
  const hasAvatarUrl = typeof avatarUrl === 'string' && avatarUrl.trim()

  const db = cloud.database()
  const now = Date.now()

  const existing = await db.collection('users').doc(OPENID).get().catch(() => null)

  if (existing && existing.data) {
    const updateData = { lastSeenAt: now }
    if (hasNickname) updateData.nickname = nickname
    if (hasAvatarUrl) updateData.avatarUrl = avatarUrl
    if (safeTheme !== undefined) updateData.theme = safeTheme
    await db.collection('users').doc(OPENID).update({ data: updateData })
  } else {
    await db.collection('users').add({
      data: {
        _id: OPENID,
        nickname: hasNickname ? nickname : PLACEHOLDER_NICKNAME,
        avatarUrl: hasAvatarUrl ? avatarUrl : '',
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
    nickname: u.nickname || PLACEHOLDER_NICKNAME,
    avatarUrl: u.avatarUrl || '',
    theme: u.theme || null,
  }
}
