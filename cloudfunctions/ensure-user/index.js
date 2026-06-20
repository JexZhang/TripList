const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { checkText, checkImage, recordCheck } = require('../_shared/content-security')
const { validateNickname } = require('../_shared/input-guard')

const VALID_THEMES = ['tegami', 'magazine', 'postcard', 'minimal']
const PLACEHOLDER_NICKNAME = '行迹旅人'

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

  // ── 昵称校验 + 内容审核 ──
  let cleanNickname = nickname
  if (hasNickname) {
    const nickVal = validateNickname(nickname)
    if (!nickVal.ok) throw new Error(nickVal.error)
    cleanNickname = nickVal.clean
    const nickCheck = await checkText(cleanNickname, OPENID, 1) // scene=1 资料
    if (!nickCheck.pass) throw new Error('昵称包含违规内容，请修改')
  }

  const db = cloud.database()
  const now = Date.now()

  const existing = await db.collection('users').doc(OPENID).get().catch(() => null)

  if (existing && existing.data) {
    const updateData = { lastSeenAt: now }
    if (hasNickname) updateData.nickname = cleanNickname
    if (hasAvatarUrl) updateData.avatarUrl = avatarUrl
    if (safeTheme !== undefined) updateData.theme = safeTheme
    await db.collection('users').doc(OPENID).update({ data: updateData })
  } else {
    await db.collection('users').add({
      data: {
        _id: OPENID,
        nickname: hasNickname ? cleanNickname : PLACEHOLDER_NICKNAME,
        avatarUrl: hasAvatarUrl ? avatarUrl : '',
        theme: safeTheme || null,
        plan: 'free',
        createdAt: now,
        lastSeenAt: now,
      },
    })
  }

  // ── 头像异步审核（不阻塞写入） ──
  if (hasAvatarUrl) {
    const { traceId } = await checkImage(avatarUrl, OPENID, 1)
    if (traceId) await recordCheck(traceId, 'users', OPENID, 'avatarUrl')
  }

  // ── 资料变更时，同步刷新关联 trips 中的冗余副本 ──
  // 否则攻略头部、协作者列表等读取 trip.ownerNickname / trip.collaborators
  // 会拿到行程创建/加入时的旧快照，而不是用户编辑后的最新资料。
  if (hasNickname || hasAvatarUrl) {
    // 取最新资料（统一从 DB 读一次，避免用可能不完整的入参）
    const freshForTrips = await db.collection('users').doc(OPENID).get().catch(() => null)
    const u2 = (freshForTrips && freshForTrips.data) || {}
    const ownerPatch = {}
    if (hasNickname) ownerPatch.ownerNickname = u2.nickname || PLACEHOLDER_NICKNAME
    if (hasAvatarUrl) ownerPatch.ownerAvatarUrl = u2.avatarUrl || ''

    // 1) 用户作为 owner 的行程 → 更新 ownerNickname / ownerAvatarUrl
    const ownedTrips = await db.collection('trips').where({ _openid: OPENID }).get()
    for (const t of ownedTrips.data) {
      await db.collection('trips').doc(t._id).update({ data: ownerPatch })
    }

    // 2) 用户作为协作者的行程 → 更新 collaborators 数组中对应条目
    const collabTrips = await db.collection('trips').where({
      'collaborators.openid': OPENID,
    }).get()
    for (const t of collabTrips.data) {
      const collabs = (t.collaborators || []).slice()
      const idx = collabs.findIndex(c => c.openid === OPENID)
      if (idx >= 0) {
        if (hasNickname) collabs[idx].nickname = u2.nickname || PLACEHOLDER_NICKNAME
        if (hasAvatarUrl) collabs[idx].avatarUrl = u2.avatarUrl || ''
        await db.collection('trips').doc(t._id).update({
          data: { collaborators: collabs },
        })
      }
    }
  }

  const fresh = await db.collection('users').doc(OPENID).get().catch(() => null)
  const u = (fresh && fresh.data) || {}
  return {
    openid: OPENID,
    nickname: u.nickname || PLACEHOLDER_NICKNAME,
    avatarUrl: u.avatarUrl || '',
    theme: u.theme || null,
    plan: u.plan || 'free',
  }
}
