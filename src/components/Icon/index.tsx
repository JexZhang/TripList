import { View } from '@tarojs/components'
import type { CSSProperties } from 'react'
import './index.scss'

export type IconName =
  | 'search' | 'pin' | 'tag' | 'people' | 'season' | 'lock' | 'sliders'
  | 'itinerary' | 'map' | 'budget' | 'packing'
  | 'spot' | 'hotel' | 'meal' | 'transport'
  | 'check' | 'plus' | 'close' | 'arrow-left' | 'chevron-down' | 'chevron-right'

// 仅内层 path/circle;统一 24×24 viewBox。stroke/fill 用 #000(mask 只看 alpha)。
const PATHS: Record<IconName, string> = {
  search: `<circle cx='11' cy='11' r='7'/><path d='M20 20l-3.5-3.5'/>`,
  pin: `<path d='M12 21s-7-7-7-12a7 7 0 0114 0c0 5-7 12-7 12z'/><circle cx='12' cy='9' r='2.5'/>`,
  tag: `<path d='M4 4h7l9 9-7 7-9-9V4z'/><circle cx='8' cy='8' r='1.3' fill='#000' stroke='none'/>`,
  people: `<circle cx='9' cy='9' r='3'/><path d='M3 20c0-3 2.5-5 6-5s6 2 6 5'/><circle cx='16' cy='10' r='2.5'/><path d='M16 15c2.5 0 5 2 5 5'/>`,
  season: `<path d='M12 3v18M5 7l14 10M19 7L5 17'/><circle cx='12' cy='12' r='2'/>`,
  lock: `<rect x='5' y='10' width='14' height='10' rx='2'/><path d='M8 10V7a4 4 0 018 0v3'/>`,
  sliders: `<path d='M4 7h10M18 7h2M4 17h2M10 17h10'/><circle cx='16' cy='7' r='2'/><circle cx='8' cy='17' r='2'/>`,
  itinerary: `<rect x='4.5' y='3' width='15' height='18' rx='2'/><path d='M9 8h6M9 12h6M9 16h4'/><circle cx='7' cy='8' r='0.7' fill='#000' stroke='none'/><circle cx='7' cy='12' r='0.7' fill='#000' stroke='none'/><circle cx='7' cy='16' r='0.7' fill='#000' stroke='none'/>`,
  map: `<path d='M9 4l-5 2v14l5-2 6 2 5-2V4l-5 2-6-2z'/><path d='M9 4v14M15 6v14'/>`,
  budget: `<circle cx='12' cy='12' r='9'/><path d='M12 6.5v11M14.5 9h-3.5a1.5 1.5 0 000 3h2a1.5 1.5 0 010 3H9'/>`,
  packing: `<path d='M6 8h12v12a1 1 0 01-1 1H7a1 1 0 01-1-1V8z'/><path d='M9 8V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V8'/><path d='M12 11v6'/>`,
  spot: `<path d='M12 3c-3.5 0-6 2.6-6 6 0 4.5 6 12 6 12s6-7.5 6-12c0-3.4-2.5-6-6-6z'/><circle cx='12' cy='9' r='2.2'/>`,
  hotel: `<path d='M3 18V7a1 1 0 011-1h16a1 1 0 011 1v11'/><path d='M3 14h18M3 18v2M21 18v2'/><circle cx='7.5' cy='11' r='1.2'/><path d='M10 14V12a1 1 0 011-1h6a1 1 0 011 1v2'/>`,
  meal: `<path d='M5 3v6M8 3v6M5 9a3 3 0 003 3v9M19 3l-1 9h2v9'/>`,
  transport: `<path d='M5 17V8a3 3 0 013-3h8a3 3 0 013 3v9'/><path d='M5 12h14'/><circle cx='8.5' cy='17.5' r='1.5'/><circle cx='15.5' cy='17.5' r='1.5'/>`,
  check: `<path d='M5 12.5l5 5L19 7'/>`,
  plus: `<path d='M12 5v14M5 12h14'/>`,
  close: `<path d='M6 6l12 12M18 6l-12 12'/>`,
  'arrow-left': `<path d='M19 12H5M11 18l-6-6 6-6'/>`,
  'chevron-down': `<path d='M6 9l6 6 6-6'/>`,
  'chevron-right': `<path d='M9 6l6 6-6 6'/>`,
}

function dataUri(name: IconName): string {
  const inner = PATHS[name]
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='#000' ` +
    `stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'>${inner}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

interface IconProps {
  name: IconName
  size?: number          // px
  color?: string         // 任意 CSS color / token,默认 var(--ink)
  className?: string
  style?: CSSProperties
}

export default function Icon({ name, size = 22, color = 'var(--ink)', className = '', style }: IconProps) {
  const uri = dataUri(name)
  const merged: CSSProperties = {
    width: size,
    height: size,
    backgroundColor: color,
    WebkitMaskImage: uri,
    maskImage: uri,
    ...style,
  }
  return <View className={`icon ${className}`} style={merged} />
}
