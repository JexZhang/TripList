import Taro from '@tarojs/taro'
import dayjs from 'dayjs'
import type { Trip } from '../types/trip'

/**
 * 分享卡片色板（复用旅人精选 TRAVEL_PALETTE），djb2 哈希取色，无季节微调。
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

/** 分享卡片确定性取色：同一目的地颜色永远一致 */
export function shareCardColors(trip: Trip): [string, string] {
  const key = trip.destinations[0]?.name || trip.name
  const h = djb2(key)
  const [baseH, baseS, baseL] = TRAVEL_PALETTE[h % TRAVEL_PALETTE.length]
  const h2 = (baseH + 18 + (h % 12)) % 360
  const s2 = Math.max(25, Math.min(85, baseS + 8))
  const l2 = Math.min(70, baseL + 12)
  return [hsl(baseH, baseS, baseL), hsl(h2, s2, l2)]
}

// ─── 文案构造 ──────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

/** 卡片大图文字（目的地 / 攻略名 fallback） */
function bigText(trip: Trip): string {
  const dests = trip.destinations
  if (dests.length > 1) {
    return truncate(`${dests[0].name} · ${dests.length}城`, 10)
  }
  if (dests.length === 1) {
    return truncate(dests[0].name, 10)
  }
  return truncate(trip.name, 10)
}

/** 卡片底部元信息 */
function metaText(trip: Trip): string {
  const start = dayjs(trip.startDate)
  const end = dayjs(trip.endDate)
  const days = end.diff(start, 'day') + 1
  const dateRange = `${start.format('M.D')} → ${end.format('M.D')}`

  if (days === 1) {
    return trip.pax > 1 ? `${dateRange} · ${trip.pax}人` : dateRange
  }
  const parts = [dateRange, `${days}天`]
  if (trip.pax > 1) parts.push(`${trip.pax}人`)
  return parts.join(' · ')
}

/** 分享标题 */
export function buildShareTitle(trip: Trip, kind: 'readonly' | 'collab'): string {
  const name = truncate(trip.name, 14)
  if (kind === 'readonly') {
    return `送你一份「${name}」攻略`
  }
  // collab
  if (trip.ownerNickname) {
    return `${trip.ownerNickname} 邀请你一起规划「${name}」`
  }
  return `一起来规划「${name}」吧`
}

// ─── Canvas 渲染 ────────────────────────────────────

const W = 500
const H = 400

async function getCanvasNode(): Promise<any> {
  return new Promise((resolve) => {
    Taro.createSelectorQuery()
      .select('.share-card-canvas')
      .fields({ node: true, size: true })
      .exec((res: any) => {
        resolve(res?.[0]?.node ?? null)
      })
  })
}

/**
 * 渲染分享卡片到隐藏 Canvas,返回临时图片路径。
 * 在 prepareShare 阶段调用,此时用户已看到 "准备中..." loading。
 */
export async function renderShareCard(trip: Trip): Promise<string> {
  const canvas = await getCanvasNode()
  if (!canvas) throw new Error('share-card canvas not found')

  const dpr = Taro.getWindowInfo().pixelRatio
  canvas.width = W * dpr
  canvas.height = H * dpr

  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  const [c1, c2] = shareCardColors(trip)

  // ── 渐变背景 ──
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, c1)
  grad.addColorStop(1, c2)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // ── 装饰圆环 ──
  ctx.lineWidth = 40
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.beginPath()
  ctx.arc(W - 30, -30, 120, 0, Math.PI * 2)
  ctx.stroke()

  ctx.lineWidth = 50
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.beginPath()
  ctx.arc(-40, H + 40, 150, 0, Math.PI * 2)
  ctx.stroke()

  // ── 品牌名 ──
  ctx.font = '500 24px -apple-system, "PingFang SC", sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.textBaseline = 'top'
  ctx.fillText('行迹', 48, 36)

  // ── 主文字（左对齐，垂直居中偏上）──
  const mainY = H * 0.35
  ctx.font = 'bold 72px -apple-system, "PingFang SC", sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.fillText(bigText(trip), 48, mainY)

  // ── 分割线 ──
  const lineY = mainY + 52
  const lineGrad = ctx.createLinearGradient(48, 0, 96, 0)
  lineGrad.addColorStop(0, 'rgba(255,255,255,0.6)')
  lineGrad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = lineGrad
  ctx.fillRect(48, lineY, 48, 3)

  // ── 元信息 ──
  ctx.font = '400 24px -apple-system, "PingFang SC", sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.textBaseline = 'top'
  ctx.fillText(metaText(trip), 48, lineY + 16)

  // ── 导出临时文件 ──
  return new Promise((resolve, reject) => {
    Taro.canvasToTempFilePath(
      {
        canvas,
        fileType: 'png',
        quality: 1,
        success: (res: any) => resolve(res.tempFilePath),
        fail: (err: any) => reject(err),
      },
    )
  })
}
