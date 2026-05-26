import type { ThemeName } from '../../store/theme-store'

export type DayTabVariant = 'ticket' | 'spine' | 'calendar' | 'simple'

export const DAYTAB_VARIANT: Record<ThemeName, DayTabVariant> = {
  tegami:   'ticket',
  magazine: 'spine',
  postcard: 'calendar',
  minimal:  'simple',
}
