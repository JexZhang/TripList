import type { TemplateCard } from '../types/template'

/**
 * 旅人精选封面确定性取色：同一目的地颜色稳定，季节微调冷暖。
 * 输出渐变二元组 [c1, c2]，供封面背景使用。
 */

const TRAVEL_PALETTE: ReadonlyArray<[number, number, number]> = [
  [25, 95, 59],    // 暖橘
  [155, 42, 38],   // 苔绿
  [210, 55, 42],   // 海蓝
  [345, 52, 50],   // 玫红
  [38, 72, 52],    // 琥珀
  [270, 38, 48],   // 薰衣草
  [170, 50, 36],   // 青碧
  [5, 62, 46],     // 赤陶
  [48, 80, 56],    // 金麦
  [190, 55, 34],   // 孔雀蓝
  [320, 42, 48],   // 兰花紫
  [120, 36, 40],   // 松林绿
]

function djb2(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`
}

/**
 * 根据 TemplateCard 确定性生成封面渐变色。
 * - 主色由 city（优先）或 region 哈希映射到预设色板
 * - 季节微调：春偏绿、夏偏蓝、秋偏橙、冬偏冷蓝
 * - 对 seasons 缺失健壮，不会因无季节而出错
 */
export function templateCoverColors(card: Pick<TemplateCard, 'city' | 'region' | 'seasons'>): [string, string] {
  const key = card.city || card.region || ''
  const h = djb2(key)
  const [baseH, baseS, baseL] = TRAVEL_PALETTE[h % TRAVEL_PALETTE.length]

  const season = card.seasons?.[0]
  let hAdj = 0
  let sAdj = 0
  let lAdj = 0
  switch (season) {
    case '春': hAdj = -15; sAdj = 5; break
    case '夏': hAdj = 10; sAdj = 8; lAdj = 3; break
    case '秋': hAdj = -8; sAdj = 3; lAdj = -3; break
    case '冬': hAdj = 15; sAdj = -8; lAdj = -5; break
  }

  const h1 = (baseH + hAdj + 360) % 360
  const s1 = Math.max(20, Math.min(90, baseS + sAdj))
  const l1 = Math.max(30, Math.min(65, baseL + lAdj))

  const h2 = (h1 + 18 + (h % 12)) % 360
  const s2 = Math.max(25, Math.min(85, s1 + 8))
  const l2 = Math.min(70, l1 + 12)

  return [hsl(h1, s1, l1), hsl(h2, s2, l2)]
}
