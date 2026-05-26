/* eslint-disable react/prop-types */
// data.js — 示例 trip 数据

const SAMPLE_TRIPS = [
  {
    id: 't1',
    name: '北京 · 五日',
    dest: '京',
    destFull: '北京',
    startDate: '2026-04-26',
    endDate: '2026-04-30',
    days: 5,
    pax: 2,
    spotsCount: 28,
    spent: 4280,
    walked: 42,
    daysToGo: 12,
    progress: { packed: 12, total: 24 },
    color: ['#FF7A2E', '#FFC247'],
  },
  {
    id: 't2',
    name: '厦门周末',
    dest: '闽',
    destFull: '厦门',
    startDate: '2026-03-14',
    endDate: '2026-03-16',
    days: 3,
    pax: 2,
    spotsCount: 16,
    spent: 2150,
    walked: 18,
    daysToGo: -45,
    color: ['#4FB286', '#FFC247'],
  },
  {
    id: 't3',
    name: '大理 · 七日',
    dest: '滇',
    destFull: '大理',
    startDate: '2025-11-08',
    endDate: '2025-11-14',
    days: 7,
    pax: 4,
    spotsCount: 36,
    spent: 8420,
    walked: 56,
    daysToGo: -180,
    color: ['#6B46C1', '#FF5B5B'],
  },
  {
    id: 't4',
    name: '东京 · 樱花',
    dest: '日',
    destFull: '东京',
    startDate: '2025-04-01',
    endDate: '2025-04-08',
    days: 8,
    pax: 2,
    spotsCount: 42,
    spent: 18900,
    walked: 81,
    daysToGo: -380,
    color: ['#FF9A4D', '#FF5B5B'],
  },
];

// 当前 trip 的详细日程（用第一段·北京）
const ACTIVE_TRIP_DAYS = [
  {
    date: '2026-04-26',
    weather: { type: 'sun', temp: '18° / 8°', label: '晴' },
    spots: [
      { type: 'transport', name: '抵达北京首都机场', time: '09:30', note: 'CA1801', price: 1280 },
      { type: 'hotel', name: '前门皇家驿栈', time: '12:00', note: '入住 · 4 晚', price: 1840 },
      { type: 'meal', name: '四季民福（故宫店）', time: '13:30', note: '烤鸭 · 必尝', price: 360 },
      { type: 'spot', name: '故宫博物院', time: '15:00', note: '门票需提前预约', price: 60 },
      { type: 'spot', name: '景山公园', time: '18:00', note: '俯瞰故宫日落' },
    ],
  },
  {
    date: '2026-04-27',
    weather: { type: 'cloud', temp: '16° / 6°', label: '多云' },
    spots: [
      { type: 'meal', name: '老北京炸酱面', time: '08:30', price: 80 },
      { type: 'spot', name: '颐和园', time: '10:00', note: '走西线 · 半天', price: 30 },
      { type: 'meal', name: '同和居（西四店）', time: '13:30', price: 280 },
      { type: 'spot', name: '什刹海 · 银锭桥', time: '16:00' },
      { type: 'meal', name: '后海酒吧街', time: '19:30', note: '小酌看夜景', price: 200 },
    ],
  },
  {
    date: '2026-04-28',
    weather: { type: 'sun', temp: '19° / 9°', label: '晴' },
    spots: [
      { type: 'transport', name: '高铁前往八达岭', time: '08:00', price: 80 },
      { type: 'spot', name: '八达岭长城', time: '10:00', note: '北八楼往返', price: 80 },
      { type: 'meal', name: '长城脚下午餐', time: '13:00', price: 180 },
      { type: 'spot', name: '明十三陵 · 定陵', time: '15:30', price: 60 },
      { type: 'meal', name: '簋街小龙虾', time: '20:00', note: '夜宵爆款', price: 320 },
    ],
  },
];

// AI 生成的"剧场化"步骤
const AI_STEPS = [
  { id: 'pref', label: '理解偏好', detail: '悠闲 · 亲子 · 不爱热门' },
  { id: 'search', label: '搜索地点', detail: '5 个目的地 · 200+ 候选' },
  { id: 'route', label: '规划路线', detail: '按距离与时间排序' },
  { id: 'budget', label: '估算预算', detail: '人均 ¥500/天' },
  { id: 'compose', label: '编排成册', detail: '5 天 · 28 个点位' },
];

// AI 采访式问题
const AI_INTERVIEW = [
  {
    id: 'pace',
    q: '这次想要什么节奏？',
    type: 'single',
    options: ['悠闲', '平衡', '紧凑'],
  },
  {
    id: 'audience',
    q: '和谁一起出行？',
    type: 'multi',
    options: ['独行', '情侣', '亲子', '朋友', '老人'],
  },
  {
    id: 'budget',
    q: '每人每天大概想花多少？',
    type: 'single',
    options: ['经济 ¥300', '中等 ¥500', '舒适 ¥800', '奢华 ¥1500+'],
  },
  {
    id: 'free',
    q: '有什么特别想做或不想做的吗？',
    type: 'free',
    placeholder: '比如喜欢拍照、不爱排队、想找当地特色…',
  },
];

// 开销 buckets
const BUDGET_BUCKETS = [
  { key: 'hotel', label: '住宿', value: 1840, color: 'var(--accent)' },
  { key: 'transport', label: '交通', value: 1280, color: 'var(--coral)' },
  { key: 'meal', label: '餐饮', value: 820, color: 'var(--sun)' },
  { key: 'spot', label: '杂项', value: 340, color: 'var(--leaf)' },
];
// 每日花销折线
const BUDGET_DAILY = [
  { d: '4/26', v: 3540 },
  { d: '4/27', v: 590 },
  { d: '4/28', v: 720 },
  { d: '4/29', v: 980 },
  { d: '4/30', v: 450 },
];
const BUDGET_HIGHLIGHT = {
  type: 'meal',
  name: '同和居（西四店）',
  date: '4/27',
  price: 280,
  caption: '本次最贵的一餐',
};

Object.assign(window, {
  SAMPLE_TRIPS, ACTIVE_TRIP_DAYS, AI_STEPS, AI_INTERVIEW,
  BUDGET_BUCKETS, BUDGET_DAILY, BUDGET_HIGHLIGHT,
});
