import Taro from '@tarojs/taro'
import { cloud } from './cloud'
import type { Template, TemplateCard, TemplateQuery } from '../types/template'

// @ts-ignore Taro.cloud 在 weapp 端可用
const db = () => Taro.cloud.database()
const COLL = 'trip_templates'

// 列表只取轻字段,避免误带 days
const CARD_FIELD = {
  name: true, city: true, region: true,
  dayCount: true, spotCount: true,
  tags: true, audience: true, seasons: true,
  coverImages: true,
} as const

// ── Storage SWR:精选区缓存 6 小时,先回缓存再后台刷新 ──
const FEATURED_KEY = 'tpl-featured-cache'
const FEATURED_TTL = 6 * 60 * 60 * 1000

interface FeaturedCache { ts: number; cards: TemplateCard[] }

function readFeaturedCache(): TemplateCard[] | null {
  try {
    const c = Taro.getStorageSync(FEATURED_KEY) as FeaturedCache | ''
    if (c && Array.isArray(c.cards) && Date.now() - c.ts < FEATURED_TTL) return c.cards
  } catch { /* ignore */ }
  return null
}

function writeFeaturedCache(cards: TemplateCard[]): void {
  try { Taro.setStorageSync(FEATURED_KEY, { ts: Date.now(), cards } as FeaturedCache) } catch { /* ignore */ }
}

/**
 * 首页精选:featured=true,按 sortWeight 降序取前 N。
 * 拉取网络结果 → 写入 SWR 缓存 → 返回轻字段卡片。首屏立即渲染用 getFeaturedCache() 同步取缓存。
 */
export async function listFeaturedTemplates(limit = 8): Promise<TemplateCard[]> {
  const res = await db().collection(COLL)
    .where({ featured: true })
    .field(CARD_FIELD)
    .orderBy('sortWeight', 'desc')
    .limit(limit)
    .get()
  const cards = ((res && res.data) || []) as TemplateCard[]
  writeFeaturedCache(cards)
  return cards
}

/** 同步读精选缓存(供首页首屏立即渲染,不等网络) */
export function getFeaturedCache(): TemplateCard[] | null {
  return readFeaturedCache()
}

/**
 * 旅人精选查询。初期数据量小:服务端用 where 收敛天数/城市,其余多选维度(tags/audience/seasons)
 * 与 keyword 拉回后客户端 OR/AND 精筛(见 template-filter)。
 */
export async function listTemplates(q: TemplateQuery): Promise<TemplateCard[]> {
  const _ = db().command
  const where: Record<string, unknown> = {}
  if (typeof q.dayCount === 'number') where.dayCount = q.dayCount
  else if (typeof q.dayCountGte === 'number') where.dayCount = _.gte(q.dayCountGte)
  if (q.city) where.city = q.city
  if (q.region) where.region = q.region

  let query = db().collection(COLL).where(where).field(CARD_FIELD).orderBy('sortWeight', 'desc')
  if (typeof q.skip === 'number') query = query.skip(q.skip)
  query = query.limit(q.limit ?? 30)

  const res = await query.get()
  return ((res && res.data) || []) as TemplateCard[]
}

/** 只读详情:取完整文档(含 days) */
export async function getTemplate(id: string): Promise<Template | null> {
  try {
    const res = await db().collection(COLL).doc(id).get({})
    if (!res || !res.data) return null
    return res.data as Template
  } catch (e: unknown) {
    const err = e as { errCode?: number; errMsg?: string }
    if (err && (err.errCode === -502005 || /not.*exist|not.*found/i.test(err.errMsg || ''))) return null
    console.error('[getTemplate]', id, e)
    throw e
  }
}

/** 复制模板 → 新 trip,返回 newTripId */
export async function cloneTemplate(templateId: string, startDate: string): Promise<string> {
  const { newTripId } = await cloud.cloneTemplate({ templateId, startDate })
  return newTripId
}
