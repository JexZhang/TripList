import type { Trip, AIAudience } from './trip'

// 模板专属字段(运营/分类用)
export interface TemplateMeta {
  city: string
  region: string
  dayCount: number      // 冗余:= days.length
  spotCount: number     // 冗余:各 day spots 之和
  tags: string[]        // 主题玩法:美食/古镇/自然/citywalk/博物馆/温泉/海岛...
  audience: AIAudience[] // 复用 AI 枚举:独行/情侣/亲子/老人/朋友
  seasons: string[]     // 季节:春/夏/秋/冬/看雪/避暑(可空)
  featured: boolean
  sortWeight: number
  coverImages: string[] // 初期可空
  version: number
}

// 完整模板文档:复用 Trip 的行程内容字段,去掉身份/AI 字段,叠加模板字段。
// 注:days/pax 等结构与 Trip 一致,故复用 aggregateBudget(trip)/collectLocated(days) 等纯 helper 时
//     用 `template as unknown as Trip` 结构化传入(只读 days/pax,安全)。
export interface Template
  extends Omit<
      Trip,
      | '_openid' | 'ownerOpenid' | 'ownerNickname' | 'ownerAvatarUrl'
      | 'collaborators' | 'updatedBy'
      | 'aiTaskId' | 'aiStatus' | 'aiDraft' | 'aiError'
    >,
    TemplateMeta {}

// 列表轻字段卡片:不含 days/packing 等重字段,避免列表误带大对象
export interface TemplateCard {
  _id: string
  name: string
  city: string
  region: string
  dayCount: number
  spotCount: number
  tags: string[]
  audience: AIAudience[]
  seasons: string[]
  coverImages: string[]
}

export interface TemplateQuery {
  dayCount?: number      // 精确天数(1..5)
  dayCountGte?: number   // 「6天+」用 dayCountGte=6
  city?: string
  region?: string
  tags?: string[]        // 维度内 OR
  audience?: AIAudience[]
  seasons?: string[]
  keyword?: string       // 命中 name / city
  skip?: number
  limit?: number
}
