/**
 * 输入校验与清洗工具
 * 所有 validator 返回 { ok: boolean, clean?: string|number, error?: string }
 */

/**
 * 通用文本清洗内核
 * - trim 首尾空白
 * - 移除控制字符（\x00-\x1f 除 \n 外）
 * - 截断到 maxLen
 */
function sanitizeText(text, maxLen) {
  if (typeof text !== 'string') return ''
  return text
    .trim()
    .replace(/[\x00-\x09\x0b-\x1f]/g, '')
    .slice(0, maxLen)
}

/** @returns {{ ok: boolean, clean?: string, error?: string }} */
function makeTextValidator(maxLen, label, allowEmpty = false) {
  return function (text) {
    const clean = sanitizeText(text, maxLen)
    if (!allowEmpty && !clean) return { ok: false, error: `${label}不能为空` }
    return { ok: true, clean }
  }
}

// ── 文本 validators ──

const validateNickname = makeTextValidator(20, '昵称')
const validateTripName = makeTextValidator(50, '攻略名')
const validateSpotName = makeTextValidator(50, '地点名')
const validateSpotNote = makeTextValidator(200, '备注', true) // 备注允许空
const validateFreeText = makeTextValidator(500, '偏好描述', true) // 自由文本允许空
const validateSearchKw = makeTextValidator(50, '搜索关键词')
const validateTransport = makeTextValidator(30, '交通方式', true)
const validateLocation = makeTextValidator(50, '起点/终点', true)

// ── 数值 validators ──

/**
 * 价格校验：非负整数 0~999999
 */
function validatePrice(val) {
  if (val == null || val === '') return { ok: true, clean: undefined }
  const n = typeof val === 'number' ? val : parseInt(String(val), 10)
  if (isNaN(n) || n < 0) return { ok: false, error: '价格须为非负整数' }
  return { ok: true, clean: Math.min(n, 999999) }
}

/**
 * 住几晚校验：正整数 1~30
 */
function validateNights(val) {
  if (val == null || val === '') return { ok: false, error: '住几晚不能为空' }
  const n = typeof val === 'number' ? val : parseInt(String(val), 10)
  if (isNaN(n) || n < 1) return { ok: false, error: '住几晚至少为 1' }
  return { ok: true, clean: Math.min(n, 30) }
}

// ── 格式 validators ──

/**
 * 行政区划代码校验：6 位数字
 */
function validateAdcode(text) {
  if (typeof text !== 'string' || !/^\d{6}$/.test(text)) {
    return { ok: false, error: 'adcode 须为 6 位数字' }
  }
  return { ok: true, clean: text }
}

/**
 * 日期校验：YYYY-MM-DD + 日期合法性
 */
function validateDate(text) {
  if (typeof text !== 'string') return { ok: false, error: '日期格式错误' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { ok: false, error: '日期格式须为 YYYY-MM-DD' }
  const d = new Date(text)
  if (isNaN(d.getTime())) return { ok: false, error: '日期不合法' }
  return { ok: true, clean: text }
}

module.exports = {
  sanitizeText,
  validateNickname,
  validateTripName,
  validateSpotName,
  validateSpotNote,
  validateFreeText,
  validateSearchKw,
  validateTransport,
  validateLocation,
  validatePrice,
  validateNights,
  validateAdcode,
  validateDate,
}
