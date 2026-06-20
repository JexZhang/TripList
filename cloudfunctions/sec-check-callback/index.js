const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * sec-check-callback: 接收 mediaCheckAsync 异步审核结果推送
 * 部署：HTTP 触发，微信后台消息推送 URL 指向此函数
 */
exports.main = async (event, context) => {
  // 微信推送的消息体在 event 中
  const msg = event || {}
  console.log('[sec-check-callback] received:', JSON.stringify(msg).slice(0, 2000))

  // 解析 wxa_media_check 结果
  const xmlData = msg.xml || msg.body || ''
  // 微信推送的 XML 中关键字段：
  //   <TraceId>...</TraceId>
  //   <result><suggest>risky|pass|review</suggest></result>
  const traceId = extractXml(xmlData, 'TraceId') || extractXml(xmlData, 'trace_id')
  const suggest = extractXml(xmlData, 'suggest')

  if (!traceId) {
    console.warn('[sec-check-callback] no traceId found, ignoring')
    return 'success'
  }

  console.log(`[sec-check-callback] traceId=${traceId}, suggest=${suggest}`)

  const db = cloud.database()

  if (suggest === 'risky') {
    // 查找 sec_check_records 中对应的资源映射
    const record = await db.collection('sec_check_records').doc(traceId).get().catch(() => null)
    if (!record || !record.data) {
      console.warn(`[sec-check-callback] no record found for traceId=${traceId}`)
      return 'success'
    }

    const { collection, docId, field } = record.data
    console.log(`[sec-check-callback] risky: clearing ${collection}.${docId}.${field}`)

    try {
      // 根据资源类型清空对应字段
      const clearData = {}
      if (field === 'avatarUrl') {
        clearData[field] = '' // 头像清空 → 前端回退默认头像
      } else if (field === 'coverUrl') {
        clearData[field] = null // 封面清空
      } else {
        clearData[field] = ''
      }
      await db.collection(collection).doc(docId).update({ data: clearData })
      console.log(`[sec-check-callback] cleared ${collection}.${docId}.${field}`)
    } catch (err) {
      console.error(`[sec-check-callback] clear failed:`, err.message)
    }
  }

  // 无论结果（pass/review/risky）都清理 sec_check_records，避免集合无限积累
  try {
    await db.collection('sec_check_records').doc(traceId).remove()
  } catch { /* 可能已被清理或不存在 */ }

  return 'success'
}

/**
 * 从 XML 字符串中提取指定标签的文本内容
 */
function extractXml(xml, tag) {
  if (!xml || typeof xml !== 'string') return null
  const re = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const m = xml.match(re)
  return m ? (m[1] || m[2] || '').trim() : null
}
