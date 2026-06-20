const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireOpenid } = require('../_shared/auth-helper')

/**
 * delete-account: 注销账号并删除所有关联数据
 * 微信云数据库 where().get() 单次最多 100 条，需分批处理
 */
exports.main = async (event) => {
  const OPENID = requireOpenid()
  const db = cloud.database()
  const errors = []

  console.log(`[delete-account] start for ${OPENID}`)

  // ── 辅助：分批删除集合中所有匹配文档 ──
  async function batchRemove(collName, query) {
    let total = 0
    let batch
    do {
      batch = await db.collection(collName).where(query).limit(100).get()
      for (const doc of batch.data) {
        await db.collection(collName).doc(doc._id).remove()
      }
      total += batch.data.length
    } while (batch.data.length > 0)
    return total
  }

  // 1. 删除用户作为 owner 的所有 trips
  try {
    const n = await batchRemove('trips', { _openid: OPENID })
    console.log(`[delete-account] removed ${n} owned trips`)
  } catch (e) {
    errors.push(`trips: ${e.message}`)
    console.error('[delete-account] trips removal failed:', e.message)
  }

  // 2. 从他人 trips 的 collaborators/collaboratorOpenids 中移除自己
  try {
    const collabTrips = await db.collection('trips').where({
      'collaborators.openid': OPENID,
    }).limit(100).get()
    for (const t of collabTrips.data) {
      const collabs = (t.collaborators || []).filter(c => c.openid !== OPENID)
      const collabIds = (t.collaboratorOpenids || []).filter(id => id !== OPENID)
      await db.collection('trips').doc(t._id).update({
        data: { collaborators: collabs, collaboratorOpenids: collabIds, updatedAt: Date.now() },
      })
    }
    console.log(`[delete-account] removed from ${collabTrips.data.length} collab trips`)
  } catch (e) {
    errors.push(`collab: ${e.message}`)
    console.error('[delete-account] collab cleanup failed:', e.message)
  }

  // 3. 删除 ai_tasks 中该用户的所有任务
  try {
    const n = await batchRemove('ai_tasks', { _openid: OPENID })
    console.log(`[delete-account] removed ${n} ai tasks`)
  } catch (e) {
    errors.push(`ai_tasks: ${e.message}`)
    console.error('[delete-account] ai_tasks removal failed:', e.message)
  }

  // 4. 删除 ai_daily_usage 中该用户的所有用量记录
  try {
    const n = await batchRemove('ai_daily_usage', { _openid: OPENID })
    console.log(`[delete-account] removed ${n} usage records`)
  } catch (e) {
    errors.push(`ai_daily_usage: ${e.message}`)
    console.error('[delete-account] usage removal failed:', e.message)
  }

  // 5. 删除 share_tokens 中该用户创建的所有 token
  try {
    const n = await batchRemove('share_tokens', { _openid: OPENID })
    console.log(`[delete-account] removed ${n} share tokens`)
  } catch (e) {
    errors.push(`share_tokens: ${e.message}`)
    console.error('[delete-account] share_tokens removal failed:', e.message)
  }

  // 6. 清理 sec_check_records 中该用户的异步审核记录
  try {
    const n = await batchRemove('sec_check_records', { _openid: OPENID })
    console.log(`[delete-account] removed ${n} sec check records`)
  } catch (e) {
    errors.push(`sec_check_records: ${e.message}`)
    console.error('[delete-account] sec_check_records cleanup failed:', e.message)
  }

  // 7. 最后删除 users 集合中该用户文档（必须最后，保证失败时可重试）
  try {
    await db.collection('users').doc(OPENID).remove()
    console.log('[delete-account] removed user doc')
  } catch (e) {
    errors.push(`users: ${e.message}`)
    console.error('[delete-account] user doc removal failed:', e.message)
  }

  console.log(`[delete-account] done for ${OPENID}, errors: ${errors.length}`)
  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return { ok: true }
}
