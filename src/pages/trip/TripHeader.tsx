import { useTheme } from '../../store/theme-store'
import type { TripHeaderViewProps } from './shared-header'
import TripHeaderTegami from './TripHeaderTegami'
import TripHeaderMagazine from './TripHeaderMagazine'
import TripHeaderPostcard from './TripHeaderPostcard'
import TripHeaderMinimal from './TripHeaderMinimal'

export default function TripHeader(props: TripHeaderViewProps) {
  const { theme } = useTheme()
  if (theme === 'magazine') return <TripHeaderMagazine {...props} />
  if (theme === 'postcard') return <TripHeaderPostcard {...props} />
  if (theme === 'minimal')  return <TripHeaderMinimal {...props} />
  return <TripHeaderTegami {...props} />
}
