import type { Destination, AIPreferences } from '../types/trip'

export type CreateStepId = 'dest' | 'dates' | 'pax' | 'prefs' | 'name'

export interface CreateAnswers {
  destinations: Destination[]
  startDate: string
  endDate: string
  pax: number
  preferences: AIPreferences
  name: string
}

export const CREATE_STEPS: readonly CreateStepId[] = ['dest', 'dates', 'pax', 'prefs', 'name'] as const

export const STEP_TITLES: Record<CreateStepId, string> = {
  dest: '想去哪里？',
  dates: '什么时候出发？',
  pax: '几位同行？',
  prefs: '聊聊你的偏好',
  name: '给这趟旅程起个名字',
}

export const STEP_SKIP_HINT: Partial<Record<CreateStepId, string>> = {
  dest: '跳过 · AI 会基于偏好为你推荐',
  prefs: '跳过',
  name: '跳过 · AI 智能生成',
}

export function emptyCreateAnswers(): CreateAnswers {
  return {
    destinations: [],
    startDate: '',
    endDate: '',
    pax: 2,
    preferences: { audience: [], modelAlias: 'DeepSeek-V4-Flash' },
    name: '',
  }
}
