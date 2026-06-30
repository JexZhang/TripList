import dayjs from 'dayjs'

export interface OrganizerDateSlot {
  key: string
  date: string
}

export function buildOrganizerDateSlots(baseDate: string, count: number): OrganizerDateSlot[] {
  if (count <= 0) return []
  return Array.from({ length: count }, (_, index) => ({
    key: `slot-${index}`,
    date: dayjs(baseDate).add(index, 'day').format('YYYY-MM-DD'),
  }))
}
