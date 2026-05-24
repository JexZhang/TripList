# 第六章 · 如何找 Bug

Bug 是每个程序员的日常。找 Bug 是一种可以学习的技能，关键是掌握系统的排查思路。

---

## Bug 的本质

Bug 通常是以下几种情况：

1. **逻辑错误**：代码运行了，但结果不对（比如金额计算错误）
2. **类型错误**：把字符串当数字用（`"3" + 2 = "32"` 而不是 `5`）
3. **空值错误**：访问了 `undefined` 或 `null` 的属性（`Cannot read property 'name' of undefined`）
4. **异步错误**：期望「先做 A 再做 B」，但实际「A 还没完成 B 就开始了」
5. **状态不同步**：界面显示的和数据库里的不一样

---

## 第一步：重现 Bug

「我的应用出 Bug 了」不够具体。好的 Bug 报告是：

> 在攻略「南京5日游」的 Day1，点击「玄武湖」→「编辑地点」，修改备注为「带望远镜」后点保存，备注显示为空白。

能精确重现，才能系统排查。

---

## 第二步：console.log 大法

在关键位置打印日志是最直接的方法：

```tsx
const handleAddSpot = (info: SelectedSpotInfo) => {
  console.log('[handleAddSpot] 收到:', info)  // 看收到什么数据

  const spot: Spot = {
    id: uid(),
    type: 'spot',
    name: info.name,
    lat: info.lat,
    lng: info.lng,
  }

  console.log('[handleAddSpot] 创建的 spot:', spot)  // 看创建了什么

  dispatch({ type: 'ADD_SPOT', dayId: activeDay.id, spot })
  console.log('[handleAddSpot] dispatch 完成')
}
```

在微信开发者工具里，左下角「调试器」→「Console」可以看到所有 `console.log` 的输出。

### console 的几种用法

```javascript
console.log('普通信息', someVariable)
console.warn('警告信息')  // 黄色
console.error('错误信息', error)  // 红色，在 Console 里醒目

// 打印对象（可展开查看）
console.log('trip 数据:', state.trip)

// 打印多个值
console.log('dayId:', dayId, 'spotId:', spotId)

// 打印函数执行时间
console.time('计算标记点')
const markers = buildMarkers()
console.timeEnd('计算标记点')  // 输出: 计算标记点: 12.3ms
```

---

## 第三步：缩小问题范围

Bug 排查的核心思路：**二分法**。

```
界面显示错误
  ↓
数据是否正确？
  ├── 数据错了 → 问题在「获取/处理数据」
  └── 数据对了 → 问题在「渲染」
         ↓
数据错了，是从云端取来就错了，还是前端处理出错？
  ├── 取来就错 → 问题在云函数或数据库
  └── 处理出错 → 问题在 Reducer 或工具函数
```

```tsx
// 在不同层级加 log，找到问题的边界
useEffect(() => {
  console.log('[1] trip 数据变化:', state.trip)
}, [state.trip])

const handleSave = (patch: Partial<Spot>) => {
  console.log('[2] 保存前 patch:', patch)
  dispatch({ type: 'UPDATE_SPOT', ..., patch })
}

// Reducer 里
case 'UPDATE_SPOT': {
  console.log('[3] Reducer 收到:', action)
  const result = { /* 新状态 */ }
  console.log('[4] Reducer 返回:', result)
  return result
}
```

---

## 第四步：检查常见错误类型

### 空值错误（最常见！）

```
TypeError: Cannot read property 'name' of undefined
```

意思是：你在访问 `undefined.name`，也就是某个变量是 `undefined` 但你当成对象用了。

```tsx
// ❌ 危险
const city = trip.destinations[0].name  // 如果 destinations 为空数组，崩溃！

// ✅ 安全
const city = trip.destinations?.[0]?.name  // 可选链，任一层为空就返回 undefined
const city = trip.destinations?.[0]?.name ?? '未知城市'  // ?? 提供默认值
```

### 异步错误

```tsx
// ❌ 错误：await 用在了非 async 函数里
function loadData() {
  const data = await fetchData()  // SyntaxError: await is only valid in async functions
}

// ✅ 正确：标记为 async
async function loadData() {
  const data = await fetchData()
}
```

### 数组方法用错

```javascript
// 常见错误
const spots = undefined
spots.map(...)  // 报错：undefined 没有 .map 方法

// 解决
const spots = trip?.days?.[0]?.spots ?? []
spots.map(...)  // 即使 undefined 也不报错，因为 ?? [] 保证了是数组
```

### 闭包陈旧值

```tsx
// ❌ 问题：timer 里捕获的是旧的 count
const [count, setCount] = useState(0)

const increment = () => {
  setTimeout(() => {
    setCount(count + 1)  // 每次都用的是 count=0，因为 count 在闭包里是旧值
  }, 1000)
}

// ✅ 解决：用函数形式，拿到最新值
const increment = () => {
  setTimeout(() => {
    setCount(prev => prev + 1)  // prev 永远是最新值
  }, 1000)
}
```

---

## 第五步：查看错误堆栈

当出现红色错误时，不要慌，读错误信息：

```
TypeError: Cannot read properties of undefined (reading 'spots')
    at ItineraryView (ItineraryView/index.tsx:45)
    at renderWithHooks (react-dom.js:16)
```

从下往上读：
- 错误发生在 `ItineraryView/index.tsx` 的第 45 行
- 错误类型是 `TypeError`（类型错误）
- 具体是：读取了 `undefined` 的 `spots` 属性

去 `ItineraryView/index.tsx:45` 看代码，大概是：

```tsx
// 第 45 行
activeDay.spots.map(...)  // activeDay 是 undefined！
```

解决：
```tsx
// 检查 activeDay 是否存在
if (!activeDay) return <View>没有选中的日期</View>
```

---

## 行册中遇到过的 Bug 类型

### Bug 1：键盘遮住搜索框（已修复）

**现象**：在 SpotSearch 里点输入框，键盘弹出后输入框被遮住，看不到输入了什么。

**排查过程**：
1. 怀疑是 `position: fixed` 的 Sheet 没有随键盘上移
2. 查微信文档，发现 `adjust-position` 属性控制键盘弹出时是否上移
3. 发现默认 `adjust-position=true` 会推整个页面，但 fixed 元素不跟着动

**修复**：设 `adjustPosition={false}` + 监听 `onKeyboardHeightChange` 手动上移

### Bug 2：页面横向滑出边界（已修复）

**现象**：在攻略和地图页面上滑动时，整个页面会横向偏移，出现灰色空白区域。

**排查过程**：
1. 排除内容宽度溢出（检查了所有 ScrollView）
2. 猜测是微信允许页面横向滚动
3. 查文档，确认 `page { overflow-x: hidden }` 可以禁用

**修复**：在 `app.scss` 的 `page` 里加 `overflow-x: hidden`

---

## 调试技巧总结

| 场景 | 技巧 |
|------|------|
| 不知道数据是什么 | `console.log` 打印 |
| 不知道哪一步出错 | 在每个关键步骤都加 log，找到第一个不对的 |
| 出现 undefined 错误 | 用 `?.` 可选链 + `??` 默认值 |
| 界面没更新 | 检查是否用了不可变更新（`{...state}`）|
| 网络请求失败 | 查 Network 面板，看请求和响应 |
| 云函数出错 | 在云开发控制台看云函数日志 |

---

## 心态建议

- **Bug 不可怕**，它只是「代码和期望不一致」
- **不要乱改代码**，先理解再改，否则修了一个引出三个
- **一次只改一处**，改了之后验证，再改下一处
- **写日志记录变化**，帮助定位问题位置

**下一步**：[调试工具使用 →](./02-调试工具.md)
