const cloud = require('wx-server-sdk')
const { isValidISODate, rebaseTemplateDates } = require('./rebase')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const TEMPLATES = 'trip_templates'
const TRIPS = 'trips'

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const { templateId, startDate } = event || {}
  if (!templateId) throw new Error('templateId required')
  if (!isValidISODate(startDate)) throw new Error('startDate must be YYYY-MM-DD')

  const db = cloud.database()

  const tplDoc = await db.collection(TEMPLATES).doc(templateId).get().catch(() => null)
  if (!tplDoc || !tplDoc.data) throw new Error('template not found')

  // 剥离:文档主键 + 模板专属字段 + (模板本不该有的)身份/AI 字段,留下纯行程内容
  const {
    _id: _tplId,
    _openid: _tplOpenid,
    city: _city,
    region: _region,
    dayCount: _dayCount,
    spotCount: _spotCount,
    tags: _tags,
    audience: _audience,
    seasons: _seasons,
    featured: _featured,
    sortWeight: _sortWeight,
    coverImages: _coverImages,
    version: _version,
    ownerOpenid: _o1,
    ownerNickname: _o2,
    ownerAvatarUrl: _o3,
    collaborators: _c1,
    collaboratorOpenids: _c2,
    createdAt: _ca,
    updatedAt: _ua,
    updatedBy: _ub,
    aiTaskId: _ai1,
    aiStatus: _ai2,
    aiDraft: _ai3,
    aiError: _ai4,
    days: tplDays = [],
    ...rest
  } = tplDoc.data

  const { days, startDate: s, endDate } = rebaseTemplateDates(tplDays, startDate)

  // 拉当前用户资料,写入新攻略 owner
  const meDoc = await db.collection('users').doc(OPENID).get().catch(() => null)
  const me = (meDoc && meDoc.data) || {}

  const now = Date.now()
  const created = await db.collection(TRIPS).add({
    data: {
      ...rest,
      days,
      startDate: s,
      endDate,
      ownerOpenid: OPENID,
      ownerNickname: me.nickname || '行册旅人',
      ownerAvatarUrl: me.avatarUrl || '',
      collaborators: [],
      collaboratorOpenids: [],
      createdAt: now,
      updatedAt: now,
      updatedBy: OPENID,
    },
  })

  return { newTripId: created._id }
}
