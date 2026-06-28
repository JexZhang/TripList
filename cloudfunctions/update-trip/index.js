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

// 生成 spot id（不依赖 nanoid，12 位足够避免碰撞）
function genId(len = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

// 把 AI 草稿中被勾选的地点合并进 days（与客户端 trip-helpers.mergePlanIntoDays 等价）。
// selectedSpots: { [date]: number[] } —— 该天勾选的草稿地点索引；未勾选的天保持原样。
function mergePlanIntoDays(existing, plan, selectedSpots) {
  const aiByDate = new Map()
  for (const gd of (plan.days || [])) aiByDate.set(gd.date, gd)
  return (existing || []).map((d) => {
    const indices = selectedSpots[d.date]
    if (!Array.isArray(indices) || indices.length === 0) return d
    const gd = aiByDate.get(d.date)
    if (!gd) return d
    const spots = indices
      .filter((i) => i >= 0 && i < gd.spots.length)
      .map((i) => {
        const gs = gd.spots[i]
        return {
          id: genId(),
          type: gs.type,
          name: gs.name,
          city: gs.city,
          note: gs.note,
          price: gs.price,
          time: gs.time,
          lat: gs.lat,
          lng: gs.lng,
          adcode: gs.adcode,
          address: gs.address,
        }
      })
    return { ...d, spots }
  })
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const { tripId, patch, action, selectedSpots } = event || {}
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

  // action=apply-ai-draft: 应用 AI 草稿（服务端按可信的 trip.aiDraft 合并写入）。
  // 草稿内容由 ai-plan-trip 服务端生成、用户只能勾选不能编辑，属可信内容 → 不做内容审核，
  // 客户端只传选择的索引，无法借此通道夹带任意文本。仅 owner 可应用（aiDraft 是 owner-only 字段）。
  if (action === 'apply-ai-draft') {
    const trip = await db.collection('trips').doc(tripId).get().catch(() => null)
    if (!trip || !trip.data) throw new Error('trip not found')
    if (trip.data._openid !== OPENID) throw new Error('forbidden: 仅 owner 可应用 AI 草稿')
    const draft = trip.data.aiDraft
    if (!draft || !Array.isArray(draft.days)) throw new Error('无可应用的 AI 草稿')
    if (!selectedSpots || typeof selectedSpots !== 'object') throw new Error('selectedSpots required')

    const cleaned = {
      days: mergePlanIntoDays(trip.data.days || [], draft, selectedSpots),
      aiTaskId: null,
      aiStatus: null,
      aiDraft: null,
      aiError: null,
      updatedAt: Date.now(),
      updatedBy: OPENID,
    }
    // 草稿可能携带 name（用户未命名时）/ recommendedDestinations（trip 无目的地时）
    if (draft.name) cleaned.name = String(draft.name).slice(0, 50)
    const noDest = !trip.data.destinations || trip.data.destinations.length === 0
    if (noDest && Array.isArray(draft.recommendedDestinations) && draft.recommendedDestinations.length > 0) {
      cleaned.destinations = draft.recommendedDestinations.map((d) => ({
        name: d.name, adcode: '', lat: 0, lng: 0,
      }))
    }

    await db.collection('trips').doc(tripId).update({ data: cleaned })
    const updated = await db.collection('trips').doc(tripId).get()
    return { ok: true, trip: updated.data }
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

  // ── 内容审核 ──
  // 先做同步校验/清洗，并收集需审核的「变更文本」；再并行调用审核接口。
  // 串行 await checkText 会让「应用 AI 草稿」这类整批新地点的场景产生几十次串行网络
  // 调用，累计超过云函数 3s 上限（-504003）。改为并行后墙钟时间≈最慢的一次。
  const modTasks = [] // { text, scene }

  if (cleaned.name !== undefined) {
    const nameChanged = cleaned.name !== (trip.data.name || '')
    if (nameChanged) {
      // 只在名称发生变更时校验（避免旧数据空名称触发 validateTripName 报错）
      const nameVal = validateTripName(cleaned.name)
      if (!nameVal.ok) throw new Error(nameVal.error)
      cleaned.name = nameVal.clean
      modTasks.push({ text: nameVal.clean, scene: 1 }) // scene=1 资料
    }
  }

  if (cleaned.days !== undefined && Array.isArray(cleaned.days)) {
    const existingDays = trip.data.days || []
    const existingSpotMap = new Map()
    for (const d of existingDays) {
      for (const s of (d.spots || [])) {
        if (s.id) existingSpotMap.set(s.id, s)
      }
    }
    for (const day of cleaned.days) {
      for (const spot of (day.spots || [])) {
        const existing = spot.id ? existingSpotMap.get(spot.id) : null
        if (spot.name !== undefined) {
          const spotNameChanged = !existing || spot.name !== existing.name
          if (spotNameChanged) {
            // 只在地点名变更时校验，避免旧数据（AI 生成/历史导入的空名称）触发报错
            const spotNameVal = validateSpotName(spot.name)
            if (!spotNameVal.ok) throw new Error(spotNameVal.error)
            spot.name = spotNameVal.clean
            modTasks.push({ text: spotNameVal.clean, scene: 2 })
          }
        }
        if (spot.note !== undefined) {
          const spotNoteVal = validateSpotNote(spot.note)
          if (!spotNoteVal.ok) throw new Error(spotNoteVal.error)
          spot.note = spotNoteVal.clean
          if ((!existing || spot.note !== (existing.note || '')) && spotNoteVal.clean) {
            modTasks.push({ text: spotNoteVal.clean, scene: 2 })
          }
        }
      }
    }
  }

  // 并行审核所有变更文本；任一违规即拒绝（checkText 自身对接口异常已降级放行）
  if (modTasks.length > 0) {
    const results = await Promise.all(modTasks.map((t) => checkText(t.text, OPENID, t.scene)))
    const bad = results.find((r) => !r.pass)
    if (bad) throw new Error(bad.reason || '内容包含违规信息')
  }

  // aiDraft/aiTaskId/aiStatus/aiError 写 null 是有意的 (清空草稿), 直接 update 走 dot-path 没问题
  // 因为它们的字段原本就是顶层标量/对象, 不存在嵌套, 不会有上一次"result=null"那种 502001 bug
  await db.collection('trips').doc(tripId).update({ data: cleaned })
  return { ok: true }
}
