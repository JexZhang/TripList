import type { TemplateCard, TemplateQuery } from '../types/template'

// 维度内多选 = OR;跨维度 = AND。dayCount/city/region 已在服务端 where 收敛,这里兜底再筛。
export function matchesTemplate(card: TemplateCard, q: TemplateQuery): boolean {
  if (typeof q.dayCount === 'number' && card.dayCount !== q.dayCount) return false
  if (typeof q.dayCountGte === 'number' && card.dayCount < q.dayCountGte) return false
  if (q.city && card.city !== q.city) return false
  if (q.region && card.region !== q.region) return false

  if (q.tags && q.tags.length && !q.tags.some((t) => card.tags.includes(t))) return false
  if (q.audience && q.audience.length && !q.audience.some((a) => card.audience.includes(a))) return false
  if (q.seasons && q.seasons.length && !q.seasons.some((s) => card.seasons.includes(s))) return false

  if (q.keyword && q.keyword.trim()) {
    const k = q.keyword.trim().toLowerCase()
    const hay = `${card.name} ${card.city} ${card.region}`.toLowerCase()
    if (!hay.includes(k)) return false
  }
  return true
}

export function filterTemplates(cards: TemplateCard[], q: TemplateQuery): TemplateCard[] {
  return cards.filter((c) => matchesTemplate(c, q))
}
