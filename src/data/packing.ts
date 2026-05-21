export interface PackingCategory {
  id: string
  label: string
  icon: string
}

export const PACKING_CATEGORIES: PackingCategory[] = [
  { id: 'doc', label: '证件', icon: '◇' },
  { id: 'wear', label: '衣物', icon: '◆' },
  { id: 'tech', label: '电子', icon: '◈' },
  { id: 'wash', label: '洗漱', icon: '○' },
  { id: 'med', label: '药品', icon: '●' },
  { id: 'etc', label: '其他', icon: '□' },
]

export const DEFAULT_PACKING: Array<[string, string]> = [
  ['doc', '身份证'], ['doc', '现金 + 银行卡'], ['doc', '酒店预订单 / 机票 / 车票'],
  ['wear', '换洗衣物'], ['wear', '睡衣'], ['wear', '袜子内衣'],
  ['tech', '手机 + 充电器'], ['tech', '充电宝'], ['tech', '数据线'],
  ['wash', '牙刷牙膏'], ['wash', '洗面奶'], ['wash', '护肤品 / 防晒'],
  ['med', '创可贴'], ['med', '肠胃药'], ['med', '感冒药'],
  ['etc', '雨伞 / 雨衣'], ['etc', '墨镜'], ['etc', '购物袋'],
]

export interface PackingTemplate {
  name: string
  items: Array<[string, string]>
}

export const PACKING_TEMPLATES: PackingTemplate[] = [
  {
    name: '国内 · 基础',
    items: DEFAULT_PACKING,
  },
  {
    name: '江浙华南 · 夏',
    items: [
      ['wear', '短袖 T 恤 ×4'], ['wear', '短裤 / 裙 ×2'], ['wear', '一件薄外套（冷气房）'],
      ['wear', '凉鞋 + 运动鞋'], ['wear', '泳衣（如下水）'],
      ['wash', '高倍数防晒（SPF50+）'], ['wash', '晒后修复'],
      ['med', '藿香正气液（中暑）'], ['med', '蚊虫叮咬膏'],
      ['etc', '折叠伞 / 防晒帽'], ['etc', '墨镜'], ['etc', '保温水杯'],
    ],
  },
  {
    name: '东北华北 · 冬',
    items: [
      ['wear', '羽绒服（厚）'], ['wear', '保暖内衣 ×2 套'], ['wear', '毛衣 / 抓绒'],
      ['wear', '雪地靴 / 防滑鞋'], ['wear', '围巾 + 帽子 + 手套'], ['wear', '厚袜子 ×4'],
      ['tech', '暖宝宝 ×10'], ['tech', '手机暖宝宝（极寒保电）'],
      ['wash', '润唇膏'], ['wash', '面霜（高油脂）'], ['wash', '护手霜'],
      ['med', '感冒药'],
      ['etc', '保温杯 / 暖水袋'],
    ],
  },
  {
    name: '高原游',
    items: [
      ['med', '红景天（提前 7 天开始服用）'], ['med', '葡萄糖'], ['med', '便携氧气罐'],
      ['med', '高原安'], ['med', '肠胃药'], ['med', '感冒药（高原最忌感冒）'],
      ['wear', '冲锋衣（防风）'], ['wear', '保暖抓绒'], ['wear', '登山鞋'],
      ['wash', '高倍数防晒（SPF50+）'], ['wash', '润唇膏'],
      ['etc', '墨镜（紫外线强）'], ['etc', '保温杯'],
    ],
  },
  {
    name: '出境游',
    items: [
      ['doc', '护照（有效期 > 6 个月）'], ['doc', '签证 / 电子签打印'], ['doc', '往返机票'],
      ['doc', '酒店预订单（海关可能查）'], ['doc', '境外旅行保险'], ['doc', '驾照 + 国际驾照'],
      ['doc', '外币现金 / 多币种信用卡'],
      ['tech', '国际转换插头'], ['tech', '境外流量卡 / eSIM'],
      ['etc', '翻译 App（离线包）'], ['etc', '插座转换器'],
    ],
  },
  {
    name: '短途周末',
    items: [
      ['doc', '身份证'], ['doc', '高铁票 / 机票'],
      ['wear', '1 套换洗'], ['wear', '睡衣'],
      ['tech', '充电器'], ['tech', '充电宝'],
      ['wash', '旅行装洗漱包'],
      ['etc', '雨伞'],
    ],
  },
]
