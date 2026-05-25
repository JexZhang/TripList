const VALID_TYPES = ['spot', 'hotel', 'meal', 'transport']

function expectedDates(startDate, endDate) {
  const out = []
  const s = new Date(startDate + 'T00:00:00')
  const e = new Date(endDate + 'T00:00:00')
  for (let cur = s.getTime(); cur <= e.getTime(); cur += 86400000) {
    const d = new Date(cur)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    out.push(`${d.getFullYear()}-${m}-${day}`)
  }
  return out
}

function inChinaBox(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number'
    && lat >= 3 && lat <= 54 && lng >= 73 && lng <= 136
}

function validatePlan(obj, tripContext) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: '不是对象' }
  if (!Array.isArray(obj.days)) return { ok: false, error: '缺少 days 数组' }

  const expectedSeq = expectedDates(tripContext.startDate, tripContext.endDate)
  if (obj.days.length !== expectedSeq.length) {
    return { ok: false, error: `days 数量 ${obj.days.length}, 应为 ${expectedSeq.length}` }
  }

  for (let i = 0; i < obj.days.length; i++) {
    const d = obj.days[i]
    if (!d.date || typeof d.date !== 'string') {
      return { ok: false, error: `days[${i}].date 缺失或非字符串` }
    }
    if (d.date !== expectedSeq[i]) {
      return { ok: false, error: `days[${i}].date=${d.date}, 应为 ${expectedSeq[i]}` }
    }
    if (!Array.isArray(d.spots) || d.spots.length === 0) {
      return { ok: false, error: `days[${i}].spots 为空` }
    }
    for (let j = 0; j < d.spots.length; j++) {
      const s = d.spots[j]
      if (!s || typeof s !== 'object') {
        return { ok: false, error: `days[${i}].spots[${j}] 非对象` }
      }
      if (!s.type || !VALID_TYPES.includes(s.type)) {
        return { ok: false, error: `days[${i}].spots[${j}].type 不合法` }
      }
      if (!s.name || typeof s.name !== 'string') {
        return { ok: false, error: `days[${i}].spots[${j}].name 缺失` }
      }
      if (!s.city || typeof s.city !== 'string') {
        return { ok: false, error: `days[${i}].spots[${j}].city 缺失` }
      }
      // 坐标 sanity: 有就必须落在中国范围, 否则视为幻觉, 抹掉
      if (s.lat != null || s.lng != null) {
        if (!inChinaBox(s.lat, s.lng)) {
          delete s.lat; delete s.lng; delete s.adcode
        }
      }
    }
  }
  return { ok: true }
}

module.exports = { validatePlan }
