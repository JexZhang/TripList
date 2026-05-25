const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const COL = 'ai_tasks'
// 静默阈值: streaming/pending 状态超过 10 分钟无 update -> 视为僵尸任务
const STALE_MS = 10 * 60 * 1000

exports.main = async () => {
  const db = cloud.database()
  const _ = db.command
  const now = Date.now()
  const cutoff = now - STALE_MS

  try {
    const { data } = await db.collection(COL)
      .where({
        status: _.in(['pending', 'streaming']),
        updatedAt: _.lt(cutoff),
      })
      .limit(50)
      .get()

    if (!data || data.length === 0) {
      return { swept: 0 }
    }

    let swept = 0
    for (const t of data) {
      try {
        await db.collection(COL).doc(t._id).update({
          data: {
            status: 'error',
            error: '后台执行超时(被回收)',
            updatedAt: now,
          },
        })
        swept++
      } catch (e) {
        console.error('[sweeper] update failed', t._id, e.message)
      }
    }

    console.log(`[sweeper] swept ${swept}/${data.length} stale tasks`)
    return { swept, scanned: data.length }
  } catch (e) {
    console.error('[sweeper] fatal', e)
    return { error: e.message }
  }
}
