// 纯函数:把模板 days 按出发日顺延、清空天气。无任何 wx-server-sdk 依赖,便于单测。

function addDaysISO(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function isValidISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return false
  // 防止 2026-13-01 被 Date 容错进位:回写比对
  return d.toISOString().slice(0, 10) === s
}

// 返回新对象,绝不原地 mutate 入参
function rebaseTemplateDates(days, startDate) {
  const rebased = days.map((d, i) => ({
    ...d,
    date: addDaysISO(startDate, i),
    weather: null,
  }))
  const endDate = days.length ? addDaysISO(startDate, days.length - 1) : startDate
  return { days: rebased, startDate, endDate }
}

module.exports = { addDaysISO, isValidISODate, rebaseTemplateDates }
