# 分享卡片优化设计

## 背景

当前分享卡片只返回 `{ title, path }`，没有自定义图片（`imageUrl`），微信会自动截取页面缩略图。分享标题偏技术化（"只读分享 · xxx"），视觉辨识度低。

本次优化目标：
1. 动态生成 5:4 比例的分享卡片图片，通过 Canvas 渲染
2. 重写标题文案，使用社交化表达
3. 色块复用首页旅人精选的 `templateCoverColors` 生成方案

## 卡片图片设计（方案 D）

### 视觉结构

```
┌─────────────────────────────────┐
│  行迹                            │  ← 品牌名，左上角，半透明白
│                       ○          │  ← 装饰圆环（右上角，半透明）
│      ○                           │  ← 装饰圆环（左下角，半透明）
│  东 京                           │  ← 主目的地，左对齐，大字
│  ──                              │  ← 短分割线
│  6.19 → 6.25 · 5 天 · 2 人     │  ← 元信息，左对齐
└─────────────────────────────────┘
     渐变背景（140deg），颜色由目的地哈希决定
```

### 色块生成

复用 `TRAVEL_PALETTE`（12 色 HSL 色板）+ `djb2` 哈希，**不做季节微调**：

```typescript
// 输入：trip.destinations[0]?.name || trip.name
// 输出：[c1, c2] 渐变色对
function shareCardColors(trip: Trip): [string, string] {
  const key = trip.destinations[0]?.name || trip.name
  const h = djb2(key)
  const [baseH, baseS, baseL] = TRAVEL_PALETTE[h % TRAVEL_PALETTE.length]
  // 主色 + 偏移色（+18° 色相偏移）
  const h2 = (baseH + 18 + (h % 12)) % 360
  return [hsl(baseH, baseS, baseL), hsl(h2, Math.min(85, baseS + 8), Math.min(70, baseL + 12))]
}
```

**确定性**：同一目的地的攻略，分享卡片颜色永远一致。

### Canvas 渲染参数

| 元素 | 位置 | 字号/尺寸 | 颜色 |
|------|------|-----------|------|
| 品牌名 "行迹" | 左上 (48px, 40px) | 26px | rgba(255,255,255,0.7) |
| 装饰圆 1 | 右上 (偏出画布) | r=160px, border=40px | rgba(255,255,255,0.06) |
| 装饰圆 2 | 左下 (偏出画布) | r=200px, border=50px | rgba(255,255,255,0.04) |
| 主文字（目的地/攻略名） | 左对齐，垂直居中 | 80px bold | white |
| 分割线 | 主文字下方 28px | 48×4px | rgba(255,255,255,0.5) |
| 元信息 | 分割线下方 12px | 28px | rgba(255,255,255,0.8) |

画布尺寸：**500×400px**（5:4 比例）

## 标题设计

### 只读分享

```
送你一份「{name}」攻略
```

### 协作邀请

```
{ownerName} 邀请你一起规划「{name}」   // 有昵称时
一起来规划「{name}」吧                  // 无昵称 fallback
```

### 截断规则

- 标题中的 `name` 截断到 **14 字**，超出加 `…`
- 图片中大字（目的地名）截断到 **10 字**

## 边界情况

| 场景 | 处理方式 |
|------|---------|
| 目的地为空 | 大图文字显示 `trip.name`（截 10 字）；色块哈希 key 用 `trip.name` |
| 多个目的地 | 大图显示 `destinations[0].name · {N}城`（总数截 10 字） |
| 单日行程 | 元信息只显示 `{date} · {pax}人`，不显示天数 |
| pax = 1 | 元信息不显示人数，只显示 `{dateRange} · {days}天` |
| ownerNickname 为空 | 协作标题使用 fallback：`一起来规划「{name}」吧` |
| name 超长 | 标题截 14 字，大图截 10 字 |

## 数据流

```
用户点⋯→ 分享
  ↓
ShareTypeSheet 打开
  ↓
prepareShare('readonly') / prepareShare('collab')
  ├── buildShareMessage(tripId, tripName, kind)  → 生成 token
  ├── renderShareCard(trip)                       → Canvas 渲染 + canvasToTempFilePath
  └── shareRef.byKind[kind] = { title, path, imageUrl }
  ↓
ready[kind] = true → 按钮可用
  ↓
用户点 <Button open-type="share">
  ↓
useShareAppMessage 返回 { title, path, imageUrl }
```

### 时序保障

- Canvas 渲染在 `prepareShare` 阶段完成（用户已看到 "准备中..." loading）
- `canvasToTempFilePath` 返回的临时文件路径在分享弹出时仍有效
- `imageUrl` 写入 `shareRef.byKind[kind]`，`useShareAppMessage` 回调同步读取

## 涉及文件

| 文件 | 变更 |
|------|------|
| `src/utils/share.ts` | `SharePayload` 增加 `imageUrl?`；`buildShareMessage` 增加标题逻辑；`shareRef` 增加 `imageUrl` 字段 |
| `src/utils/share-card.ts`（新建） | `renderShareCard(trip)` Canvas 渲染函数 + `shareCardColors` 色块生成 |
| `src/pages/trip/index.tsx` | `prepareShare` 中增加 Canvas 渲染调用 |
| `src/pages/trip/index.tsx` | `useShareAppMessage` 返回增加 `imageUrl` |
| `src/components/ShareTypeSheet/index.tsx` | 可能需要隐藏 Canvas 元素 |

## 不做的事

- 不做 coverUrl 封面图接入（现有字段未使用，留待后续）
- 不做季节微调（Trip 没有 seasons 字段，过度设计）
- 不修改分享页面（`pages/share/index.tsx`）的视觉
- 不修改 `onShareTimeline`（分享到朋友圈）
