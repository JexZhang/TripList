import type { AIAudience, AIPace, AIModelAlias } from '../types/trip'

export type InterviewQType = 'single' | 'multi' | 'free' | 'number'

export interface InterviewQuestion {
  id: string
  q: string
  type: InterviewQType
  options?: readonly string[]
  placeholder?: string
}

export const AI_INTERVIEW: readonly InterviewQuestion[] = [
  {
    id: 'pace',
    q: '想要什么节奏？',
    type: 'single',
    options: ['悠闲', '平衡', '紧凑'] as const satisfies readonly AIPace[],
  },
  {
    id: 'audience',
    q: '和谁一起出行？',
    type: 'multi',
    options: ['独行', '情侣', '亲子', '老人', '朋友'] as const satisfies readonly AIAudience[],
  },
  {
    id: 'budgetCap',
    q: '人均每天预算？(可选)',
    type: 'number',
    placeholder: '例如 500，留空表示不限',
  },
  {
    id: 'freeText',
    q: '还有什么想告诉我的？',
    type: 'free',
    placeholder: '例如：喜欢拍照、不爱热门景点、想找当地特色餐厅',
  },
  {
    id: 'modelAlias',
    q: '选个 AI 模型吧',
    type: 'single',
    options: ['DeepSeek-V4-PRO', 'DeepSeek-V4-Flash'] as const satisfies readonly AIModelAlias[],
  },
]

export interface InterviewAnswers {
  pace?: AIPace
  audience?: AIAudience[]
  budgetCap?: string
  freeText?: string
  modelAlias?: AIModelAlias
}

import type { AIPreferences } from '../types/trip'

export function answersToPreferences(a: InterviewAnswers): AIPreferences {
  const budgetNum = Number(a.budgetCap)
  return {
    pace: a.pace || '平衡',
    audience: a.audience || [],
    budgetCap: a.budgetCap && budgetNum > 0 ? budgetNum : undefined,
    freeText: a.freeText?.trim() || undefined,
    modelAlias: a.modelAlias || 'DeepSeek-V4-Flash',
  }
}
