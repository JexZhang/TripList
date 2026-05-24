# 第三章 · React 基础

React 是行册前端的核心框架。本章用行册里的真实代码讲解 React 最重要的几个概念。

---

## 1. 组件（Component）：界面的积木

React 的核心思想：把界面拆成一个个「组件」，像搭积木一样组合起来。

```tsx
// 一个最简单的组件
function Hello() {
  return <Text>你好，世界！</Text>
}

// 使用它
function App() {
  return (
    <View>
      <Hello />   {/* 像 HTML 标签一样使用 */}
      <Hello />   {/* 可以使用多次 */}
    </View>
  )
}
```

行册的组件树（简化版）：

```
TripPage
  └── TripBody
      ├── trip-head（标题和协作者栏）
      ├── trip-tabs（Tab 导航）
      └── ItineraryView
          ├── ScrollView（日期 Tab 横向滚动）
          │   └── DayTab（每一天的 Tab）  × N天
          ├── DayHeader（当天天气城市）
          └── itin-spots
              ├── SpotCard × N个地点
              ├── itin-add-spot（添加地点按钮）
              └── SpotSearch（搜索弹窗，条件渲染）
```

---

## 2. Props：给组件传数据

Props 就是「属性」，像 HTML 标签的 `src`、`href` 一样，传递数据给组件。

```tsx
// 定义：SpotCard 接受一个 spot 参数
function SpotCard({ spot }: { spot: Spot }) {
  return (
    <View className='spot-card'>
      <Text>{spot.name}</Text>
      <Text>¥{spot.price}</Text>
    </View>
  )
}

// 使用：传入具体数据
<SpotCard spot={{ id: '1', name: '玄武湖', price: 0 }} />
```

行册里的真实例子——`SpotSearch` 组件接受这些 props：

```tsx
// src/components/SpotSearch/index.tsx
interface Props {
  open: boolean           // 是否显示弹窗
  defaultCity?: string   // 默认搜索城市（可选，? 表示可以不传）
  onClose: () => void    // 关闭时调用的函数
  onSelect: (info: SelectedSpotInfo) => void  // 选中地点时调用
}

function SpotSearch({ open, defaultCity, onClose, onSelect }: Props) {
  // ...
}

// 使用
<SpotSearch
  open={searchOpen}
  defaultCity='南京'
  onClose={() => setSearchOpen(false)}
  onSelect={handleAddSpot}
/>
```

---

## 3. State（状态）：让界面会变化

State 是组件自己管理的「记忆」。状态变化 → 界面自动重新渲染。

```tsx
import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState(0)  // 初始值是 0
  //     ↑          ↑
  //   当前值    更新函数

  return (
    <View>
      <Text>计数：{count}</Text>
      <View onClick={() => setCount(count + 1)}>+1</View>
    </View>
  )
}
```

行册里到处都在用 useState：

```tsx
// src/components/SpotSearch/index.tsx
const [keyword, setKeyword] = useState('')          // 搜索关键词
const [results, setResults] = useState<PoiResult[]>([])  // 搜索结果
const [loading, setLoading] = useState(false)       // 是否加载中
const [keyboardHeight, setKeyboardHeight] = useState(0)  // 键盘高度
```

**规律**：每个 `useState` 管理一块独立的数据，数据变化时只有用到它的部分重新渲染。

---

## 4. useEffect：处理副作用

「副作用」是指和渲染无关的事情：网络请求、设置定时器、监听事件等。

```tsx
import { useEffect } from 'react'

useEffect(() => {
  // 这里写副作用
  console.log('组件挂载了！')
}, [])  // 空数组 = 只在组件第一次渲染时执行
```

**第二个参数（依赖数组）的规则**：
- `[]` — 只执行一次（组件挂载时）
- `[keyword]` — `keyword` 变化时执行
- 不传 — 每次渲染都执行（一般不这么用）

行册里的搜索防抖：

```tsx
// src/components/SpotSearch/index.tsx

// 监听 keyword 变化，300ms 后更新 debouncedKw
useEffect(() => {
  if (!open) return
  const t = setTimeout(() => setDebouncedKw(keyword), 300)
  return () => clearTimeout(t)  // 清理函数：下次执行前先取消上次的定时器
}, [keyword, open])  // keyword 或 open 变化时执行

// 监听 debouncedKw 变化，发网络请求
useEffect(() => {
  if (!debouncedKw.trim()) {
    setResults([])
    return
  }
  setLoading(true)
  cloud.searchPoi({ keyword: debouncedKw })
    .then(r => setResults(r.results))
    .finally(() => setLoading(false))
}, [debouncedKw])  // 只在防抖后的关键词变化时触发
```

---

## 5. 条件渲染：根据状态显示不同内容

```tsx
// 方式一：三元运算符（简洁）
{loading ? <Text>加载中...</Text> : <Text>加载完成</Text>}

// 方式二：&& 短路（适合「有时显示有时不显示」）
{keyword.trim() && (
  <View className='ss-manual'>手动添加 "{keyword}"</View>
)}

// 方式三：if 语句（适合复杂逻辑）
if (state.loading) return <View>加载中...</View>
if (state.error) return <View>{state.error}</View>
if (!trip) return <View>未找到攻略</View>
return <View>...</View>
```

行册里 `SpotSearch` 的条件渲染：

```tsx
if (!open) return null  // open=false 时不渲染任何东西

return (
  <View className='spot-search-mask'>
    {/* 加载中显示提示 */}
    {loading && <View className='ss-hint'>搜索中...</View>}

    {/* 有结果时显示列表 */}
    {!loading && results.map(r => <ResultItem key={r.adcode} result={r} />)}

    {/* 没结果但有输入时，显示手动添加 */}
    {!loading && results.length === 0 && keyword.trim() && (
      <View className='ss-hint'>未找到，可以手动添加</View>
    )}
  </View>
)
```

---

## 6. 列表渲染：用 map 渲染数组

```tsx
const days = ['Day 1', 'Day 2', 'Day 3']

// 用 .map() 把数组转成组件列表
{days.map((day, index) => (
  <View key={day}>  {/* key 必须唯一，帮助 React 识别每个元素 */}
    <Text>{day}</Text>
  </View>
))}
```

行册里渲染攻略列表：

```tsx
// src/pages/home/index.tsx
{trips.map(trip => (
  <View key={trip._id} className='trip-item' onClick={() => goToTrip(trip._id)}>
    <Text className='ti-name'>{trip.name}</Text>
    <Text className='ti-meta'>{trip.days.length} 天 · {trip.pax} 人</Text>
  </View>
))}
```

> ⚠️ **为什么需要 key？**  
> React 用 key 来高效地更新列表。如果没有 key，每次数据变化 React 可能会重新渲染整个列表，很慢。用唯一的 `key`（通常是 ID），React 只更新变化的那一项。

---

## 7. 事件处理

```tsx
// 点击事件
<View onClick={() => setOpen(true)}>点我</View>

// 带参数的事件
<View onClick={() => handleDelete(spot.id)}>删除</View>

// 输入框
<Input onInput={e => setKeyword(e.detail.value)} />
// 注意：小程序用 e.detail.value，不是 e.target.value

// 长按
<View onLongPress={() => showDeleteConfirm()}>长按删除</View>
```

---

## 8. 自定义 Hook：复用逻辑

Hook 是以 `use` 开头的函数，封装可复用的逻辑：

```tsx
// 行册的 useTripStore —— 获取攻略状态
const { state, dispatch } = useTripStore()

// 怎么定义的（简化）：
function useTripStore() {
  return useContext(TripStoreContext)  // 从 Context 取值
}
```

---

## 9. 组件生命周期

React 函数组件的「一生」：

```
1. 挂载（Mount）  ← useEffect(..., []) 在这里执行
       ↓
2. 更新（Update）← 状态或 props 变化时
   ↑           ↓   useEffect(..., [dep]) 在 dep 变化时执行
   ↑←←←←←←←←←↓
       ↓
3. 卸载（Unmount）← useEffect 的清理函数在这里执行
```

行册里的例子——攻略详情页加载数据：

```tsx
// src/store/trip-store.tsx
useEffect(() => {
  // 挂载时：从数据库获取攻略
  getTrip(tripId).then(trip => dispatch({ type: 'SET_TRIP', trip }))

  // 建立实时监听
  const watcher = db.watch(...)

  // 卸载时：关闭监听，避免内存泄漏
  return () => watcher.close()
}, [tripId])  // tripId 变化时重新加载
```

---

## 10. useMemo 和 useCallback：性能优化

有些计算很贵（比如处理大量数据），不需要每次渲染都重算：

```tsx
// useMemo：缓存计算结果
const markers = useMemo(() => {
  return located.map((p) => ({
    id: encodeMarkerId(p.dayIdx, p.spotIdx),
    latitude: p.lat,
    longitude: p.lng,
    // ...大量配置
  }))
}, [located, mode])  // 只在 located 或 mode 变化时重算
```

```tsx
// useCallback：缓存函数本身
const handleTap = useCallback((e) => {
  const { dayIdx, spotIdx } = decodeMarkerId(e.detail.markerId)
  sheetRef.current?.show(trip.days[dayIdx].spots[spotIdx])
}, [trip.days])  // 只在 trip.days 变化时创建新函数
```

---

## 核心概念总结

| 概念 | 用途 | 行册里的例子 |
|------|------|------------|
| `useState` | 组件内部状态 | `searchOpen`, `keyword`, `results` |
| `useEffect` | 副作用（请求、监听） | 搜索防抖、数据库监听 |
| `useMemo` | 缓存计算结果 | 地图标记点计算 |
| `useCallback` | 缓存函数引用 | 地图点击处理 |
| Props | 父→子传数据 | `open`, `onClose`, `onSelect` |
| 条件渲染 | 根据状态显示/隐藏 | `{loading && <Text>加载中</Text>}` |
| 列表渲染 | 数组→组件列表 | `spots.map(s => <SpotCard />)` |

**下一步**：[Taro 框架 →](./02-Taro框架.md)
