const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const db = cloud.database()
  const _ = db.command

  const res = await db.collection('trips')
    .where(_.or([
      { _openid: OPENID },
      { 'collaborators.openid': OPENID },
    ]))
    .orderBy('updatedAt', 'desc')
    .limit(100)
    .get()

  return { trips: res.data || [] }
}
