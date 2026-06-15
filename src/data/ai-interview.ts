import type { AIAudience, AIPace, AIModelAlias } from '../types/trip'

export type InterviewQType = 'single' | 'multi' | 'free' | 'number'

export interface OptionLabel {
  label: string
  desc: string
  tag?: string
}

export interface InterviewQuestion {
  id: string
  q: string
  type: InterviewQType
  options?: readonly string[]
  optionLabels?: Record<string, OptionLabel>
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
    options: ['DeepSeek-V4-Flash', 'DeepSeek-V4-PRO'] as const satisfies readonly AIModelAlias[],
    optionLabels: {
      'DeepSeek-V4-Flash': {
        label: '⚡ 闪电版',
        desc: '高性价比 · 适合 3 天以内攻略',
      },
      'DeepSeek-V4-PRO': {
        label: '✨ 旗舰版',
        desc: '更高质量 · 深度长线攻略推荐',
      },
    },
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
    pace: a.pace || undefined,
    audience: a.audience || [],
    budgetCap: a.budgetCap && budgetNum > 0 ? budgetNum : undefined,
    freeText: a.freeText?.trim() || undefined,
    modelAlias: a.modelAlias || 'DeepSeek-V4-Flash',
  }
}
