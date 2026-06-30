export const ORGANIZER_ROW_STEP_RPX = 134
const BASE_RPX_WIDTH = 750

export function organizerRowStepPx(windowWidthPx: number): number {
  return ORGANIZER_ROW_STEP_RPX * windowWidthPx / BASE_RPX_WIDTH
}

export function clampDragOffset(offsetPx: number, rowStepPx: number, index: number, count: number): number {
  if (count <= 0) return 0
  const min = -index * rowStepPx
  const max = (count - index - 1) * rowStepPx
  return Math.max(min, Math.min(max, offsetPx))
}

export function dragTargetIndex(index: number, offsetPx: number, rowStepPx: number, count: number): number {
  if (count <= 0 || rowStepPx <= 0) return index
  const steps = Math.trunc(offsetPx / rowStepPx)
  return Math.max(0, Math.min(count - 1, index + steps))
}

export function dragTargetIndexFromY(yPx: number, rowStepPx: number, count: number): number {
  if (count <= 0 || rowStepPx <= 0) return 0
  return Math.max(0, Math.min(count - 1, Math.round(yPx / rowStepPx)))
}
