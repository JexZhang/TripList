# 第三章 · Taro 框架

## Taro 是什么

Taro 是一个「跨端框架」——你用 React 的方式写代码，Taro 负责把它翻译成微信小程序能运行的格式。

```
你写的代码（React + TypeScript）
          ↓ Taro 编译
微信小程序格式（WXML + WXSS + JS）
```

类比：Taro 就像翻译软件，你说中文，它翻译成微信能听懂的语言。

---

## 为什么要用 Taro

不用 Taro，直接写原生小程序是这样的：

```xml
<!-- 原生小程序写法（WXML，类似 HTML）-->
<view class="spot-card">
  <text>{{spot.name}}</text>
  <text>¥{{spot.price}}</text>
</view>
```

```javascript
// 原生小程序 JS（不能用 React）
Page({
  data: { spot: null },
  onLoad() {
    this.setData({ spot: { name: '玄武湖', price: 0 } })
  }
})
```

用 Taro 的写法（和普通 React 一样）：

```tsx
function SpotCard({ spot }) {
  return (
    <View className='spot-card'>
      <Text>{spot.name}</Text>
      <Text>¥{spot.price}</Text>
    </View>
  )
}
```

优势：
- 可以用 React 的所有特性（useState、useEffect 等）
- TypeScript 支持更好
- 可以用 npm 包
- 同一套代码可以编译成多端（微信、支付宝、H5 等）

---

## Taro 的核心组件

Taro 把小程序的原生组件包装成 React 组件：

| Taro 组件 | 对应原生 | 类似 HTML | 用途 |
|-----------|---------|----------|------|
| `<View>` | `<view>` | `<div>` | 容器、布局 |
| `<Text>` | `<text>` | `<span>` | 文字 |
| `<Image>` | `<image>` | `<img>` | 图片 |
| `<Input>` | `<input>` | `<input>` | 文本输入 |
| `<Textarea>` | `<textarea>` | `<textarea>` | 多行文本 |
| `<ScrollView>` | `<scroll-view>` | - | 可滚动区域 |
| `<Picker>` | `<picker>` | `<select>` | 选择器 |
| `<Map>` | `<map>` | - | 地图 |
| `<Button>` | `<button>` | `<button>` | 按钮 |

使用时从 `@tarojs/components` 导入：

```tsx
import { View, Text, Input, ScrollView, Map } from '@tarojs/components'
```

---

## Taro 的 API

微信小程序有很多内置 API（提示框、导航、分享等），Taro 也封装好了：

```tsx
import Taro from '@tarojs/taro'

// 页面跳转
Taro.navigateTo({ url: '/pages/trip/index?id=123' })
Taro.redirectTo({ url: '/pages/home/index' })  // 替换当前页
Taro.reLaunch({ url: '/pages/home/index' })    // 重启到这个页面

// 弹出提示
Taro.showToast({ title: '保存成功', icon: 'success', duration: 1500 })
Taro.showModal({
  title: '确认删除？',
  content: '删除后不可恢复',
  confirmText: '删除',
  confirmColor: '#c43d3d',
}).then(res => {
  if (res.confirm) { /* 用户点了确认 */ }
})

// 获取路由参数（当前页面 URL 里的参数）
const router = useRouter()
const tripId = router.params.id  // /pages/trip/index?id=abc123
```

---

## 页面生命周期 Hook

Taro 提供了小程序页面级别的生命周期 Hook：

```tsx
import { useRouter, useDidShow, useDidHide } from '@tarojs/taro'

function HomePage() {
  // 页面每次显示时执行（包括从其他页面返回来）
  useDidShow(() => {
    loadTrips()  // 每次进入首页都刷新数据
  })

  // 页面隐藏时执行
  useDidHide(() => {
    cleanup()
  })
}
```

行册首页用了 `useDidShow` 来刷新列表，这样新建攻略后返回首页，列表会自动更新。

---

## ScrollView：可滚动区域

行册里大量使用 `ScrollView`：

```tsx
// 横向滚动（攻略 Tab 里的日期选择栏）
<ScrollView scrollX enableFlex className='itin-tabs'>
  {days.map(day => <DayTab key={day.id} />)}
</ScrollView>

// 纵向滚动（搜索结果列表）
<ScrollView scrollY className='ss-results'>
  {results.map(r => <ResultItem key={r.adcode} />)}
</ScrollView>
```

> ⚠️ **重要**：ScrollView 纵向滚动必须设置固定高度，否则不工作。  
> 行册的做法是用 flex 布局：
> ```scss
> .ss-results {
>   flex: 1;       /* 占满剩余空间 */
>   height: 0;     /* flex 子元素的 height:0 是必须的，否则撑不开 */
>   min-height: 0;
> }
> ```

---

## Picker：选择器

行册用 Picker 来选择出行人数：

```tsx
// src/pages/trip/index.tsx
const PAX_OPTIONS = Array.from({ length: 99 }, (_, i) => `${i + 1} 人`)
// 生成 ['1 人', '2 人', ..., '99 人']

<Picker
  mode='selector'
  range={PAX_OPTIONS}                    // 选项列表
  value={trip.pax - 1}                   // 当前选中索引（从 0 开始）
  onChange={e => {
    const next = Number(e.detail.value) + 1  // 索引 +1 = 人数
    dispatch({ type: 'UPDATE_TRIP', patch: { pax: next } })
  }}
>
  <Text className='th-pax-edit'>{trip.pax} 人 ▾</Text>
</Picker>
```

Picker 的 `mode` 有多种：`selector`（普通选择）、`date`（日期）、`time`（时间）等。

---

## Map 组件：地图

行册地图页的核心：

```tsx
// src/views/MapView/index.tsx
<Map
  id='trip-map'             // 必须有 id，用于获取地图操作对象
  className='mv-map'
  latitude={30.27}          // 中心点纬度
  longitude={120.15}        // 中心点经度
  scale={10}                // 缩放级别（1-20）
  markers={markers}         // 标记点数组
  polyline={polyline}       // 路线数组
  onMarkerTap={handleTap}   // 点击标记时触发
  onCalloutTap={handleTap}  // 点击气泡时触发
/>
```

通过 `Taro.createMapContext` 获取地图操作对象，可以调用 API：

```tsx
const ctx = Taro.createMapContext('trip-map')

// 自动调整视野，让所有点都在屏幕里
ctx.includePoints({
  points: [
    { latitude: 32.06, longitude: 118.77 },  // 南京
    { latitude: 31.22, longitude: 121.47 },  // 上海
  ],
  padding: [80, 40, 80, 40],  // 上右下左边距（px）
})
```

---

## useShareAppMessage：分享功能

行册实现微信原生分享：

```tsx
// src/pages/trip/index.tsx
import { useShareAppMessage } from '@tarojs/taro'

useShareAppMessage((options) => {
  // 用户点「分享给朋友」时调用
  const kind = options.target?.dataset?.kind  // 从按钮的 dataset 读 kind
  const payload = shareRef.byKind[kind]

  return {
    title: `行册 · ${trip.name}`,
    path: `/pages/share/index?token=xxx&tripId=yyy`,
  }
})
```

---

## 编译流程

```bash
npm run dev:weapp
```

Taro 做了什么：

```
1. TypeScript 检查 → 确保类型正确
2. Babel 编译 → 把新语法转成旧语法（兼容旧手机）
3. 模块打包 → 把所有 import 的文件合并
4. JSX → WXML → 转成小程序的模板格式
5. SCSS → WXSS → 转成小程序的样式格式
6. 输出到 dist/ → 供开发者工具预览
```

---

## Taro vs React 的差异

用 Taro 写小程序和写 React 网页几乎一样，但有几点不同：

| 差异点 | React 网页 | Taro 小程序 |
|--------|-----------|------------|
| 基础容器 | `<div>` | `<View>` |
| 文字 | `<span>` | `<Text>` |
| 图片 | `<img>` | `<Image>` |
| 输入事件 | `e.target.value` | `e.detail.value` |
| 路由 | react-router | `Taro.navigateTo` |
| 样式单位 | `px`, `rem`, `em` | `rpx`（响应式像素）|
| 事件名 | `onClick` | `onClick`（一致） |
| 不支持 | - | `window`, `document`, `localStorage` |

---

## 小结

- Taro = React 的「翻译器」，让你用 React 写小程序
- 用 `<View>`, `<Text>`, `<ScrollView>` 等代替 HTML 标签
- 用 `Taro.navigateTo`, `Taro.showToast` 等调用小程序 API
- 用 `rpx` 单位来适配不同屏幕大小

**下一步**：[组件系统 →](./03-组件系统.md)
