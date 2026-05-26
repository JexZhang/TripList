import { useTheme } from '../../store/theme-store'
import type { Day } from '../../types/trip'
import { DAYTAB_VARIANT } from './variants'
import DayTabsTicket from './DayTabsTicket'
import DayTabsSpine from './DayTabsSpine'
import DayTabsCalendar from './DayTabsCalendar'
import DayTabsSimple from './DayTabsSimple'
import './styles/daytabs.scss'

interface Props {
  days: Day[]
  activeId: string
  onSelect: (id: string) => void
  onLongPress: (id: string, idx: number) => void
  onAdd: (pos: 'front' | 'back') => void
}

export default function DayTabs(props: Props) {
  const { theme } = useTheme()
  const variant = DAYTAB_VARIANT[theme]
  if (variant === 'spine')    return <DayTabsSpine    {...props} />
  if (variant === 'calendar') return <DayTabsCalendar {...props} />
  if (variant === 'simple')   return <DayTabsSimple   {...props} />
  return <DayTabsTicket {...props} />
}
