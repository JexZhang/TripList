import type { ThemeName } from '../../store/theme-store'
import type { ModeBarVariant } from './ModeBar'

export const MAPMODE_VARIANT: Record<ThemeName, ModeBarVariant> = {
  tegami:   'track',
  magazine: 'segmented',
  postcard: 'route',
  minimal:  'pill',
}
