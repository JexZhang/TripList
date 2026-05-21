# 地图 Tab 设计 (Map View)

- 日期: 2026-05-21
- 范围: 在 trip 详情页新增"地图"tab,展示 spot 的地理位置与单日路线
- 状态: Brainstorming → 已通过设计评审,待落实施计划

## 目标

让用户从地理视角理解一份攻略:
1. 一眼看清整次行程的空间分布(全部模式)
2. 安排单日游玩顺序(单日模式 + 路线连线)
3. 出行当天可以直接拉起系统地图导航到具体 spot

## 非目标

- 不调用高德 routing API 画真实驾车/步行路径
- 不支持"在地图上点一点添加 spot"
- 不跨端(仅微信小程序)
- 不消耗高德 API 配额(坐标已在 spot 上)

## 信息架构

`pages/trip/index.tsx` 的 `VIEWS` 数组增加一项,排在最后:

```ts
{ key: 'map', label: '地图' }
```

VIEWS 顺序变为:攻略 / 开销 / 清单 / 地图。

地图视图在用户切到此 tab 时才挂载;切走后卸载,避免 weapp `<Map>` 组件常驻消耗。

## 页面布局

```
┌──────────────────────────────┐
│ ◉全部 ○Day1 ○Day2 ○Day3 ...  │ 顶部模式条 (scroll-x)
├──────────────────────────────┤
│                              │
│           [全屏 Map]         │
│   ②                          │
│    ↓                         │
│   ①  ③                       │
│      ↘  ④                    │
│                              │
└──────────────────────────────┘
```

- **顶部模式条**: 横向滚动。固定首项"全部",后续按 `trip.days` 数组顺序依次列出"Day1 / Day2 / Day3 ..."(N 为 1 起的序号,即 `trip.days` 中该 day 的索引 + 1)。当前选中项高亮。该序号也是全部模式下 marker label 用的数字。
- **地图区**: 占满模式条下方所有空间。

无空数据态提示:若当前模式下没有可定位的 spot,就让地图保持空,不显示文案或引导。

## Marker 与路线规则

### 数据筛选

只有同时具备 `lat` 和 `lng` 的 spot 才参与 marker 渲染。缺坐标的 spot 静默忽略(攻略页仍然能看到这个 spot)。

### 单日模式 (`mode = day-{dayId}`)

- Marker 列表 = 该 day 的 spots(按数组顺序)
- 每个 marker 显示当日序号 callout: "1" / "2" / "3" ...
- 所有 marker 同色(该 day 的主题色)
- 画一条 `polyline` 按 spot 顺序串联,启用 `arrowLine: true` 以显示方向

### 全部模式 (`mode = all`)

- Marker 列表 = 所有 day 的所有可定位 spot
- 每个 marker 显示**它所属 day 的序号**(同一天的多个 spot 都显示相同数字)
- 同一天的 marker 同色;不同 day 用不同色
- **不画 polyline**(全部模式连线视觉混乱)

### 配色

在 `views/MapView/helpers.ts` 维护一个色板,按 day 索引取色,循环复用:

```ts
const DAY_COLORS = ['#c43d3d', '#d98c2a', '#3a7d4f', '#2a6b9e', '#7a4ca0', '#a85a8e', '#5c5c5c']
export function dayColor(dayIndex: number): string {
  return DAY_COLORS[dayIndex % DAY_COLORS.length]
}
```

## 视野管理 (fitBounds)

每次 `mode` 切换或当前模式下的 spot 集合变化时:
1. 收集所有参与渲染的 spot 坐标 → `points: { latitude, longitude }[]`
2. `Taro.createMapContext(mapId, this).includePoints({ points, padding: [80, 40, 80, 40] })`
3. 若 `points.length === 0`,什么也不做(空地图)
4. 若 `points.length === 1`,`includePoints` 仍可工作,但 zoom 可能过远 → 同时 `setScale(14)`

`<Map>` 组件初始 `latitude/longitude` 设为 trip 首个 destination 的坐标(若有),否则用默认值(如杭州 30.27, 120.15)。

## Marker 点击 → 详情卡 + 导航

`<Map>` 的 `onMarkerTap` 回调拿到 markerId:
- weapp `<Map>` 要求 marker.id 为整数。我们用 `dayIdx * 1000 + spotIdx` 编码(dayIdx/spotIdx 都从 0 起,1000 足够覆盖单日 spot 数)
- 每次渲染重建 `markerId → { dayIdx, spotIdx }` 的查找表(无需持久,只在当前渲染周期内使用)
- 点击拿到 id → 反查 spot → 弹出底部 sheet

`SpotMapSheet` 组件(新建,轻量):
- 显示:类型图标 / spot.name / spot.city / spot.note / spot.price(若有)
- 一个主按钮:**「拉起地图导航」**
  - 实现: `Taro.openLocation({ latitude, longitude, name, address: spot.note || spot.city })`
  - 系统会弹出原生地图页,用户可在该页选择跳转高德/腾讯/百度地图 App(若已装)
- 关闭手势:点 sheet 外或顶部下拉关闭

不强行通过 `wx.navigateToMiniProgram` 跳高德小程序 —— 那条路需要在 `app.config.ts` 的 `navigateToMiniProgramAppIdList` 静态声明高德 appId,且用户首次会有授权弹窗,体验差。`openLocation` 是更稳的路径。

## 组件拆分

```
src/views/MapView/
  index.tsx          # 主体,接 trip,做模式切换 / fitBounds / marker 生成
  ModeBar.tsx        # 顶部模式条
  SpotMapSheet.tsx   # 点击 marker 后的底部信息卡
  helpers.ts         # dayColor / markerIdEncode / collectPoints
  index.scss
```

`pages/trip/index.tsx`:
- VIEWS 增加 `{ key: 'map', label: '地图' }`
- `trip-content` 内增加 `{view === 'map' && <MapView />}`
- `MapView` 自己从 `useTripStore` 取 trip,不需要 props

## 坐标系说明

- weapp `<Map>` 使用 GCJ-02 (火星坐标系)
- 高德 POI 搜索返回的 `lng/lat` 也是 GCJ-02
- 现有 SpotSearch 已经在用高德 POI,所以 spot 上存的坐标本就是 GCJ-02
- **无需任何坐标转换**

## 错误与边界

- spot 缺 `lat/lng`:沉默降级,不参与地图渲染
- `Taro.openLocation` 失败(权限拒绝等): `Taro.showToast({ title: '无法拉起地图', icon: 'none' })`
- spot 超过 100 个: 不做裁剪(实际不会触及),`console.warn` 提示
- map 组件初始化失败: weapp 极少发生,不做特殊处理

## 验证(手动)

项目无单测基建。验证清单:

1. 新建 trip,选 1 个目的地,不加 spot → 切到地图 tab → 地图空白,不报错
2. 加 2 个同城 spot 到 Day 1 → 地图 tab 单日模式显示 2 marker + 直线 + 箭头
3. 加 spot 到 Day 2 → 模式条出现 Day 2 按钮 → 切过去显示 Day 2 spot
4. 切"全部"模式 → 所有 spot 显示,同 day 同色同号,不连线
5. fitBounds: 包含所有可见 marker,padding 合理
6. 点 marker → sheet 弹出 → 点导航按钮 → 系统地图页打开
7. 切回攻略 tab,再切回地图 tab → 状态保留(默认从"全部"重新挂载也可接受,无强要求)

## 实现成本估算

- 新增 5 个文件(MapView 目录)
- 修改 `pages/trip/index.tsx` 加 tab 项
- 修改 `src/app.config.ts` ?(`<Map>` 在 weapp 一般无需特别 permission,但若用到 `Taro.openLocation` 需检查 `requiredPrivateInfos`,见下)

`app.config.ts` 检查:
- `Taro.openLocation` 需要在 `permission.scope.userLocation` ?不一定,只在需要"获取用户当前位置"时才要;`openLocation` 是显示固定坐标点,不需要用户授权。但部分小程序基础库要求 `requiredPrivateInfos: ['getLocation']` —— 我们用 `openLocation` 而非 `getLocation`,**无需声明**。

## 未来扩展(本次不做)

- 全部模式可点 marker 后,sheet 内增加"跳转到这一天攻略"按钮(快速回到攻略 tab 对应 Day)
- 在攻略页 Day Header 旁加一个小地图缩略图
- 路径预估时间:调高德 routing API 拿两点间预计时长,在 polyline 上标
- 拍照打卡定位:与"AI 行程"独立,后续 brainstorming
