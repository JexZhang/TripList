import type { AIAudience } from '../types/trip'

// 天数主筛选:1..5 精确,「6天+」用 gte=6
export interface DayChip { label: string; dayCount?: number; dayCountGte?: number }
export const DAY_CHIPS: DayChip[] = [
  { label: '1天', dayCount: 1 },
  { label: '2天', dayCount: 2 },
  { label: '3天', dayCount: 3 },
  { label: '4天', dayCount: 4 },
  { label: '5天', dayCount: 5 },
  { label: '6天+', dayCountGte: 6 },
]

// 次级维度候选(前端固定策展,后期可换后端 distinct)
export const TAG_OPTIONS: string[] = ['美食', '古镇', '自然', 'citywalk', '博物馆', '温泉', '海岛', '亲子乐园', '历史人文']
export const AUDIENCE_OPTIONS: AIAudience[] = ['独行', '情侣', '亲子', '老人', '朋友']
export const SEASON_OPTIONS: string[] = ['春', '夏', '秋', '冬', '看雪', '避暑']
// 城市初期留空,由首批模板覆盖后补;空数组时 UI 隐藏城市筛选行
export const CITY_OPTIONS: string[] = []
