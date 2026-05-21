import dayjs from 'dayjs'

export function fmtDate(date: string | number | Date, pattern = 'YYYY-MM-DD'): string {
  return dayjs(date).format(pattern)
}

export function fmtDateShort(date: string | Date): string {
  return dayjs(date).format('MM.DD')
}

export function fmtCurrency(n: number, currency = '¥'): string {
  const s = (n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${currency}${s}`
}

export function daysBetween(start: string, end: string): number {
  return dayjs(end).diff(dayjs(start), 'day') + 1
}
