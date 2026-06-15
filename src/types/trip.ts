export type SpotType = 'spot' | 'hotel' | 'meal' | 'transport'

export interface Spot {
  id: string
  type: SpotType
  time?: string          // 'HH:mm' 可选
  name: string
  city?: string
  adcode?: string
  lat?: number
  lng?: number
  price?: number
  note?: string

  // type='hotel'
  nights?: number

  // type='transport'
  mode?: string
  from?: string
  to?: string
}

export interface DayWeather {
  city: string
  cityAdcode: string
  high: number
  low: number
  desc: string
  icon: string
  fetchedAt: number
}

export interface Day {
  id: string             // nanoid
  date: string           // 'YYYY-MM-DD'
  title?: string
  weather?: DayWeather | null
  spots: Spot[]
}

export interface Destination {
  name: string
  adcode: string
  lat: number
  lng: number
}

export interface Collaborator {
  openid: string
  nickname: string
  avatarUrl: string
  role: 'editor'
  joinedAt: number
}

export interface PackingItem {
  id: string
  category: string
  label: string
  checked: boolean
}

export interface Trip {
  _id: string
  _openid: string
  ownerOpenid: string
  ownerNickname?: string
  ownerAvatarUrl?: string

  name: string
  pax: number
  startDate: string      // 'YYYY-MM-DD'
  endDate: string
  destinations: Destination[]

  collaborators: Collaborator[]
  days: Day[]
  packing: PackingItem[]

  // === AI 草稿流字段, 都可空; 老攻略不需要迁移 ===
  aiTaskId?: string | null
  aiStatus?: 'generating' | 'ready' | 'error' | null
  aiDraft?: GeneratedPlan | null
  aiError?: string | null

  // === 封面图（杂志主题用，其他主题忽略）===
  coverUrl?: string | null

  createdAt: number
  updatedAt: number
  updatedBy: string
}

// 新建 trip 时未落库前的形状
export type NewTripInput = Omit<Trip, '_id' | '_openid' | 'createdAt' | 'updatedAt' | 'updatedBy'>

// === AI 行程生成相关类型 ===

export type AIPace = '悠闲' | '平衡' | '紧凑'
export type AIAudience = '独行' | '情侣' | '亲子' | '老人' | '朋友'

// 前端展示给用户的模型 alias;server 端映射到真实 provider + model
export type AIModelAlias = 'DeepSeek-V4-PRO' | 'DeepSeek-V4-Flash'
export const AI_MODEL_ALIASES: AIModelAlias[] = ['DeepSeek-V4-PRO', 'DeepSeek-V4-Flash']

export interface AIPreferences {
  pace?: AIPace
  audience: AIAudience[]
  budgetCap?: number          // 人均/天 RMB
  freeText?: string
  modelAlias: AIModelAlias    // 必填, 默认 'DeepSeek-V4-Flash'
}

// 注意: 必须复用现有 SpotType ('spot' | 'hotel' | 'meal' | 'transport')。
// 不要新增 'arrive' 等类型, 否则 ItineraryView/MapView 不识别会渲染异常。
// 抵达/出发用 type='transport' 表达。
export interface GeneratedSpot {
  type: SpotType
  name: string
  city: string
  note?: string
  price?: number
  time?: string               // 'HH:mm'
  lat?: number                // LLM 从 search_poi 工具结果抄过来; 无则前端标记 _unresolved
  lng?: number
  adcode?: string
  _unresolved?: boolean       // 缺 lat/lng 时由 client 端预览标记
}

export interface GeneratedDay {
  date: string                // 'YYYY-MM-DD'
  spots: GeneratedSpot[]
}

export interface GeneratedPlan {
  days: GeneratedDay[]
}

// 异步任务记录(对应 cloud db 集合 ai_tasks)
export type AITaskStatus = 'pending' | 'streaming' | 'done' | 'error'

export interface AITask {
  _id: string
  _openid: string
  tripId?: string             // 详情页发起带, 新建页不带
  status: AITaskStatus
  progress?: GeneratedPlan    // 增量结果, 每生成完 1 天追加
  result?: GeneratedPlan      // 最终结果
  error?: string
  modelAlias: AIModelAlias
  tripContext: any            // 提交时的 tripContext 副本(便于复现)
  preferences: AIPreferences
  meta?: {
    elapsedMs?: number
    promptTokens?: number
    completionTokens?: number
    turns?: number
  }
  createdAt: number
  updatedAt: number
}
