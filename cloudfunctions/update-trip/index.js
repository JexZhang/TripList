const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { checkText } = require('./_shared/content-security')
const { validateTripName, validateSpotName, validateSpotNote } = require('./_shared/input-guard')

const ALLOWED_FIELDS = [
  'name',
  'pax',
  'startDate',
  'endDate',
  'destinations',
  'days',
  'packing',
  'aiTaskId',
  'aiStatus',
  'aiDraft',
  'aiError',
  'coverUrl',
]

// 这些字段只能 owner 改 (协作者不能触发/停止/应用 AI)
const OWNER_ONLY_FIELDS = new Set(['aiTaskId', 'aiStatus', 'aiDraft', 'aiError'])

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const { tripId, patch, action } = event || {}
  if (!tripId) throw new Error('tripId required')

  const db = cloud.database()
  const _ = db.command

  // action=get: 协作者通过云函数读取攻略详情（绕过客户端安全规则）
  if (action === 'get') {
    const trip = await db.collection('trips').doc(tripId).get().catch(() => null)
    if (!trip || !trip.data) throw new Error('trip not found')
    const isOwner = trip.data._openid === OPENID
    const isCollab = (trip.data.collaboratorOpenids || []).includes(OPENID)
    if (!isOwner && !isCollab) throw new Error('forbidden')
    return { ok: true, trip: trip.data }
  }

  if (!patch || typeof patch !== 'object') {
    throw new Error('patch required')
  }
  const trip = await db.collection('trips').doc(tripId).get().catch(() => null)
  if (!trip || !trip.data) throw new Error('trip not found')

  const isOwner = trip.data._openid === OPENID
  const collabIds = trip.data.collaboratorOpenids || []
  const isCollab = collabIds.includes(OPENID)
  if (!isOwner && !isCollab) {
    throw new Error('forbidden: not owner or collaborator')
  }

  // 协作者退出协作（云函数绕过客户端安全规则）
  if (patch.__leaveCollab) {
    if (isOwner) throw new Error('owner 不能退出自己的攻略')
    await db.collection('trips').doc(tripId).update({
      data: {
        collaborators: _.pull({ openid: OPENID }),
        collaboratorOpenids: _.pull(OPENID),
        updatedAt: Date.now(),
        updatedBy: OPENID,
      }
    })
    return { ok: true, left: true }
  }

  const cleaned = {}
  for (const k of ALLOWED_FIELDS) {
    if (patch[k] === undefined) continue
    if (OWNER_ONLY_FIELDS.has(k) && !isOwner) {
      throw new Error(`forbidden: 协作者不能修改 ${k}`)
    }
    cleaned[k] = patch[k]
  }
  cleaned.updatedAt = Date.now()
  cleaned.updatedBy = OPENID

  // ── 内容审核：仅审核实际变更的文本字段 ──
  if (cleaned.name !== undefined) {
    const nameVal = validateTripName(cleaned.name)
    if (!nameVal.ok) throw new Error(nameVal.error)
    if (cleaned.name !== (trip.data.name || '')) {
      const nameCheck = await checkText(nameVal.clean, OPENID, 1) // scene=1 资料
      if (!nameCheck.pass) throw new Error(nameCheck.reason)
      cleaned.name = nameVal.clean
    }
  }

  if (cleaned.days !== undefined && Array.isArray(cleaned.days)) {
    const existingDays = trip.data.days || []
    const existingSpotMap = new Map()
    for (const d of existingDays) {
      for (const s of (d.spots || [])) {
        if (s._id) existingSpotMap.set(s._id, s)
      }
    }
    for (const day of cleaned.days) {
      for (const spot of (day.spots || [])) {
        const existing = spot._id ? existingSpotMap.get(spot._id) : null
        if (spot.name !== undefined) {
          const spotNameVal = validateSpotName(spot.name)
          if (!spotNameVal.ok) throw new Error(spotNameVal.error)
          spot.name = spotNameVal.clean
          if (!existing || spot.name !== existing.name) {
            const spotNameCheck = await checkText(spotNameVal.clean, OPENID, 2)
            if (!spotNameCheck.pass) throw new Error(spotNameCheck.reason)
          }
        }
        if (spot.note !== undefined) {
          const spotNoteVal = validateSpotNote(spot.note)
          if (!spotNoteVal.ok) throw new Error(spotNoteVal.error)
          spot.note = spotNoteVal.clean
          if (!existing || spot.note !== (existing.note || '')) {
            const noteCheck = await checkText(spotNoteVal.clean || '', OPENID, 2)
            if (!noteCheck.pass) throw new Error(noteCheck.reason)
          }
        }
      }
    }
  }

  // aiDraft/aiTaskId/aiStatus/aiError 写 null 是有意的 (清空草稿), 直接 update 走 dot-path 没问题
  // 因为它们的字段原本就是顶层标量/对象, 不存在嵌套, 不会有上一次"result=null"那种 502001 bug
  await db.collection('trips').doc(tripId).update({ data: cleaned })
  return { ok: true }
}
