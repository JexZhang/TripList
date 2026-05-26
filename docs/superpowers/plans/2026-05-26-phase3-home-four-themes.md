# Phase 3 · 首页四主题 + 杂志封面 + AI 入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地首页四套独立版式（手帖堆叠 / 刊物封面 / 护照盖戳 / 极简清单），photoframe 默认封面 + 自定义上传（16:10 框），底部 CTA 方案 3（AI 强调 + 新建次级），首页 AI 卡内行替换为 HomeCardAIRow。

**Architecture:** `pages/home/index.tsx` 改为薄 dispatcher，按 `theme` 渲染 4 个子组件（`HomeTegami / HomeMagazine / HomePostcard / HomeMinimal`）。所有子组件共享：trip 数据列表、AvatarEntry、底部 CTA、长按 action sheet。封面图存 `trip.coverUrl`（fileID），缺省落回本地 `default-cover.jpg`。AI 入口动作统一跳 new-trip 页并 auto-open AIInterview。

**Tech Stack:** Taro 4.x React + TypeScript + SCSS + 微信云存储（`wx.cloud.uploadFile`）

**Spec:** [docs/superpowers/specs/2026-05-26-design-system-application-design.md](../specs/2026-05-26-design-system-application-design.md)（§ 7.1 首页版式矩阵、§ 8.3 自定义封面流、§ 8.4.1 home 入口 A）

**Prerequisite:** Phase 1 + Phase 2 已合并；`useThemeClass / useTheme / BrandLogo / AIBadge / AIInterview / HomeCardAIRow` 可用

**Testing reality:** 无单元测试框架；只发布微信小程序。冒烟全程用 `npm run dev:weapp` watch + 微信开发者工具，不跑 H5。每个 Task 末尾给微信开发者工具的人工验证步骤。

---

## File Structure

### 新增

| 路径 | 责任 |
| --- | --- |
| `src/assets/cover/default-cover.jpg` | 杂志封面默认图（设计稿 Unsplash 链接本地化，≤ 200KB，1600×1000） |
| `src/components/CoverPicker/index.tsx` | 弹底 sheet：拍照 / 相册 / 恢复默认，调 chooseMedia + 上传云存储 |
| `src/components/CoverPicker/index.scss` | 弹底 sheet 样式 |
| `src/components/MagFeatureCover/index.tsx` | 杂志主题首页 feature 卡的 photoframe 封面 |
| `src/components/MagFeatureCover/index.scss` | photoframe 构图样式 |
| `src/components/HomeBottomCTA/index.tsx` | 上 AI 强调 + 下 新建次级 |
| `src/components/HomeBottomCTA/index.scss` | 双按钮容器 |
| `src/pages/home/HomeTegami.tsx` | 手帖主题首页（明信片堆叠） |
| `src/pages/home/HomeMagazine.tsx` | 刊物主题首页（杂志封面 + 目录） |
| `src/pages/home/HomePostcard.tsx` | 护照主题首页（盖戳网格） |
| `src/pages/home/HomeMinimal.tsx` | 极简主题首页（行式清单） |
| `src/pages/home/styles/home-tegami.scss` | 手帖样式 |
| `src/pages/home/styles/home-magazine.scss` | 刊物样式 |
| `src/pages/home/styles/home-postcard.scss` | 护照样式 |
| `src/pages/home/styles/home-minimal.scss` | 极简样式 |
| `src/pages/home/shared.tsx` | 子组件共用 props 类型 + 工具（AI 卡片行、long press handler 等） |
| `src/utils/cover.ts` | 封面 URL 解析（fileID → temp URL）+ 默认图路径常量 |

### 修改

| 路径 | 改动 |
| --- | --- |
| `src/types/trip.ts` | `Trip` 接口加 `coverUrl?: string \| null` |
| `src/utils/db.ts` | `updateTrip` 已支持任意字段；无需改 |
| `cloudfunctions/update-trip/index.js` | 白名单加 `coverUrl` 字段 |
| `src/pages/home/index.tsx` | 改为 theme dispatcher；保留数据加载 / share / action sheet 逻辑 |
| `src/pages/home/index.scss` | 减薄为 dispatcher / 共用样式；4 主题样式拆到 styles/* |
| `src/pages/new-trip/index.tsx` | 接 `?openAI=1` query：进入后 auto-open AIInterview |
| `src/pages/new-trip/index.tsx` | 旧 `AIPlanForm` 暂保留；本 Phase 不删 |

### 不动

- Trip 详情页 / Itinerary / Budget / Packing / Map：Phase 4
- AILoadingBar / AIPlanForm：Phase 5 删

---

## Task 0: 前置基线检查

- [ ] **Step 1: 确认 Phase 1 + Phase 2 已合并**

Run:
```bash
cd /Users/jinchi/Documents/行册 && git status && git log --oneline -10
```
Expected: 工作树干净；近期 commits 含 Phase 1 (theme / me / AvatarEntry) + Phase 2 (BrandLogo / AIBadge / AIInterview / Theater / StatusBar / HomeCardAIRow / ProfileForm)

- [ ] **Step 2: 确认共享组件可用**

Run:
```bash
ls src/components/BrandLogo src/components/AIBadge src/components/AIInterview src/components/HomeCardAIRow
```
Expected: 4 个目录都存在 + 含 `index.tsx`

- [ ] **Step 3: 启动 weapp dev**

Run: `npm run dev:weapp`（保持 watch 运行，后续 Task 复用）
微信开发者工具 → 编译 → 首页正常 → 我的页可切四主题。

---

## Task 1: Trip 类型加 coverUrl + 后端白名单

**Files:**
- Modify: `src/types/trip.ts`
- Modify: `cloudfunctions/update-trip/index.js`

- [ ] **Step 1: 改 Trip 接口**

Edit `src/types/trip.ts`，在 `Trip` 接口的 `aiError?` 之后加：

```typescript
  // === 封面图（杂志主题用，其他主题忽略）===
  coverUrl?: string | null
```

- [ ] **Step 2: 后端白名单**

Edit `cloudfunctions/update-trip/index.js`：

找到允许的字段列表（关键字搜 `aiTaskId` 附近的 allowed fields），把 `'coverUrl'` 加入白名单。如果用的是 `pick / allow` 之类的数组，扩展即可：

```js
const ALLOWED_FIELDS = [
  'name', 'pax', 'startDate', 'endDate', 'destinations',
  'days', 'packing', 'collaborators',
  'aiTaskId', 'aiStatus', 'aiDraft', 'aiError',
  'coverUrl',
]
```

> 若 update-trip 用动态 spread 而无白名单，本 Step 跳过；并在 commit message 注明 "update-trip 无白名单，coverUrl 直通"。

- [ ] **Step 3: 部署 update-trip**

微信开发者工具 → 云开发 → 云函数 → `update-trip` → 右键「上传并部署」。

> 若 Step 2 已跳过则本 Step 也跳过。

- [ ] **Step 4: 类型检查**

Run: `npx tsc --noEmit 2>&1 | tail -10`
Expected: 无新报错

- [ ] **Step 5: Commit**

```bash
git add src/types/trip.ts cloudfunctions/update-trip/index.js 2>/dev/null
git commit -m "feat(trip): Trip 类型加 coverUrl + update-trip 白名单"
```

---

## Task 2: 默认封面资源

**Files:**
- Create: `src/assets/cover/default-cover.jpg`
- Create: `src/utils/cover.ts`

- [ ] **Step 1: 下载并优化默认封面图**

设计稿用的是 `https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=900&h=560&fit=crop&q=85`。

执行（mac，需要 curl + 可选 jpegoptim）：

```bash
mkdir -p src/assets/cover
curl -L "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=1600&h=1000&fit=crop&q=82" -o src/assets/cover/default-cover.jpg
ls -lh src/assets/cover/default-cover.jpg
```

Expected: 文件存在，体积 ≤ 250KB；若超出，用 `sips -s formatOptions 70 ... ` 或 jpegoptim 进一步压缩。

- [ ] **Step 2: 创建 cover 工具**

Create `src/utils/cover.ts`：

```typescript
import Taro from '@tarojs/taro'

/** 默认封面：所有 trip 未自定义时使用 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const DEFAULT_COVER = require('../assets/cover/default-cover.jpg')

/** Taro require 返回的是 string（H5）或经过编译的 ./assets/... 路径（weapp） */

interface ResolveOptions {
  /** 缺省时返回 DEFAULT_COVER */
  fallback?: string
}

/**
 * 把 trip.coverUrl 解析为可在 <Image src=> 直接消费的字符串：
 * - null / undefined / '' → fallback（默认图）
 * - 以 'cloud://' 开头 → 在小程序端，<Image> 直接支持 cloud:// 协议；H5 端需要 getTempFileURL
 *   本项目仅小程序，直接返回即可
 * - 其他 https:// 链接 → 原样返回
 */
export function resolveCoverUrl(
  coverUrl: string | null | undefined,
  opts: ResolveOptions = {},
): string {
  const fallback = opts.fallback || DEFAULT_COVER
  if (!coverUrl) return fallback
  return coverUrl
}

/** 上传本地图到云存储，返回 fileID */
export async function uploadCover(localPath: string, openid: string): Promise<string> {
  const ts = Date.now()
  const cloudPath = `covers/${openid}/${ts}.jpg`
  // @ts-ignore Taro.cloud.uploadFile
  const r = await Taro.cloud.uploadFile({
    cloudPath,
    filePath: localPath,
  })
  return (r as { fileID: string }).fileID
}
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit 2>&1 | grep -E "cover" | head -10`
Expected: 无报错

- [ ] **Step 4: Commit**

```bash
git add src/assets/cover src/utils/cover.ts
git commit -m "feat(cover): 默认封面图 + cover URL 工具"
```

---

## Task 3: CoverPicker 组件

**Files:**
- Create: `src/components/CoverPicker/index.tsx`
- Create: `src/components/CoverPicker/index.scss`

> 说明：小程序无内置定比例裁剪 UI。本 Phase MVP：
>   - 用 `wx.chooseMedia` 选图
>   - 上传云存储
>   - 显示用 CSS `aspect-ratio: 16/10 + object-fit: cover` 视觉裁剪
>   - 不做交互式拖动裁剪框
> 后续如需真裁剪，单独立 spike。

- [ ] **Step 1: 创建组件**

Create `src/components/CoverPicker/index.tsx`：

```typescript
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { uploadCover } from '../../utils/cover'
import './index.scss'

interface Props {
  open: boolean
  openid: string
  /** 用户确认上传后，父组件接收新的 cloud fileID（或 null = 恢复默认） */
  onPicked: (fileIDOrNull: string | null) => void
  onClose: () => void
}

export default function CoverPicker({ open, openid, onPicked, onClose }: Props) {
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const choose = async (source: 'camera' | 'album') => {
    if (busy) return
    setBusy(true)
    try {
      // @ts-ignore Taro.chooseMedia
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: [source],
        sizeType: ['compressed'],
      })
      const file = res.tempFiles?.[0]
      if (!file?.tempFilePath) throw new Error('no file')
      Taro.showLoading({ title: '上传中…' })
      const fileID = await uploadCover(file.tempFilePath, openid)
      Taro.hideLoading()
      Taro.showToast({ title: '已更新封面', icon: 'success' })
      onPicked(fileID)
    } catch (e) {
      Taro.hideLoading()
      const msg = (e as { errMsg?: string })?.errMsg || ''
      if (!msg.includes('cancel')) {
        console.error('[CoverPicker]', e)
        Taro.showToast({ title: '上传失败', icon: 'none' })
      }
    } finally {
      setBusy(false)
    }
  }

  const restoreDefault = () => {
    onPicked(null)
    Taro.showToast({ title: '已恢复默认封面', icon: 'success' })
  }

  return (
    <View className='cp-mask theme-tokens' onClick={onClose}>
      <View className='cp-sheet' onClick={(e) => e.stopPropagation()}>
        <Text className='cp-title'>更换封面</Text>
        <Text className='cp-sub'>16:10 比例展示，建议横构图</Text>
        <View className='cp-actions'>
          <View className='cp-action' onClick={() => choose('camera')}>
            <Text className='cp-action-emoji'>📷</Text>
            <Text>拍照</Text>
          </View>
          <View className='cp-action' onClick={() => choose('album')}>
            <Text className='cp-action-emoji'>🖼️</Text>
            <Text>从相册选</Text>
          </View>
          <View className='cp-action cp-action--text' onClick={restoreDefault}>
            <Text className='cp-action-emoji'>↺</Text>
            <Text>恢复默认</Text>
          </View>
        </View>
        <View className='cp-cancel' onClick={onClose}>取消</View>
      </View>
    </View>
  )
}
```

- [ ] **Step 2: 创建样式**

Create `src/components/CoverPicker/index.scss`：

```scss
.cp-mask {
  position: fixed; inset: 0;
  background: rgba(20, 12, 8, 0.5);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  animation: fade-in 0.22s var(--ease-out) both;
}
.cp-sheet {
  width: 100%;
  background: var(--surface);
  border-radius: var(--r-xl) var(--r-xl) 0 0;
  padding: 32rpx 32rpx 48rpx;
  box-sizing: border-box;
  animation: sheet-up 0.36s var(--ease-spring) both;
}
.cp-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--ink);
  text-align: center;
  margin-bottom: 8rpx;
}
.cp-sub {
  display: block;
  font-size: 22rpx;
  color: var(--ink-3);
  text-align: center;
  margin-bottom: 32rpx;
}
.cp-actions {
  display: flex;
  gap: 16rpx;
}
.cp-action {
  flex: 1;
  padding: 32rpx 16rpx;
  background: var(--surface-2);
  border-radius: var(--r-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  font-size: 26rpx;
  color: var(--ink-2);
  transition: transform 0.18s var(--ease-out);
}
.cp-action:active { transform: scale(0.96); }
.cp-action-emoji {
  font-size: 40rpx;
}
.cp-cancel {
  margin-top: 32rpx;
  padding: 20rpx 0;
  text-align: center;
  background: var(--surface-2);
  border-radius: var(--r-md);
  font-size: 28rpx;
  color: var(--ink-2);
}
.cp-cancel:active { opacity: 0.85; }
```

- [ ] **Step 3: 编译验证**

观察 watch 窗口
Expected: 编译成功，无类型报错

- [ ] **Step 4: Commit**

```bash
git add src/components/CoverPicker
git commit -m "feat(cover): CoverPicker 选图 + 上传弹底 sheet"
```

---

## Task 4: MagFeatureCover 组件

**Files:**
- Create: `src/components/MagFeatureCover/index.tsx`
- Create: `src/components/MagFeatureCover/index.scss`

- [ ] **Step 1: 创建组件**

Create `src/components/MagFeatureCover/index.tsx`：

```typescript
import { View, Text, Image } from '@tarojs/components'
import { resolveCoverUrl } from '../../utils/cover'
import type { Trip } from '../../types/trip'
import './index.scss'

interface Props {
  trip: Trip
  /** 长按 → 触发更换封面流（父组件控制 CoverPicker open） */
  onLongPress?: () => void
}

export default function MagFeatureCover({ trip, onLongPress }: Props) {
  const src = resolveCoverUrl(trip.coverUrl)
  const days = computeDays(trip.startDate, trip.endDate)
  const destFull = (trip.destinations || []).map((d) => d.name).join(' · ')

  return (
    <View className='mfc' onLongPress={onLongPress}>
      <View className='mfc-frame'>
        <Image
          className='mfc-img'
          src={src}
          mode='aspectFill'
        />
        <View className='mfc-grain' />
        <View className='mfc-overlay'>
          <View className='mfc-tl'>
            <Text className='mfc-issue'>VOL. {String(trip.pax || 1).padStart(3, '0')} / SPRING</Text>
            <Text className='mfc-edition'>2026</Text>
          </View>
          <View className='mfc-tr'>
            <View className='mfc-barcode'>
              {Array.from({ length: 24 }).map((_, i) => (
                <View
                  key={i}
                  className='mfc-barcode-bar'
                  style={{ width: `${2 + (i % 4) * 2}rpx` }}
                />
              ))}
            </View>
            <Text className='mfc-price'>¥ 0 · MMXXVI</Text>
          </View>
          <View className='mfc-bl'>
            <Text className='mfc-kicker'>FEATURE</Text>
            <Text className='mfc-headline'>{destFull || trip.name}</Text>
            <Text className='mfc-deck'>{days} DAYS · {trip.pax} TRAVELERS</Text>
          </View>
          <View className='mfc-br'>
            <Text className='mfc-replace'>长按更换</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

function computeDays(start: string, end: string): number {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  return Math.max(1, Math.round((e - s) / 86400000) + 1)
}
```

- [ ] **Step 2: 创建样式**

Create `src/components/MagFeatureCover/index.scss`：

```scss
.mfc {
  width: 100%;
}
.mfc-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: var(--bg-deep);
}
.mfc-img {
  width: 100%;
  height: 100%;
}
.mfc-grain {
  position: absolute; inset: 0;
  background:
    radial-gradient(circle at 25% 35%, rgba(0,0,0,0.04) 0 1rpx, transparent 2rpx) 0 0/8rpx 8rpx,
    radial-gradient(circle at 67% 73%, rgba(0,0,0,0.03) 0 1rpx, transparent 2rpx) 0 0/14rpx 14rpx;
  pointer-events: none;
  mix-blend-mode: multiply;
}
.mfc-overlay {
  position: absolute; inset: 0;
  padding: 20rpx 24rpx;
  pointer-events: none;
  color: #fff;
  text-shadow: 0 2rpx 6rpx rgba(0,0,0,0.4);
}
.mfc-tl, .mfc-tr, .mfc-bl, .mfc-br {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.mfc-tl { top: 20rpx; left: 24rpx; }
.mfc-tr { top: 20rpx; right: 24rpx; align-items: flex-end; }
.mfc-bl { bottom: 20rpx; left: 24rpx; max-width: 70%; }
.mfc-br { bottom: 20rpx; right: 24rpx; }

.mfc-issue {
  font-size: 20rpx;
  letter-spacing: 4rpx;
  font-family: var(--font-display);
  font-weight: 700;
}
.mfc-edition {
  font-size: 16rpx;
  letter-spacing: 6rpx;
  opacity: 0.85;
  font-family: var(--font-mono);
}

.mfc-barcode {
  display: flex;
  align-items: flex-end;
  gap: 2rpx;
  height: 28rpx;
  margin-bottom: 6rpx;
}
.mfc-barcode-bar {
  height: 100%;
  background: #fff;
  opacity: 0.9;
}
.mfc-price {
  font-size: 16rpx;
  font-family: var(--font-mono);
  letter-spacing: 2rpx;
}

.mfc-kicker {
  font-size: 18rpx;
  letter-spacing: 6rpx;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--accent);
  background: rgba(255,255,255,0.18);
  padding: 4rpx 12rpx;
  align-self: flex-start;
}
.mfc-headline {
  font-size: 44rpx;
  font-weight: 900;
  font-family: var(--font-display);
  letter-spacing: 2rpx;
  line-height: 1.1;
}
.mfc-deck {
  font-size: 20rpx;
  letter-spacing: 3rpx;
  font-family: var(--font-mono);
  opacity: 0.9;
}

.mfc-replace {
  font-size: 18rpx;
  letter-spacing: 2rpx;
  padding: 4rpx 12rpx;
  background: rgba(255,255,255,0.18);
  border-radius: var(--r-pill);
}
```

- [ ] **Step 3: 编译验证**

watch 自动重编
Expected: 编译成功

- [ ] **Step 4: Commit**

```bash
git add src/components/MagFeatureCover
git commit -m "feat(cover): MagFeatureCover photoframe 杂志封面"
```

---

## Task 5: HomeBottomCTA（方案 3）

**Files:**
- Create: `src/components/HomeBottomCTA/index.tsx`
- Create: `src/components/HomeBottomCTA/index.scss`

- [ ] **Step 1: 创建组件**

Create `src/components/HomeBottomCTA/index.tsx`：

```typescript
import { View, Text } from '@tarojs/components'
import AIBadge from '../AIBadge'
import './index.scss'

interface Props {
  onAITap: () => void
  onNewTap: () => void
  /** 各主题用自己的"新建"文案，比如"新建明信片 / 发起新刊 / 新一页签证 / 新建" */
  newLabel?: string
}

export default function HomeBottomCTA({ onAITap, onNewTap, newLabel = '+ 新建攻略' }: Props) {
  return (
    <View className='hcta'>
      <AIBadge status='idle' size='lg' label='让 AI 帮你规划' onClick={onAITap} />
      <View className='hcta-new' onClick={onNewTap}>
        <Text>{newLabel}</Text>
      </View>
    </View>
  )
}
```

- [ ] **Step 2: 创建样式**

Create `src/components/HomeBottomCTA/index.scss`：

```scss
.hcta {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  width: 100%;
}
.hcta-new {
  width: 100%;
  padding: 22rpx 0;
  text-align: center;
  font-size: 28rpx;
  font-weight: 600;
  letter-spacing: 4rpx;
  color: var(--ink-2);
  background: transparent;
  border: 2rpx solid var(--line-2);
  border-radius: var(--r-pill);
  transition: transform 0.18s var(--ease-out), background 0.18s var(--ease-out);
}
.hcta-new:active {
  transform: scale(0.97);
  background: var(--accent-bg);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/HomeBottomCTA
git commit -m "feat(home): HomeBottomCTA 上 AI 强调 + 下 新建次级"
```

---

## Task 6: 子组件共享类型

**Files:**
- Create: `src/pages/home/shared.tsx`

- [ ] **Step 1: 创建共享 props**

Create `src/pages/home/shared.tsx`：

```typescript
import type { Trip } from '../../types/trip'

/** 4 主题子组件共用的 props */
export interface HomeViewProps {
  trips: Trip[]
  loading: boolean
  openid: string
  onOpenTrip: (trip: Trip) => void
  onLongPressTrip: (trip: Trip) => void
  onNewTrip: () => void
  onAITrip: () => void
  /** featureTrip 由父组件挑选（杂志主题），其他主题忽略 */
  featureTrip?: Trip
  onCoverLongPress?: (trip: Trip) => void
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/home/shared.tsx
git commit -m "feat(home): 4 主题子组件共用 props 类型"
```

---

## Task 7: HomeTegami 子组件

**Files:**
- Create: `src/pages/home/HomeTegami.tsx`
- Create: `src/pages/home/styles/home-tegami.scss`

- [ ] **Step 1: 创建组件**

Create `src/pages/home/HomeTegami.tsx`：

```typescript
import { View, Text } from '@tarojs/components'
import { useMemo } from 'react'
import BrandLogo from '../../components/BrandLogo'
import AvatarEntry from '../../components/AvatarEntry'
import HomeBottomCTA from '../../components/HomeBottomCTA'
import HomeCardAIRow from '../../components/HomeCardAIRow'
import { isSeedTripId } from '../../data/seed-trips'
import { fmtDateShort } from '../../utils/format'
import { tripSummary } from '../../utils/trip-helpers'
import type { HomeViewProps } from './shared'
import type { Trip } from '../../types/trip'
import './styles/home-tegami.scss'

const COLORS: ReadonlyArray<[string, string]> = [
  ['#FF7A2E', '#FF9A4D'],
  ['#6B46C1', '#FF5B5B'],
  ['#4FB286', '#FFC247'],
  ['#FFC247', '#FF7A2E'],
]

function aiStatusFor(t: Trip): 'thinking' | 'ready' | 'error' | null {
  if (t.aiStatus === 'generating') return 'thinking'
  if (t.aiStatus === 'ready') return 'ready'
  if (t.aiStatus === 'error') return 'error'
  return null
}

export default function HomeTegami({
  trips, loading, openid, onOpenTrip, onLongPressTrip, onNewTrip, onAITrip,
}: HomeViewProps) {
  const sized = useMemo(() => trips.map((t, i) => ({
    ...t,
    _c1: COLORS[i % COLORS.length][0],
    _c2: COLORS[i % COLORS.length][1],
  })), [trips])

  return (
    <View className='ht'>
      <View className='ht-head'>
        <View className='ht-issue'>行册 · No. 012 · 2026 春</View>
        <View className='ht-head-row'>
          <BrandLogo size='lg' />
          <AvatarEntry className='ht-avatar' />
        </View>
        <Text className='ht-tag'>你的旅行，值得被好好记录</Text>
      </View>

      {loading && <View className='ht-loading'>加载中…</View>}

      <View className='ht-stack'>
        {sized.map((t, i) => {
          const ai = aiStatusFor(t)
          const isCollab = t._openid !== openid && !isSeedTripId(t._id)
          const isSeed = isSeedTripId(t._id)
          return (
            <View
              key={t._id}
              className={`ht-card ht-card-${i % 5}`}
              onClick={() => onOpenTrip(t)}
              onLongPress={() => onLongPressTrip(t)}
              style={{
                '--c1': t._c1, '--c2': t._c2,
                animationDelay: `${i * 80}ms`,
              } as React.CSSProperties}
            >
              <View className='ht-card-edge' />
              <View className='ht-card-body'>
                {ai && <HomeCardAIRow status={ai} />}
                <Text className='ht-card-meta'>
                  {fmtDateShort(t.startDate)} → {fmtDateShort(t.endDate)} · {tripSummary(t.startDate, t.endDate, t.pax)}
                </Text>
                <Text className='ht-card-name'>{t.name}</Text>
                <View className='ht-card-foot'>
                  {isSeed && <View className='ht-card-badge ht-card-badge-seed'>示例</View>}
                  {isCollab && <View className='ht-card-badge'>协作</View>}
                </View>
              </View>
            </View>
          )
        })}
      </View>

      <View className='ht-cta'>
        <HomeBottomCTA onAITap={onAITrip} onNewTap={onNewTrip} newLabel='+ 新建明信片' />
      </View>
    </View>
  )
}
```

- [ ] **Step 2: 创建样式**

Create `src/pages/home/styles/home-tegami.scss`：

```scss
.ht {
  min-height: 100vh;
  padding: 32rpx 32rpx 320rpx;
  box-sizing: border-box;
  background:
    radial-gradient(120% 60% at 100% 0%, rgba(255, 154, 77, 0.22) 0%, transparent 55%),
    radial-gradient(80% 40% at 0% 10%, rgba(255, 194, 71, 0.18) 0%, transparent 60%),
    var(--bg);
  animation: page-in 0.42s var(--ease-out) both;
}

.ht-head {
  padding: 16rpx 8rpx 32rpx;
  animation: slide-up 0.5s var(--ease-out) both;
}
.ht-issue {
  font-size: 22rpx;
  color: var(--ink-3);
  letter-spacing: 4rpx;
  font-family: var(--font-mono);
  margin-bottom: 16rpx;
}
.ht-head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.ht-avatar { margin-top: 12rpx; }
.ht-tag {
  display: block;
  margin-top: 14rpx;
  font-size: 24rpx;
  color: var(--ink-3);
  letter-spacing: 3rpx;
  font-family: var(--font-display);
}

.ht-loading {
  text-align: center;
  font-size: 26rpx;
  color: var(--ink-3);
  padding: 80rpx 0;
}

.ht-stack {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 24rpx;
}

.ht-card {
  margin-top: -40rpx;
  background: var(--surface);
  border-radius: var(--r-lg);
  padding: 28rpx 28rpx 28rpx 40rpx;
  box-shadow: var(--shadow-md);
  position: relative;
  overflow: hidden;
  animation: slide-up 0.5s var(--ease-out) both;
  transition: transform 0.22s var(--ease-out);
}
.ht-card:first-child { margin-top: 0; }
.ht-card-0 { transform: rotate(-0.6deg); }
.ht-card-1 { transform: rotate(0.4deg); }
.ht-card-2 { transform: rotate(-0.3deg); }
.ht-card-3 { transform: rotate(0.6deg); }
.ht-card-4 { transform: rotate(-0.4deg); }
.ht-card:active {
  transform: rotate(0deg) scale(0.985);
  box-shadow: var(--shadow-lg);
}

.ht-card-edge {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 12rpx;
  background: linear-gradient(180deg, var(--c1), var(--c2));
}

.ht-card-body { position: relative; }
.ht-card-meta {
  font-size: 22rpx;
  color: var(--ink-3);
  font-family: var(--font-mono);
  letter-spacing: 1rpx;
}
.ht-card-name {
  display: block;
  margin-top: 8rpx;
  font-size: 38rpx;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--ink);
  letter-spacing: 1rpx;
}

.ht-card-foot {
  margin-top: 16rpx;
  display: flex;
  gap: 12rpx;
}
.ht-card-badge {
  padding: 4rpx 14rpx;
  border-radius: var(--r-pill);
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  background: linear-gradient(135deg, var(--accent), var(--coral));
  color: #fff;
}
.ht-card-badge-seed {
  background: linear-gradient(135deg, var(--sun), var(--accent));
}

.ht-cta {
  position: fixed;
  left: 32rpx; right: 32rpx;
  bottom: 48rpx;
  z-index: 10;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/home/HomeTegami.tsx src/pages/home/styles/home-tegami.scss
git commit -m "feat(home): HomeTegami 明信片堆叠首页"
```

---

## Task 8: HomeMagazine 子组件

**Files:**
- Create: `src/pages/home/HomeMagazine.tsx`
- Create: `src/pages/home/styles/home-magazine.scss`

- [ ] **Step 1: 创建组件**

Create `src/pages/home/HomeMagazine.tsx`：

```typescript
import { View, Text } from '@tarojs/components'
import BrandLogo from '../../components/BrandLogo'
import AvatarEntry from '../../components/AvatarEntry'
import HomeBottomCTA from '../../components/HomeBottomCTA'
import HomeCardAIRow from '../../components/HomeCardAIRow'
import MagFeatureCover from '../../components/MagFeatureCover'
import type { HomeViewProps } from './shared'
import type { Trip } from '../../types/trip'
import './styles/home-magazine.scss'

function aiStatusFor(t: Trip): 'thinking' | 'ready' | 'error' | null {
  if (t.aiStatus === 'generating') return 'thinking'
  if (t.aiStatus === 'ready') return 'ready'
  if (t.aiStatus === 'error') return 'error'
  return null
}

export default function HomeMagazine({
  trips, loading, openid, onOpenTrip, onLongPressTrip,
  onNewTrip, onAITrip, onCoverLongPress,
}: HomeViewProps) {
  const featured = trips[0]
  const rest = trips.slice(1)
  const featAI = featured ? aiStatusFor(featured) : null
  const destFull = featured?.destinations?.map((d) => d.name).join(' · ') || ''
  const days = featured ? computeDays(featured.startDate, featured.endDate) : 0

  return (
    <View className='hm'>
      <View className='hm-masthead'>
        <View className='hm-top'>
          <Text className='hm-issueno'>VOL. 012</Text>
          <AvatarEntry className='hm-avatar' />
        </View>
        <View className='hm-title-row'>
          <BrandLogo size='lg' />
          <View className='hm-meta-stack'>
            <Text className='hm-meta'>2026 · 春</Text>
            <Text className='hm-meta'>{trips.length} 段旅程</Text>
          </View>
        </View>
        <View className='hm-rule' />
        <Text className='hm-strap'>EDITORIAL · TRAVEL · PERSONAL</Text>
      </View>

      {loading && <View className='hm-loading'>加载中…</View>}

      {featured && (
        <View
          className='hm-feature'
          onClick={() => onOpenTrip(featured)}
          onLongPress={() => onLongPressTrip(featured)}
        >
          {featAI && <HomeCardAIRow status={featAI} />}
          <Text className='hm-feature-tag'>本期封面 / COVER STORY</Text>
          <Text className='hm-feature-title'>{featured.name}</Text>
          <Text className='hm-feature-deck'>
            {destFull} · {featured.pax} 人 · {days} 天行程
          </Text>
          <MagFeatureCover
            trip={featured}
            onLongPress={() => onCoverLongPress?.(featured)}
          />
          <View className='hm-feature-foot'>
            <Text>P. 01 — P. 28</Text>
            <Text>→ 翻开</Text>
          </View>
        </View>
      )}

      {rest.length > 0 && (
        <View className='hm-index'>
          <View className='hm-index-head'>
            <Text>本期目录</Text>
            <Text>INDEX</Text>
          </View>
          {rest.map((t, i) => (
            <View
              key={t._id}
              className='hm-index-row'
              onClick={() => onOpenTrip(t)}
              onLongPress={() => onLongPressTrip(t)}
            >
              <Text className='hm-index-no'>P. {String(i + 2).padStart(2, '0')}</Text>
              <Text className='hm-index-name'>{t.name}</Text>
              <View className='hm-index-dots' />
              <Text className='hm-index-date'>{t.startDate.slice(0, 7)}</Text>
            </View>
          ))}
        </View>
      )}

      <View className='hm-cta'>
        <HomeBottomCTA onAITap={onAITrip} onNewTap={onNewTrip} newLabel='+ 发起新刊' />
      </View>
    </View>
  )
}

function computeDays(s: string, e: string): number {
  return Math.max(1, Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000) + 1)
}
```

- [ ] **Step 2: 创建样式**

Create `src/pages/home/styles/home-magazine.scss`：

```scss
.hm {
  min-height: 100vh;
  padding: 32rpx 32rpx 320rpx;
  box-sizing: border-box;
  background: var(--bg);
  animation: page-in 0.42s var(--ease-out) both;
}

/* —— masthead —— */
.hm-masthead { padding-top: 8rpx; }
.hm-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.hm-issueno {
  font-size: 22rpx;
  font-weight: 700;
  font-family: var(--font-mono);
  letter-spacing: 6rpx;
  color: var(--ink);
}
.hm-title-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 32rpx;
}
.hm-meta-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
}
.hm-meta {
  font-size: 20rpx;
  font-family: var(--font-mono);
  color: var(--ink-3);
  letter-spacing: 2rpx;
}
.hm-rule {
  height: 4rpx;
  background: var(--ink);
  margin: 24rpx 0 12rpx;
}
.hm-strap {
  font-size: 18rpx;
  letter-spacing: 8rpx;
  font-family: var(--font-display);
  color: var(--ink-2);
  text-align: center;
  padding-bottom: 32rpx;
  border-bottom: 1rpx solid var(--line);
}

.hm-loading {
  text-align: center;
  font-size: 26rpx;
  color: var(--ink-3);
  padding: 80rpx 0;
}

/* —— Feature —— */
.hm-feature {
  margin-top: 36rpx;
  padding-bottom: 32rpx;
  border-bottom: 4rpx double var(--ink);
  animation: slide-up 0.5s var(--ease-out) both;
}
.hm-feature-tag {
  display: block;
  font-size: 20rpx;
  letter-spacing: 6rpx;
  font-family: var(--font-display);
  color: var(--accent);
  margin-bottom: 12rpx;
}
.hm-feature-title {
  display: block;
  font-size: 60rpx;
  font-weight: 900;
  font-family: var(--font-display);
  line-height: 1.05;
  color: var(--ink);
  margin-bottom: 16rpx;
}
.hm-feature-deck {
  display: block;
  font-size: 24rpx;
  color: var(--ink-2);
  margin-bottom: 24rpx;
  line-height: 1.5;
}
.hm-feature-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 20rpx;
  font-size: 22rpx;
  font-family: var(--font-mono);
  color: var(--ink-2);
  letter-spacing: 2rpx;
}

/* —— Index —— */
.hm-index { margin-top: 32rpx; }
.hm-index-head {
  display: flex;
  justify-content: space-between;
  font-size: 22rpx;
  font-family: var(--font-display);
  letter-spacing: 4rpx;
  color: var(--ink-3);
  padding-bottom: 12rpx;
  border-bottom: 1rpx solid var(--line);
  margin-bottom: 16rpx;
}
.hm-index-row {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--line);
}
.hm-index-no {
  font-size: 22rpx;
  font-family: var(--font-mono);
  color: var(--ink-3);
  letter-spacing: 2rpx;
}
.hm-index-name {
  flex: 0 1 auto;
  font-size: 28rpx;
  font-family: var(--font-display);
  color: var(--ink);
}
.hm-index-dots {
  flex: 1;
  border-bottom: 2rpx dotted var(--ink-3);
  align-self: center;
  margin: 0 12rpx;
}
.hm-index-date {
  font-size: 22rpx;
  font-family: var(--font-mono);
  color: var(--ink-2);
}

.hm-cta {
  position: fixed;
  left: 32rpx; right: 32rpx;
  bottom: 48rpx;
  z-index: 10;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/home/HomeMagazine.tsx src/pages/home/styles/home-magazine.scss
git commit -m "feat(home): HomeMagazine 杂志封面 + 目录"
```

---

## Task 9: HomePostcard 子组件

**Files:**
- Create: `src/pages/home/HomePostcard.tsx`
- Create: `src/pages/home/styles/home-postcard.scss`

- [ ] **Step 1: 创建组件**

Create `src/pages/home/HomePostcard.tsx`：

```typescript
import { View, Text } from '@tarojs/components'
import { useMemo } from 'react'
import BrandLogo from '../../components/BrandLogo'
import AvatarEntry from '../../components/AvatarEntry'
import HomeBottomCTA from '../../components/HomeBottomCTA'
import HomeCardAIRow from '../../components/HomeCardAIRow'
import type { HomeViewProps } from './shared'
import type { Trip } from '../../types/trip'
import './styles/home-postcard.scss'

function aiStatusFor(t: Trip): 'thinking' | 'ready' | 'error' | null {
  if (t.aiStatus === 'generating') return 'thinking'
  if (t.aiStatus === 'ready') return 'ready'
  if (t.aiStatus === 'error') return 'error'
  return null
}

function tripDays(t: Trip): number {
  return Math.max(1, Math.round((new Date(t.endDate).getTime() - new Date(t.startDate).getTime()) / 86400000) + 1)
}

export default function HomePostcard({
  trips, loading, openid, onOpenTrip, onLongPressTrip, onNewTrip, onAITrip,
}: HomeViewProps) {
  const sized = useMemo(() => trips.map((t) => {
    const d = tripDays(t)
    return { ...t, _scale: Math.min(1.0, Math.max(0.62, 0.5 + d * 0.06)), _days: d }
  }), [trips])

  const totalDays = sized.reduce((s, t) => s + t._days, 0)

  return (
    <View className='hpp'>
      <View className='hpp-cover'>
        <View className='hpp-cover-top'>
          <Text className='hpp-cover-lab'>XING CE · PASSPORT</Text>
          <AvatarEntry className='hpp-avatar' />
        </View>
        <BrandLogo size='lg' />
        <View className='hpp-cover-no'>
          <Text>No. XC · 2026 · 0012</Text>
          <Text>· {trips.length} VISAS</Text>
        </View>
      </View>

      {loading && <View className='hpp-loading'>加载中…</View>}

      <View className='hpp-page'>
        <View className='hpp-page-head'>
          <Text className='hpp-page-l'>VISA / 签 证 · 已盖 {trips.length} 枚</Text>
          <Text className='hpp-page-r'>{totalDays} 天</Text>
        </View>

        <View className='hpp-stamps'>
          {sized.map((t, i) => {
            const ai = aiStatusFor(t)
            const destFull = t.destinations.map((d) => d.name).join(' ')
            const size = 184 * t._scale
            return (
              <View
                key={t._id}
                className='hpp-stamp'
                onClick={() => onOpenTrip(t)}
                onLongPress={() => onLongPressTrip(t)}
                style={{
                  width: `${size}rpx`,
                  height: `${size}rpx`,
                  animationDelay: `${i * 60}ms`,
                } as React.CSSProperties}
              >
                <Text className='hpp-stamp-name'>{destFull || t.name}</Text>
                <View className='hpp-stamp-divider' />
                <Text className='hpp-stamp-date'>{t.startDate.slice(0, 7).replace('-', '.')}</Text>
                <Text className='hpp-stamp-days'>{t._days} DAYS · {t.pax}P</Text>
                {ai === 'thinking' && <View className='hpp-stamp-aiglow' />}
                {ai === 'ready' && <View className='hpp-stamp-airready'>AI</View>}
              </View>
            )
          })}
        </View>

        <Text className='hpp-watermark'>行册</Text>
      </View>

      <View className='hpp-cta'>
        <HomeBottomCTA onAITap={onAITrip} onNewTap={onNewTrip} newLabel='+ 新一页签证' />
      </View>
    </View>
  )
}
```

- [ ] **Step 2: 创建样式**

Create `src/pages/home/styles/home-postcard.scss`：

```scss
.hpp {
  min-height: 100vh;
  padding: 32rpx 32rpx 320rpx;
  box-sizing: border-box;
  background:
    repeating-linear-gradient(45deg, transparent 0 32rpx, rgba(43,31,14,0.035) 32rpx 34rpx),
    repeating-linear-gradient(-45deg, transparent 0 32rpx, rgba(43,31,14,0.025) 32rpx 34rpx),
    linear-gradient(165deg, var(--bg) 0%, var(--bg-deep) 100%);
  animation: page-in 0.42s var(--ease-out) both;
}

.hpp-cover {
  padding: 16rpx 8rpx 32rpx;
  text-align: center;
  border-bottom: 4rpx double var(--line-2);
  animation: slide-up 0.5s var(--ease-out) both;
}
.hpp-cover-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}
.hpp-cover-lab {
  font-size: 22rpx;
  letter-spacing: 6rpx;
  font-family: var(--font-mono);
  color: var(--ink-2);
}
.hpp-cover-no {
  margin-top: 16rpx;
  display: flex;
  justify-content: center;
  gap: 8rpx;
  font-size: 22rpx;
  font-family: var(--font-mono);
  color: var(--ink-3);
  letter-spacing: 4rpx;
}

.hpp-loading {
  text-align: center;
  font-size: 26rpx;
  color: var(--ink-3);
  padding: 80rpx 0;
}

.hpp-page {
  position: relative;
  margin-top: 32rpx;
  padding: 32rpx 24rpx;
  background: var(--surface);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-md);
}
.hpp-page-head {
  display: flex;
  justify-content: space-between;
  font-size: 22rpx;
  font-family: var(--font-mono);
  letter-spacing: 4rpx;
  color: var(--ink-3);
  padding-bottom: 16rpx;
  border-bottom: 2rpx dashed var(--line-2);
  margin-bottom: 24rpx;
}

.hpp-stamps {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
  justify-content: center;
  align-items: center;
}
.hpp-stamp {
  position: relative;
  border-radius: 50%;
  border: 4rpx solid var(--accent);
  background: rgba(255, 252, 243, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12rpx;
  text-align: center;
  color: var(--accent);
  animation: pop-in 0.5s var(--ease-spring) both;
  transition: transform 0.22s var(--ease-out);
  box-sizing: border-box;
}
.hpp-stamp:active { transform: scale(0.94); }

.hpp-stamp-name {
  font-size: 22rpx;
  font-weight: 700;
  font-family: var(--font-display);
  letter-spacing: 2rpx;
  line-height: 1.2;
  max-width: 100%;
  overflow: hidden;
}
.hpp-stamp-divider {
  width: 40%;
  height: 2rpx;
  background: currentColor;
  opacity: 0.4;
  margin: 8rpx 0;
}
.hpp-stamp-date {
  font-size: 18rpx;
  font-family: var(--font-mono);
  letter-spacing: 2rpx;
}
.hpp-stamp-days {
  font-size: 16rpx;
  font-family: var(--font-mono);
  letter-spacing: 2rpx;
  margin-top: 4rpx;
}

.hpp-stamp-aiglow {
  position: absolute;
  inset: -4rpx;
  border-radius: 50%;
  border: 4rpx solid var(--plum);
  animation: pulse-glow 2s ease-in-out infinite;
  pointer-events: none;
}
.hpp-stamp-airready {
  position: absolute;
  top: -8rpx; right: -8rpx;
  width: 32rpx; height: 32rpx;
  background: var(--leaf);
  color: #fff;
  border-radius: 50%;
  font-size: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hpp-watermark {
  position: absolute;
  bottom: 24rpx; right: 32rpx;
  font-size: 100rpx;
  font-family: var(--font-display);
  font-weight: 900;
  color: var(--ink);
  opacity: 0.04;
  pointer-events: none;
}

.hpp-cta {
  position: fixed;
  left: 32rpx; right: 32rpx;
  bottom: 48rpx;
  z-index: 10;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/home/HomePostcard.tsx src/pages/home/styles/home-postcard.scss
git commit -m "feat(home): HomePostcard 护照盖戳网格"
```

---

## Task 10: HomeMinimal 子组件

**Files:**
- Create: `src/pages/home/HomeMinimal.tsx`
- Create: `src/pages/home/styles/home-minimal.scss`

- [ ] **Step 1: 创建组件**

Create `src/pages/home/HomeMinimal.tsx`：

```typescript
import { View, Text } from '@tarojs/components'
import BrandLogo from '../../components/BrandLogo'
import AvatarEntry from '../../components/AvatarEntry'
import HomeBottomCTA from '../../components/HomeBottomCTA'
import HomeCardAIRow from '../../components/HomeCardAIRow'
import type { HomeViewProps } from './shared'
import type { Trip } from '../../types/trip'
import './styles/home-minimal.scss'

function aiStatusFor(t: Trip): 'thinking' | 'ready' | 'error' | null {
  if (t.aiStatus === 'generating') return 'thinking'
  if (t.aiStatus === 'ready') return 'ready'
  if (t.aiStatus === 'error') return 'error'
  return null
}

function tripDays(t: Trip): number {
  return Math.max(1, Math.round((new Date(t.endDate).getTime() - new Date(t.startDate).getTime()) / 86400000) + 1)
}

export default function HomeMinimal({
  trips, loading, openid, onOpenTrip, onLongPressTrip, onNewTrip, onAITrip,
}: HomeViewProps) {
  const totalDays = trips.reduce((s, t) => s + tripDays(t), 0)

  return (
    <View className='hmin'>
      <View className='hmin-head'>
        <View className='hmin-top'>
          <Text className='hmin-eyebrow'>CHRONICLE</Text>
          <AvatarEntry className='hmin-avatar' />
        </View>
        <BrandLogo size='lg' />
        <View className='hmin-stats'>
          <View className='hmin-stat'>
            <Text className='hmin-stat-v'>{trips.length}</Text>
            <Text className='hmin-stat-l'>段</Text>
          </View>
          <View className='hmin-stat'>
            <Text className='hmin-stat-v'>{totalDays}</Text>
            <Text className='hmin-stat-l'>天</Text>
          </View>
        </View>
      </View>

      {loading && <View className='hmin-loading'>加载中…</View>}

      <View className='hmin-list'>
        {trips.map((t, i) => {
          const ai = aiStatusFor(t)
          return (
            <View
              key={t._id}
              className='hmin-row'
              onClick={() => onOpenTrip(t)}
              onLongPress={() => onLongPressTrip(t)}
            >
              <Text className='hmin-row-no'>{String(i + 1).padStart(2, '0')}</Text>
              <View className='hmin-row-body'>
                <View className='hmin-row-top'>
                  <Text className='hmin-row-name'>{t.name}</Text>
                  <Text className='hmin-row-arrow'>›</Text>
                </View>
                <View className='hmin-row-meta'>
                  <Text>{t.startDate.replace(/-/g, '.')} → {t.endDate.slice(5).replace('-', '.')}</Text>
                  <Text>·</Text>
                  <Text>{t.pax} 人 · {tripDays(t)} 天</Text>
                </View>
                {ai && <HomeCardAIRow status={ai} />}
              </View>
            </View>
          )
        })}
      </View>

      <View className='hmin-cta'>
        <HomeBottomCTA onAITap={onAITrip} onNewTap={onNewTrip} newLabel='+ 新建' />
      </View>
    </View>
  )
}
```

- [ ] **Step 2: 创建样式**

Create `src/pages/home/styles/home-minimal.scss`：

```scss
.hmin {
  min-height: 100vh;
  padding: 32rpx 32rpx 320rpx;
  box-sizing: border-box;
  background: var(--bg);
  animation: page-in 0.42s var(--ease-out) both;
}

.hmin-head {
  padding: 16rpx 8rpx 40rpx;
  animation: slide-up 0.5s var(--ease-out) both;
}
.hmin-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32rpx;
}
.hmin-eyebrow {
  font-size: 22rpx;
  letter-spacing: 8rpx;
  color: var(--ink-3);
  font-family: var(--font-display);
}
.hmin-stats {
  display: flex;
  gap: 48rpx;
  margin-top: 32rpx;
}
.hmin-stat { display: flex; align-items: baseline; gap: 6rpx; }
.hmin-stat-v {
  font-size: 56rpx;
  font-weight: 700;
  color: var(--ink);
  font-family: var(--font-display);
}
.hmin-stat-l {
  font-size: 22rpx;
  color: var(--ink-3);
}

.hmin-loading {
  text-align: center;
  font-size: 26rpx;
  color: var(--ink-3);
  padding: 80rpx 0;
}

.hmin-list {
  margin-top: 16rpx;
}
.hmin-row {
  display: flex;
  gap: 24rpx;
  padding: 28rpx 0;
  border-bottom: 1rpx solid var(--line);
  align-items: flex-start;
}
.hmin-row:active { background: var(--accent-bg); }
.hmin-row-no {
  font-size: 24rpx;
  font-family: var(--font-mono);
  color: var(--ink-3);
  letter-spacing: 2rpx;
  padding-top: 4rpx;
}
.hmin-row-body { flex: 1; }
.hmin-row-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.hmin-row-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--ink);
}
.hmin-row-arrow {
  font-size: 28rpx;
  color: var(--ink-3);
}
.hmin-row-meta {
  display: flex;
  gap: 8rpx;
  margin-top: 8rpx;
  font-size: 22rpx;
  font-family: var(--font-mono);
  color: var(--ink-3);
}

.hmin-cta {
  position: fixed;
  left: 32rpx; right: 32rpx;
  bottom: 48rpx;
  z-index: 10;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/home/HomeMinimal.tsx src/pages/home/styles/home-minimal.scss
git commit -m "feat(home): HomeMinimal 极简清单"
```

---

## Task 11: home dispatcher + AI 入口接通

**Files:**
- Modify: `src/pages/home/index.tsx`
- Modify: `src/pages/home/index.scss`
- Modify: `src/pages/new-trip/index.tsx`

> 关键决策：home 底部「让 AI 帮你规划」按钮 → `Taro.navigateTo('/pages/new-trip/index?openAI=1')`
> new-trip 页 useEffect 读到 query → 自动打开 AIInterview（替代旧 AIPlanForm）
> 这样 home 不需要处理 destinations/date/name 填写，沿用 new-trip 现有 UX。

- [ ] **Step 1: 改 home/index.tsx 为 dispatcher**

替换 `src/pages/home/index.tsx` 整体为：

```typescript
import { useEffect, useState } from 'react'
import { View } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import type { Trip } from '../../types/trip'
import { listMyTrips, renameTrip, copyTripLocally, smartDeleteTrip, updateTrip } from '../../utils/db'
import { SEED_TRIPS, isSeedTripId } from '../../data/seed-trips'
import { useMe } from '../../store/me-store'
import { useTheme } from '../../store/theme-store'
import { useThemeClass } from '../../utils/theme-class'
import TripActionSheet, { type TripAction } from '../../components/TripActionSheet'
import ShareTypeSheet from '../../components/ShareTypeSheet'
import CoverPicker from '../../components/CoverPicker'
import { buildShareMessage, shareRef, resetShareRef } from '../../utils/share'
import type { ShareKind } from '../../utils/cloud'
import HomeTegami from './HomeTegami'
import HomeMagazine from './HomeMagazine'
import HomePostcard from './HomePostcard'
import HomeMinimal from './HomeMinimal'
import type { HomeViewProps } from './shared'
import './index.scss'

export default function Home() {
  const themeCls = useThemeClass()
  const { theme } = useTheme()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const { me } = useMe()
  const openid = me?.openid || ''
  const [actionTrip, setActionTrip] = useState<Trip | null>(null)
  const [shareTrip, setShareTrip] = useState<Trip | null>(null)
  const [shareReady, setShareReady] = useState({ readonly: false, collab: false })
  const [coverTrip, setCoverTrip] = useState<Trip | null>(null)

  useEffect(() => {
    if (!openid) return
    let cancelled = false
    listMyTrips(openid)
      .then((list) => { if (!cancelled) { setTrips([...SEED_TRIPS, ...list]); setLoading(false) } })
      .catch((e) => {
        console.error('[home] listMyTrips failed', e)
        Taro.showToast({ title: '加载失败', icon: 'none' })
        if (!cancelled) { setTrips([...SEED_TRIPS]); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [openid])

  useDidShow(() => {
    if (!openid) return
    Taro.showNavigationBarLoading()
    listMyTrips(openid)
      .then((list) => setTrips([...SEED_TRIPS, ...list]))
      .finally(() => Taro.hideNavigationBarLoading())
  })

  useEffect(() => {
    if (!openid) return
    const hasGenerating = trips.some((t) => t.aiStatus === 'generating')
    if (!hasGenerating) return
    const timer = setInterval(() => {
      listMyTrips(openid)
        .then((list) => setTrips([...SEED_TRIPS, ...list]))
        .catch((e) => console.error('[home] ai polling failed', e))
    }, 5000)
    return () => clearInterval(timer)
  }, [openid, trips])

  const handleAction = async (action: TripAction) => {
    if (!actionTrip) return
    const t = actionTrip
    setActionTrip(null)

    if (action === 'copy') {
      const newId = await copyTripLocally(t._id, openid, me ? { nickname: me.nickname, avatarUrl: me.avatarUrl } : undefined)
      Taro.showToast({ title: '已复制', icon: 'success', duration: 600 })
      setTimeout(() => { Taro.hideToast(); Taro.navigateTo({ url: `/pages/trip/index?id=${newId}` }) }, 650)
      return
    }
    if (action === 'rename') {
      const res = await Taro.showModal({
        title: '重命名', editable: true,
        placeholderText: '请输入新的攻略名称', content: t.name,
      })
      if (res.confirm) {
        const newName = (res.content || '').trim()
        if (!newName) { Taro.showToast({ title: '名称不能为空', icon: 'none' }); return }
        if (newName === t.name) return
        await renameTrip(t._id, newName, openid)
        setTrips((prev) => prev.map((x) => x._id === t._id ? { ...x, name: newName } : x))
        Taro.showToast({ title: '已重命名', icon: 'success' })
      }
      return
    }
    if (action === 'share') { openShareFor(t); return }
    if (action === 'delete') {
      const isOwner = t._openid === openid
      const collabCount = (t.collaborators || []).length
      const title = isOwner ? '删除攻略？' : '退出协作？'
      const content = isOwner
        ? (collabCount > 0 ? `还有 ${collabCount} 位协作者将失去访问，确认删除？` : `「${t.name}」将被永久删除`)
        : `退出后，「${t.name}」不再出现在你的攻略册中（原作者仍可见）`
      const confirmText = isOwner ? '删除' : '退出'
      const res = await Taro.showModal({ title, content, confirmText, confirmColor: '#c43d3d' })
      if (res.confirm) {
        const performed = await smartDeleteTrip(t, openid)
        setTrips((prev) => prev.filter((x) => x._id !== t._id))
        Taro.showToast({ title: performed === 'delete' ? '已删除' : '已退出', icon: 'success' })
      }
    }
  }

  const prepareShare = async (kind: ShareKind) => {
    if (!shareTrip) return
    try {
      const payload = await buildShareMessage(shareTrip._id, shareTrip.name, kind)
      shareRef.byKind[kind] = { title: payload.title, path: payload.path }
      setShareReady((prev) => ({ ...prev, [kind]: true }))
    } catch (e) {
      console.error('[share]', e)
      Taro.showToast({ title: '生成分享失败', icon: 'error' })
    }
  }

  const openShareFor = (trip: Trip) => {
    resetShareRef(trip.name)
    setShareReady({ readonly: false, collab: false })
    setShareTrip(trip)
  }

  useShareAppMessage((options) => {
    const kind = (options as { target?: { dataset?: { kind?: ShareKind } } })?.target?.dataset?.kind
    const picked = kind ? shareRef.byKind[kind] : null
    return picked || { title: '行册 · 旅行攻略册', path: '/pages/home/index' }
  })

  const handleCoverPicked = async (fileIDOrNull: string | null) => {
    if (!coverTrip) return
    const target = coverTrip
    setCoverTrip(null)
    try {
      await updateTrip(target._id, { coverUrl: fileIDOrNull }, openid)
      setTrips((prev) => prev.map((x) => x._id === target._id ? { ...x, coverUrl: fileIDOrNull } : x))
    } catch (e) {
      console.error('[home] save cover failed', e)
      Taro.showToast({ title: '保存封面失败', icon: 'none' })
    }
  }

  const props: HomeViewProps = {
    trips,
    loading,
    openid,
    onOpenTrip: (t) => Taro.navigateTo({ url: `/pages/trip/index?id=${t._id}` }),
    onLongPressTrip: (t) => setActionTrip(t),
    onNewTrip: () => Taro.navigateTo({ url: '/pages/new-trip/index' }),
    onAITrip: () => Taro.navigateTo({ url: '/pages/new-trip/index?openAI=1' }),
    onCoverLongPress: (t) => {
      if (isSeedTripId(t._id)) {
        Taro.showToast({ title: '示例攻略不能改封面', icon: 'none' })
        return
      }
      setCoverTrip(t)
    },
  }

  return (
    <View className={themeCls}>
      {theme === 'tegami'   && <HomeTegami   {...props} />}
      {theme === 'magazine' && <HomeMagazine {...props} />}
      {theme === 'postcard' && <HomePostcard {...props} />}
      {theme === 'minimal'  && <HomeMinimal  {...props} />}

      <TripActionSheet
        open={!!actionTrip}
        tripName={actionTrip?.name || ''}
        actions={actionTrip && isSeedTripId(actionTrip._id) ? ['copy'] : undefined}
        onSelect={handleAction}
        onClose={() => setActionTrip(null)}
      />
      <ShareTypeSheet
        open={!!shareTrip}
        onClose={() => setShareTrip(null)}
        prepare={prepareShare}
        ready={shareReady}
      />
      <CoverPicker
        open={!!coverTrip}
        openid={openid}
        onPicked={handleCoverPicked}
        onClose={() => setCoverTrip(null)}
      />
    </View>
  )
}
```

- [ ] **Step 2: 精简 home/index.scss**

把 `src/pages/home/index.scss` 内容替换为（只保留共享/dispatcher 层）：

```scss
/* home 共用：4 主题各自的 scss 在 styles/* 内 */

/* dispatcher 没有自己的样式；保留空文件以维持 import 路径 */
```

> 旧的 `.home / .home-head / .trip-card / .home-foot` 等选择器全部删除（已被 4 套主题 SCSS 替代）。

- [ ] **Step 3: 改 new-trip 页接 ?openAI=1**

Edit `src/pages/new-trip/index.tsx`，引入 AIInterview + 监听 router query：

```typescript
import { useRouter } from '@tarojs/taro'
import AIInterview from '../../components/AIInterview'
```

在顶部 hooks 区加：

```typescript
const router = useRouter()

useEffect(() => {
  if (router.params?.openAI === '1') {
    setAiFormOpen(true)
  }
}, [router.params])
```

把现有 `<AIPlanForm ... />` 临时同时挂上 `<AIInterview ... />`（不替换，并存）：

```tsx
<AIInterview
  open={aiFormOpen}
  onClose={() => setAiFormOpen(false)}
  onSubmit={(prefs) => { setAiFormOpen(false); void handleAiSubmit(prefs) }}
/>
```

> AIPlanForm 仍由 new-trip 内既有按钮触发，Phase 5 才下线。AIInterview 仅由 ?openAI=1 query 触发。

如果 `handleAiSubmit` 当前依赖 `canSubmit`（要求 name 已填），但来自 home 的入口没填 name，则把 canSubmit 校验放宽：检查到 name 为空时弹 toast 引导用户先填基本信息。修改 `handleAiSubmit` 起首：

```typescript
const handleAiSubmit = async (prefs: AIPreferences) => {
  if (!name.trim()) {
    Taro.showToast({ title: '请先填写攻略名', icon: 'none' })
    return
  }
  if (!destinations.length) {
    Taro.showToast({ title: '请先选择目的地', icon: 'none' })
    return
  }
  // ... 原有逻辑
```

> 这样 home 入口的用户进入 new-trip → 看到 AIInterview → 填偏好 → 提交时若发现 name/dest 未填会被 toast 拦回，用户再填。可接受。
> 如果想体验更顺滑，可在 AIInterview 题库前再加 "name / 日期 / 目的地" 三题；本 Phase 不做，留改进点。

- [ ] **Step 4: 编译验证**

watch 自动重编。
Expected: 编译成功，无类型/未使用 import 报错

- [ ] **Step 5: 微信开发者工具冒烟**

进入小程序 → 首页：
- 默认 tegami 主题 → 显示明信片堆叠版式 + 右上角头像
- 我的页切到 magazine → 回首页变杂志封面（feature 大封面 + 目录）
- 切到 postcard → 盖戳网格
- 切到 minimal → 行式清单
- 4 主题底部都是 AI 按钮（脉冲 + shine）+ 新建（线框次级）

- [ ] **Step 6: AI 入口冒烟**

- 首页点「让 AI 帮你规划」→ 跳 new-trip 页 → AIInterview 自动弹起
- 走完 5 道题 → 点开始生成 → 因 name 为空 → toast "请先填写攻略名"
- 关闭 AIInterview → 填好 name / dest / 日期 → 再点页面内 AI 按钮 → 重新走流程 → 提交成功 → 回首页看到新 trip 卡 thinking 态
- 卡内 HomeCardAIRow 显示「AI 正在为你编排 · 预计 30s」
- 切到杂志主题验证 feature 卡有 HomeCardAIRow（如果新建的是 trips[0]）

- [ ] **Step 7: 自定义封面冒烟**

- 切到 magazine 主题
- 长按 feature 卡封面图 → 弹 CoverPicker
- 选「相册」→ 选图 → 上传 → toast「已更新封面」
- feature 卡封面变为新图
- 重启小程序 → 封面保持
- 长按 → 恢复默认 → 封面回到 default-cover.jpg

- [ ] **Step 8: Commit**

```bash
git add src/pages/home/index.tsx src/pages/home/index.scss src/pages/new-trip/index.tsx
git commit -m "feat(home): theme dispatcher + AI 入口 + 自定义封面接通"
```

---

## Task 12: 移除 home 卡的 AILoadingBar 引用

**Files:** 仅验证

> Phase 3 home 子组件已用 HomeCardAIRow；老 `<AILoadingBar/>` 在 home 内已不再被引用。
> trip 详情页可能还在用 AILoadingBar —— 不动，Phase 5 收尾。

- [ ] **Step 1: 检查 home 内不再引用 AILoadingBar**

Run:
```bash
grep -rn "AILoadingBar" src/pages/home/
```
Expected: 无输出（home 目录下全部走 HomeCardAIRow）

- [ ] **Step 2: 全局引用检查**

Run:
```bash
grep -rn "AILoadingBar" src/
```
Expected: 仅 trip 详情页 + AILoadingBar 组件自身 + 可能的 share 页

- [ ] **Step 3: 不 commit（无代码改动）**

---

## Task 13: 四主题首页矩阵走查

**Files:** 仅验证

- [ ] **Step 1: 微信开发者工具编译 + 真机预览**

- [ ] **Step 2: 走查矩阵**

| 主题 | 验证点 |
| --- | --- |
| 手帖 tegami | masthead 上方 `行册 · No.012 · 2026 春` 单行；BrandLogo + AvatarEntry 左右排；trip 卡堆叠错位 `rotate(-0.6deg)` 等可见；卡片 hover 摆正 |
| 刊物 magazine | 双线分割（hairline + double）；feature 大标题 60rpx 衬线；photoframe 封面 16:10；目录 dotted 引线 `P.02 ... 2026-04` |
| 护照 postcard | 斜纹纸纹背景；护照封面区 `XING CE · PASSPORT`；盖戳按天数缩放（最长的最大）；右下方水印 `行册` 极淡 |
| 极简 minimal | hairline 极淡；行式 list；不显眼 `01 / 02 / 03` 序号；几乎无阴影 |

- [ ] **Step 3: 共用功能矩阵**

每个主题都验证：
- AvatarEntry 点击 → 我的页
- 底部 AI 按钮点击 → new-trip + auto-open interview
- 底部新建按钮点击 → new-trip（不 auto-open）
- 长按 trip 卡 → ActionSheet 弹出（重命名 / 复制 / 分享 / 删除）
- 示例攻略卡 → ActionSheet 只显示「复制」
- AI generating 中的 trip 卡内 → HomeCardAIRow 显示
- AI ready → HomeCardAIRow 显示「AI 草稿就绪 · 点击查看」+ 末尾 ›
- 点击 ready 状态的卡 → 进入 trip 页 → 沿用现有自动弹 AIPlanPreview 逻辑

- [ ] **Step 4: 杂志主题封面专项**

- 首页杂志主题 → 长按 feature 卡封面 → CoverPicker 弹起
- 选相册 → 上传 → 封面替换
- 长按 → 恢复默认 → 回到 default-cover.jpg
- 长按其他主题的卡片 → 走 ActionSheet 而非 CoverPicker（只杂志主题封面长按触发 CoverPicker，其他主题长按走 ActionSheet）

> 注意：杂志主题 feature 卡上有两种长按目标 —— 长按封面图区域走 CoverPicker（MagFeatureCover 内部 onLongPress），长按卡其他位置走 ActionSheet（hm-feature 容器的 onLongPress）。请在真机确认两个事件不会同时触发；如冲突，给 MagFeatureCover 包裹一层 `<View catchTouchMove>` 阻止冒泡。

- [ ] **Step 5: AI 流端到端**

- 主题切回 tegami
- 填 new-trip → 提交 AIInterview
- 回首页 → 新 trip 卡 thinking
- 等 30s（云函数真生成）→ ready
- 点 ready 卡 → 进入 trip 详情 → 自动弹 AIPlanPreview（沿用既有逻辑）

---

## Task 14: 收尾

- [ ] **Step 1: codemap 同步（如有）**

若 `docs/codemap.md` 维护组件清单，追加：
- `src/components/CoverPicker`
- `src/components/MagFeatureCover`
- `src/components/HomeBottomCTA`
- `src/pages/home/HomeTegami / HomeMagazine / HomePostcard / HomeMinimal`
- `src/pages/home/shared.tsx`
- `src/utils/cover.ts`
- `src/assets/cover/default-cover.jpg`

- [ ] **Step 2: 推分支（按团队约定）**

```bash
git push
```

---

## Self-Review 结果

- ✅ Spec § 7.1 home 4 主题版式 → Task 7, 8, 9, 10
- ✅ Spec § 7.1 共用：AvatarEntry / 底部 CTA / 长按 action → 4 子组件内
- ✅ Spec § 6.1.5 MagFeatureCover (photoframe) → Task 4
- ✅ Spec § 6.1.6 CoverPicker → Task 3（**裁剪交互降级为 16:10 视觉框** —— 见 Task 3 说明）
- ✅ Spec § 7.1 自定义封面入口 → Task 11 Step 7（长按 feature 卡封面）
- ✅ Spec § 8.3 自定义封面流 → Task 3 + Task 11 handleCoverPicked
- ✅ Spec § 9.3 底部 CTA 方案 3 → Task 5 + Task 7/8/9/10
- ✅ Spec § 4.3.2 Trip 加 coverUrl → Task 1
- ✅ Spec § 8.4.1 home AI 入口 A → Task 11 Step 3（**降级为：跳 new-trip 页 + auto-open interview**）

**关键决策与已知偏差：**

1. **AI 入口 A 的简化实现**
   Spec § 8.4.1 描述："home AIBadge → AIInterview → onSubmit → createTrip + startAITask → 回首页"。
   AIInterview 题库（Phase 2 Task 4）只收集 pace / audience / budget / freeText / model，**不收集 name / 日期 / 目的地**。
   本 Phase 选择降级实现：home AIBadge → 跳 new-trip + ?openAI=1 → new-trip 页 auto-open AIInterview → 用户先填 name/日期/目的地 再答 interview → 提交。
   理由：避免在 home 入口现场弹一个 7 道题超长 sheet；沿用已有 new-trip UX 心智。
   Phase 5 可考虑扩展 AIInterview 题库到 8 题，把 name/日期/目的地纳入；本 Phase 不做。

2. **CoverPicker 不带交互式裁剪**
   小程序无原生定比例裁剪 API；spec § 8.3 提到"16:10 裁剪框"实际由 CSS `aspect-ratio: 16/10 + object-fit: cover` 视觉裁剪满足。
   真正的交互式拖动裁剪框需自实现 canvas + 触摸事件，工作量等同一个独立组件；本 Phase 不做，记入"已知限制"。

3. **杂志主题 feature 卡长按事件冲突风险**
   两个 onLongPress（外层 ActionSheet vs MagFeatureCover 内层 CoverPicker）可能冲突。
   Task 13 Step 4 真机验证；若冲突给 MagFeatureCover 加 `catchTouchMove` 或 `catchLongPress` 阻止冒泡。

4. **trip.coverUrl 仅杂志主题展示**
   其他三主题不使用 coverUrl 字段；用户在杂志主题改的封面对其他主题无视觉影响。spec § 7.1 已规定。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-26-phase3-home-four-themes.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — 每个 Task 派 fresh subagent，主线 review；适合首页这种"4 个独立大组件 + 1 个 dispatcher"的工作（每 Home* 子组件互相独立，并行风险低）
2. **Inline Execution** — 我连跑全部 Task，每 4 Task 一个 checkpoint

**Which approach?**
