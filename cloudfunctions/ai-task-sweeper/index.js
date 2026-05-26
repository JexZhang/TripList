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
    let tripsRecovered = 0
    for (const t of data) {
      try {
        // 1. 标记 task 为 error
        await db.collection(COL).doc(t._id).update({
          data: {
            status: 'error',
            error: '后台执行超时(被回收)',
            updatedAt: now,
          },
        })
        swept++

        // 2. 若 task 关联了 trip 且 trip.aiTaskId 仍是这条 task, 把 trip 状态清回 error
        //    用 where(_id, aiTaskId) 条件更新, DB 层原子保证不会误伤已被覆盖的新任务
        if (t.tripId) {
          try {
            const recoverRes = await db.collection('trips')
              .where({ _id: t.tripId, aiTaskId: t._id })
              .update({
                data: {
                  aiStatus: 'error',
                  aiError: '后台执行超时(被回收)',
                  aiDraft: null,
                  updatedAt: now,
                },
              })
            if (recoverRes && recoverRes.stats && recoverRes.stats.updated > 0) {
              tripsRecovered++
            }
          } catch (tripErr) {
            console.error('[sweeper] trip recovery failed', t.tripId, tripErr.message)
          }
        }
      } catch (e) {
        console.error('[sweeper] task update failed', t._id, e.message)
      }
    }

    console.log(`[sweeper] swept ${swept}/${data.length} stale tasks, recovered ${tripsRecovered} trips`)
    return { swept, scanned: data.length, tripsRecovered }
  } catch (e) {
    console.error('[sweeper] fatal', e)
    return { error: e.message }
  }
}
