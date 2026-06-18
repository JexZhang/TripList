# 行迹小程序优化报告

> 审查时间：2026-06-01 | 项目：Taro 4.2 + React 18 + CloudBase

---

## 一、包体积优化 🔴 高优先级

### 1.1 分包配置 — 当前未配置 subpackages

当前 `app.config.ts` 中所有 5 个页面都在主包，trip 页面 JS 文件达 **344KB**，dist 总体积 3.0MB。

```ts
// 建议：app.config.ts 增加分包
subpackages: [
  {
    root: 'pages-trip',
    pages: ['trip/index'],     // trip 及关联组件移入分包
  },
  {
    root: 'pages-me',
    pages: ['me/index'],       // 我的页移入分包
  },
]
```

**预估收益**：主包可减少约 400KB，启动速度提升约 30%。

### 1.2 Babel targets 过于保守

`babel.config.js` 目标为 `chrome: '53', ios: '8'`，微信小程序基础库 2.2.3+ 实际支持现代 ES 语法。

```js
// 建议改为
targets: {
  chrome: '70',     // 微信基于 Chrome 70+ 内核
  ios: '12',        // iOS 12+
}
```

**收益**：减少 polyfill 注入，JS bundle 可缩减 5-10%。

### 1.3 构建配置优化

`project.config.json` 中几个可优化的项：

| 配置项 | 当前值 | 建议 | 原因 |
|--------|--------|------|------|
| `uploadWithSourceMap` | `true` | `false` | 生产环境无需 sourcemap，增加上传体积 |
| `uglifyFileName` | `false` | `true` | 压缩文件名、减少包体积 |
| `compileWorklet` | `false` | 保留 | 当前没用 worklet 可不管 |
| `disableSWC` | `true` | 评估启用 | Taro 4.x 已支持 SWC，编译速度可提升 |

---

## 二、性能优化 🔴 高优先级

### 2.1 首页 AI 轮询问题

当前 `pages/home/index.tsx` 第 59-69 行，当有 `generating` 状态的行程时，**每 5 秒**调用 `listMyTrips` 拉取全量数据：

```tsx
// 问题代码
useEffect(() => {
  const timer = setInterval(() => {
    listMyTrips(openid).then((list) => setTrips([...SEED_TRIPS, ...list]))
  }, 5000)
  return () => clearInterval(timer)
}, [openid, trips])
```

**问题**：
- 每次拉全量数据（所有 trip），浪费带宽和云函数调用次数
- `trips` 在依赖数组中，每次更新后重新创建定时器

**建议**：使用 `Taro.cloud.database().watch()` 只监听有 AI 状态的 trip，或通过云函数返回轻量状态摘要。

### 2.2 trip-store 全量保存问题

`store/trip-store.tsx` 第 219 行 debounce 保存时每次都提交全部字段：

```ts
await updateTrip(trip._id, {
  name: trip.name, pax: trip.pax, startDate: trip.startDate,
  endDate: trip.endDate, destinations: trip.destinations,
  days: trip.days, packing: trip.packing,
}, openid)
```

**建议**：追踪脏字段做增量更新，避免每次都传输完整的 `days` 数组。

### 2.3 天气缓存不持久

`utils/weather.ts` 通过内存 Map 缓存天气，30 分钟 TTL。每次冷启动需重新获取。

**建议**：结合 `Taro.setStorageSync/getStorageSync` 做二级缓存，减少 API 调用。

### 2.4 MapView 视野管理可优化

`views/MapView/index.tsx` 使用 `ref` + `onRegionChange` 手动管理视野状态。当前通过 `includePoints` 命令式调整 → 等 `onRegionChange(type='end')` 回调 → 写 ref，链路较长。**可以考虑使用 `MapContext.moveToLocation` 替代部分逻辑**，但当前实现已经是比较精细的优化了。

---

## 三、代码架构优化 🟡 中优先级

### 3.1 主题分发器重复模式

四大视图（Home、TripHeader、ItineraryView、PackingView）各有 4 个主题变体文件，每个都用相同的 `{theme === 'X' && <ComponentX />}` 模式。

**建议**：抽取 `ThemeSwitch` 组件统一分发逻辑：

```tsx
const ThemeSwitch = <P,>({ theme, variants, props }: { ... }) => 
  variants[theme] ? <variants[theme] {...props} /> : null
```

可减少约 15 处重复的分发逻辑。

### 3.2 trip/index.tsx 过长

409 行，包含 AI 流程、分享、ActionSheet、协作等全部逻辑。**建议拆分**：
- `useTripAI()` — AI 相关状态与函数
- `useTripActions()` — 重命名/复制/删除/分享逻辑
- 主体仅保留视图分发

### 3.3 魔法数字集中化

`'#c43d3d'` 出现 5 次，`500/550/600/650` 超时值散落各处。**建议**抽到 `tokens.scss` 或常量文件。

---

## 四、微信小程序平台优化 🟡 中优先级

### 4.1 评估 Skyline 渲染引擎

当前使用 WebView 渲染。Skyline 可带来：
- 更高的滚动性能（原生线程渲染）
- 更好的动画效果
- 减少 WXS 依赖

但需要注意：Skyline 对 CSS 支持有限制，迁移成本较高。建议先在次要页面试验。

### 4.2 补充 onShareTimeline

当前 `TripPage` 只实现了 `useShareAppMessage`（转发给好友），未实现 `useShareTimeline`（分享到朋友圈）。旅行攻略天然适合朋友圈分享。

### 4.3 离线体验

当前无任何离线缓存策略。建议：
- 种子行程数据可离线访问
- 添加 `wx.onNetworkStatusChange` 监听网络变化并提示用户

---

## 五、用户体验优化 🟢 低优先级

### 5.1 加载状态优化

多处使用纯文字 `'加载中...'`，建议使用骨架屏或 Taro 内置 Loading 组件。

### 5.2 错误恢复

`listMyTrips` 失败时静默 fallback 到种子数据，用户不知道数据不是最新的。建议用 `Taro.showToast` 提示。

### 5.3 地图 Marker 本地化

当前 marker icon 使用空白图 + callout 气泡，在不同设备上可能出现错位。可考虑用 canvas 绘制自定义 marker。

---

## 六、安全与数据 🟢 低优先级

### 6.1 ensure-user 重复调用

`pages/trip/index.tsx` 每次进入都调用 `ensure-user` 云函数，实际上 `app.tsx` 的 `MeProvider` 已经做过。可考虑缓存 openid。

### 6.2 Storage 清理

`ai-preview-shown` 的标记使用 `Taro.setStorageSync`，日积月累会堆积。建议添加最大条数限制和定期清理。

---

## 优先级汇总

| 优先级 | 优化项 | 预期收益 |
|--------|--------|----------|
| 🔴 高 | 配置分包 | 主包减少 400K+，首屏快 30% |
| 🔴 高 | 首页轮询改 Watch | 减少 90% 无效 API 调用 |
| 🔴 高 | Babel targets 现代化 | 包体积减 5-10% |
| 🔴 高 | 生产环境去掉 sourcemap | 上传体积减 30% |
| 🟡 中 | trip-store 增量更新 | 减少数据传输量 |
| 🟡 中 | 天气缓存持久化 | 减少 API 调用 |
| 🟡 中 | trip/index.tsx 拆分 | 可维护性提升 |
| 🟡 中 | ThemeSwitch 组件 | 减少重复代码 |
| 🟢 低 | 骨架屏/错误提示 | 用户体验提升 |
| 🟢 低 | 朋友圈分享 | 增长渠道 |
