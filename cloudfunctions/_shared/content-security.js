const cloud = require('wx-server-sdk')

/**
 * 文本内容安全审核
 * @param {string} content - 待审核文本
 * @param {string} openid  - 用户 openid
 * @param {number} scene   - 1=资料 2=评论 3=论坛 4=社交日志
 * @returns {Promise<{ pass: boolean, label?: number, reason?: string }>}
 *
 * 降级策略：审核接口异常时放行 + console.warn
 */
async function checkText(content, openid, scene = 2) {
  if (!content || !content.trim()) return { pass: true }
  // 截断到 2500 字（API 上限）
  const truncated = content.slice(0, 2500)
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      content: truncated,
      openid,
      scene,
      version: 2,
    })
    const suggest = res?.result?.suggest
    if (suggest === 'risky') {
      return { pass: false, label: res.result.label, reason: '内容包含违规信息' }
    }
    // 'pass' 或 'review' 都放行
    return { pass: true }
  } catch (err) {
    // 降级放行：超时、频率限制、系统错误
    console.warn('[content-security] msgSecCheck failed, fallback pass:', err.errCode, err.errMsg)
    return { pass: true }
  }
}

/**
 * 图片内容安全审核（异步）
 * @param {string} mediaUrl - 可公网访问的图片 URL
 * @param {string} openid
 * @param {number} scene
 * @returns {Promise<{ traceId: string | null }>} 异步结果通过消息推送返回
 *
 * 降级策略：审核接口异常时放行
 */
async function checkImage(mediaUrl, openid, scene = 1) {
  if (!mediaUrl) return { traceId: null }
  try {
    const res = await cloud.openapi.security.mediaCheckAsync({
      media_url: mediaUrl,
      media_type: 2, // 2=图片
      openid,
      scene,
      version: 2,
    })
    return { traceId: res.trace_id }
  } catch (err) {
    console.warn('[content-security] mediaCheckAsync failed, fallback pass:', err.errCode, err.errMsg)
    return { traceId: null }
  }
}

/**
 * 记录异步审核的 traceId → 资源映射，供 sec-check-callback 回调查询
 * @param {string} traceId
 * @param {string} collection - 资源所在集合
 * @param {string} docId      - 资源文档 ID
 * @param {string} field      - 需清空的字段名
 */
async function recordCheck(traceId, collection, docId, field) {
  const db = cloud.database()
  await db.collection('sec_check_records').add({
    data: { _id: traceId, collection, docId, field, createdAt: Date.now() },
  })
}

module.exports = { checkText, checkImage, recordCheck }
