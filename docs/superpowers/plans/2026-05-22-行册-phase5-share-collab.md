# 行册 Phase 5 · 分享 + L1 协作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 接通分享流程——两种分享（只读 / 协作），收件人落地页能克隆或加入；trip 详情页头部显示协作者头像；删除语义按 owner / collaborator 分支处理。

**Architecture:** 分享按钮调 Phase 1 已部署的云函数生成 token，包装进 `wx.shareAppMessage` 卡片；微信用户点卡片进入 `/pages/share/index?token=xxx`，落地页拉取 token + 预览，按 kind 渲染不同按钮，再调 cloneTrip / joinCollab 云函数。trip 页头部读 `trip.collaborators` 渲染头像。

**Tech Stack:** Taro 4.2 / React 18 / TypeScript · 微信小程序 `wx.shareAppMessage` / `onShareAppMessage` · Phase 1 已就绪的 createShareToken / cloneTrip / joinCollab 云函数

---

## 0. 前置条件

- **0.1** Phase 4 已完成验收
- **0.2** Phase 1 部署的 6 个云函数中：`create-share-token` / `clone-trip` / `join-collab` 工作正常
- **0.3** trip 详情页能正常加载，home 长按 ActionSheet 已就绪（"分享"暂时只占位）
- **0.4** users 表中有当前用户记录（nickname + avatarUrl 至少有一项）

---

## 1. 文件结构

```
src/
├── app.config.ts                    ← 修改：添加 pages/share/index
├── pages/
│   ├── home/index.tsx               ← 修改：share 按钮接 ShareTypeSheet
│   ├── trip/index.tsx               ← 修改：头部协作者头像 + 分享按钮 + 删除分支
│   └── share/                       ← 新建
│       ├── index.tsx
│       ├── index.config.ts
│       └── index.scss
├── components/
│   ├── ShareTypeSheet/              ← 新建
│   │   ├── index.tsx
│   │   └── index.scss
│   └── CollaboratorsBar/            ← 新建
│       ├── index.tsx
│       └── index.scss
└── utils/
    ├── share.ts                     ← 新建（分享卡片包装）
    └── db.ts                        ← 修改：listMyTrips 扩展到协作者；deleteMyTrip 分支
```

---

## Task 1: 扩展 `utils/db.ts` —— owner ∪ collaborator + 智能删除

**Files:**
- Modify: `src/utils/db.ts`

- [ ] **Step 1.1:** 在 `db.ts` 顶部加 import
```ts
import type { Trip, NewTripInput, Collaborator } from '../types/trip'
```

(如已 import Trip 等，只增缺失的部分。)

- [ ] **Step 1.2:** 替换 `listMyTrips` 实现，支持协作者可见

把：
```ts
export async function listMyTrips(openid: string): Promise<Trip[]> {
  const res = await db()
    .collection(TRIPS)
    .where({ _openid: openid })
    .orderBy('updatedAt', 'desc')
    .get()
  return (res.data || []) as Trip[]
}
```

换成：
```ts
export async function listMyTrips(openid: string): Promise<Trip[]> {
  const _ = (Taro as any).cloud.database().command
  const res = await db()
    .collection(TRIPS)
    .where(_.or([
      { _openid: openid },
      { 'collaborators.openid': openid },
    ]))
    .orderBy('updatedAt', 'desc')
    .get()
  return (res.data || []) as Trip[]
}
```

- [ ] **Step 1.3:** `watchMyTrips` 同样扩展
```ts
export function watchMyTrips(openid: string, onChange: (trips: Trip[]) => void) {
  const _ = (Taro as any).cloud.database().command
  // @ts-ignore
  return db()
    .collection(TRIPS)
    .where(_.or([
      { _openid: openid },
      { 'collaborators.openid': openid },
    ]))
    .orderBy('updatedAt', 'desc')
    .watch({
      onChange: (snapshot: { docs: Trip[] }) => {
        onChange(snapshot.docs || [])
      },
      onError: (err: unknown) => {
        console.error('[watchMyTrips]', err)
      }
    })
}
```

- [ ] **Step 1.4:** 添加智能删除：协作者就退出，owner 就真删
```ts
/**
 * 删除一条 trip，按身份分支：
 * - 非 owner：从 collaborators 数组移除自己（退出协作）
 * - owner：真删（前提：已确认）
 */
export async function smartDeleteTrip(trip: Trip, openid: string): Promise<'leave' | 'delete'> {
  if (trip._openid === openid) {
    await db().collection(TRIPS).doc(trip._id).remove()
    return 'delete'
  }
  // 非 owner：退出协作
  const _ = (Taro as any).cloud.database().command
  await db().collection(TRIPS).doc(trip._id).update({
    data: {
      collaborators: _.pull({ openid }),
      updatedAt: Date.now(),
      updatedBy: openid,
    }
  })
  return 'leave'
}
```

注：上面 Taro/cloud 处的 `as any` 用法是因 Taro 类型对 cloud 命令对象不完整；运行无影响。

- [ ] **Step 1.5:** 类型检查
```bash
cd /Users/jinchi/Documents/行册
npx tsc --noEmit
```

- [ ] **Step 1.6:** 提交
```bash
git add src/utils/db.ts
git commit -m "feat(db): collab-aware list/watch + smartDeleteTrip"
```

---

## Task 2: 创建 `utils/share.ts`

**Files:**
- Create: `src/utils/share.ts`

- [ ] **Step 2.1:** 创建文件
```ts
import Taro from '@tarojs/taro'
import { cloud, type ShareKind } from './cloud'

interface SharePayload {
  title: string
  path: string
  kind: ShareKind
}

/**
 * 调云函数生成 token，构造分享卡片参数
 */
export async function buildShareMessage(tripId: string, tripName: string, kind: ShareKind): Promise<SharePayload> {
  const { token } = await cloud.createShareToken({ tripId, kind })
  const prefix = kind === 'readonly' ? '只读分享' : '邀请协作'
  return {
    title: `${prefix} · ${tripName}`,
    path: `/pages/share/index?token=${token}&kind=${kind}&tripId=${tripId}`,
    kind,
  }
}

/**
 * 让用户唤起原生分享（实际由 onShareAppMessage 返回 payload）。
 * 调用方先用 buildShareMessage 拿到 payload，再 setSharePayload 给页面，
 * 然后调用 wx.showShareMenu 引导用户点右上角"..."分享。
 *
 * 由于微信不允许从代码主动弹分享菜单，这里 toast 提示用户操作。
 */
export function promptUserToShare() {
  Taro.showModal({
    title: '点击右上角 "..." → 转发',
    content: '将分享卡片发送给微信好友',
    confirmText: '我知道了',
    showCancel: false,
  })
}
```

- [ ] **Step 2.2:** 提交
```bash
git add src/utils/share.ts
git commit -m "feat(utils): share message builder + prompt"
```

---

## Task 3: 创建 `components/ShareTypeSheet`

**Files:**
- Create: `src/components/ShareTypeSheet/index.tsx`
- Create: `src/components/ShareTypeSheet/index.scss`

- [ ] **Step 3.1:** `src/components/ShareTypeSheet/index.tsx`
```tsx
import { View, Text } from '@tarojs/components'
import type { ShareKind } from '../../utils/cloud'
import './index.scss'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (kind: ShareKind) => void
}

export default function ShareTypeSheet({ open, onClose, onSelect }: Props) {
  if (!open) return null
  return (
    <View className='sts-mask' onClick={onClose}>
      <View className='sts-sheet' onClick={e => e.stopPropagation()}>
        <View
          className='sts-item'
          onClick={() => { onSelect('readonly'); onClose() }}
        >
          <Text className='sts-item-title'>🔒 只读分享</Text>
          <Text className='sts-item-desc'>对方收到一份独立副本，可自由编辑、删除，不影响你这边</Text>
        </View>
        <View
          className='sts-item'
          onClick={() => { onSelect('collab'); onClose() }}
        >
          <Text className='sts-item-title'>👥 邀请协作</Text>
          <Text className='sts-item-desc'>对方加入后能编辑同一份攻略，改动实时同步</Text>
        </View>
        <View className='sts-cancel' onClick={onClose}>
          <Text>取消</Text>
        </View>
      </View>
    </View>
  )
}
```

- [ ] **Step 3.2:** `src/components/ShareTypeSheet/index.scss`
```scss
.sts-mask {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: flex-end;
  z-index: 100;
}

.sts-sheet {
  width: 100%;
  background: var(--bg, #f7f1e3);
  color: var(--ink, #2a2522);
  border-radius: 24rpx 24rpx 0 0;
  padding: 24rpx 0 32rpx;
}

.sts-item {
  display: flex; flex-direction: column;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid rgba(0,0,0,0.06);
}
.sts-item-title { font-size: 30rpx; font-weight: 600; }
.sts-item-desc {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  opacity: 0.6;
}

.sts-cancel {
  margin-top: 16rpx;
  padding: 24rpx 0;
  text-align: center;
  font-size: 30rpx;
  border-top: 12rpx solid rgba(0,0,0,0.04);
}
```

- [ ] **Step 3.3:** 提交
```bash
git add src/components/ShareTypeSheet/
git commit -m "feat(component): add ShareTypeSheet (readonly / collab)"
```

---

## Task 4: 创建 `components/CollaboratorsBar`

**Files:**
- Create: `src/components/CollaboratorsBar/index.tsx`
- Create: `src/components/CollaboratorsBar/index.scss`

- [ ] **Step 4.1:** `src/components/CollaboratorsBar/index.tsx`
```tsx
import { View, Text, Image } from '@tarojs/components'
import type { Collaborator } from '../../types/trip'
import './index.scss'

interface Props {
  collaborators: Collaborator[]
  ownerNickname?: string
  isOwner: boolean
}

export default function CollaboratorsBar({ collaborators, ownerNickname, isOwner }: Props) {
  if (collaborators.length === 0 && isOwner) return null

  return (
    <View className='collab-bar'>
      <Text className='cb-label'>
        {isOwner ? '协作者' : `${ownerNickname || '原作者'} 的攻略`}
      </Text>
      <View className='cb-avatars'>
        {collaborators.slice(0, 5).map(c => (
          c.avatarUrl
            ? <Image key={c.openid} className='cb-avatar' src={c.avatarUrl} mode='aspectFill' />
            : <View key={c.openid} className='cb-avatar cb-avatar-fallback'>
                <Text>{(c.nickname || '?').slice(0, 1)}</Text>
              </View>
        ))}
        {collaborators.length > 5 && (
          <View className='cb-avatar cb-avatar-more'>
            <Text>+{collaborators.length - 5}</Text>
          </View>
        )}
      </View>
    </View>
  )
}
```

- [ ] **Step 4.2:** `src/components/CollaboratorsBar/index.scss`
```scss
.collab-bar {
  display: flex; align-items: center;
  padding: 8rpx 0;
}
.cb-label {
  font-size: 22rpx; opacity: 0.55;
  margin-right: 16rpx;
}
.cb-avatars {
  display: flex; align-items: center;
}
.cb-avatar {
  width: 44rpx; height: 44rpx;
  border-radius: 999rpx;
  margin-left: -8rpx;
  border: 2rpx solid var(--bg);
  background: rgba(0,0,0,0.1);
  display: flex; align-items: center; justify-content: center;
  font-size: 20rpx; font-weight: 600;
  overflow: hidden;
}
.cb-avatar:first-child { margin-left: 0; }
.cb-avatar-fallback { background: rgba(0,0,0,0.15); }
.cb-avatar-more { background: rgba(0,0,0,0.05); font-size: 18rpx; }
```

- [ ] **Step 4.3:** 提交
```bash
git add src/components/CollaboratorsBar/
git commit -m "feat(component): add CollaboratorsBar (avatar stack)"
```

---

## Task 5: 创建 `pages/share/index`（落地页）

**Files:**
- Create: `src/pages/share/index.tsx`
- Create: `src/pages/share/index.config.ts`
- Create: `src/pages/share/index.scss`

- [ ] **Step 5.1:** `src/pages/share/index.config.ts`
```ts
export default definePageConfig({
  navigationBarTitleText: '查看分享',
  navigationBarBackgroundColor: '#f7f1e3',
  navigationBarTextStyle: 'black',
})
```

- [ ] **Step 5.2:** `src/pages/share/index.tsx`
```tsx
import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { cloud, type ShareKind } from '../../utils/cloud'
import { getTrip } from '../../utils/db'
import { fmtDateShort } from '../../utils/format'
import { destinationLabel, tripSummary } from '../../utils/trip-helpers'
import type { Trip } from '../../types/trip'
import './index.scss'

export default function SharePage() {
  const router = useRouter()
  const token = router.params.token || ''
  const kind = (router.params.kind as ShareKind) || 'readonly'
  const tripId = router.params.tripId || ''

  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (!tripId) {
      setError('链接缺少 tripId')
      setLoading(false)
      return
    }
    getTrip(tripId).then(t => {
      if (!t) setError('攻略不存在或已被删除')
      else setTrip(t)
      setLoading(false)
    })
  }, [tripId])

  const accept = async () => {
    if (!trip || acting) return
    setActing(true)
    try {
      if (kind === 'readonly') {
        const res = await cloud.cloneTrip({ sourceTripId: trip._id, token })
        await Taro.showToast({ title: '已复制', icon: 'success', duration: 1200 })
        setTimeout(() => Taro.redirectTo({ url: `/pages/trip/index?id=${res.newTripId}` }), 800)
      } else {
        const res = await cloud.joinCollab({ tripId: trip._id, token })
        if (res.alreadyOwner) {
          await Taro.showToast({ title: '这是你自己的攻略', icon: 'none' })
        } else if (res.alreadyJoined) {
          await Taro.showToast({ title: '你已加入', icon: 'none' })
        } else {
          await Taro.showToast({ title: '已加入协作', icon: 'success' })
        }
        setTimeout(() => Taro.redirectTo({ url: `/pages/trip/index?id=${trip._id}` }), 800)
      }
    } catch (e) {
      console.error('[share accept]', e)
      const msg = (e as Error).message || '操作失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setActing(false)
    }
  }

  if (loading) return <View className='share-empty'>加载中...</View>
  if (error) return <View className='share-empty'>{error}</View>
  if (!trip) return <View className='share-empty'>未找到攻略</View>

  return (
    <View className='share theme-tegami'>
      <View className='share-head'>
        <Text className='sh-label'>{kind === 'readonly' ? '🔒 一份只读攻略' : '👥 协作邀请'}</Text>
      </View>

      <View className='share-card'>
        <Text className='sc-name'>{trip.name}</Text>
        <Text className='sc-meta'>
          {fmtDateShort(trip.startDate)} → {fmtDateShort(trip.endDate)} · {tripSummary(trip.startDate, trip.endDate, trip.pax)}
        </Text>
        <View className='sc-dest'>
          {trip.destinations.map(d => (
            <Text key={d.adcode} className='sc-dest-chip'>{d.name}</Text>
          ))}
        </View>
      </View>

      <View className='share-foot'>
        <View
          className={`share-btn ${acting ? 'disabled' : ''}`}
          onClick={accept}
        >{kind === 'readonly' ? '复制到我的攻略册' : '加入协作'}</View>
        <Text className='share-back' onClick={() => Taro.reLaunch({ url: '/pages/home/index' })}>
          先回首页看看
        </Text>
      </View>
    </View>
  )
}
```

- [ ] **Step 5.3:** `src/pages/share/index.scss`
```scss
.share {
  min-height: 100vh;
  padding: 48rpx 32rpx;
  box-sizing: border-box;
}

.share.theme-tegami {
  --bg: #f7f1e3;
  --ink: #2a2522;
  background: var(--bg);
  color: var(--ink);
}

.share-empty {
  padding: 80rpx 32rpx;
  text-align: center;
  opacity: 0.6;
  font-size: 26rpx;
}

.share-head {
  margin-bottom: 32rpx;
  text-align: center;
}
.sh-label {
  font-size: 28rpx;
  letter-spacing: 2rpx;
  opacity: 0.75;
}

.share-card {
  padding: 32rpx;
  border: 2rpx solid currentColor;
  border-radius: 16rpx;
  margin-bottom: 56rpx;
}
.sc-name {
  display: block;
  font-size: 40rpx;
  font-weight: 600;
}
.sc-meta {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  opacity: 0.6;
}
.sc-dest {
  display: flex; gap: 12rpx;
  margin-top: 16rpx;
  flex-wrap: wrap;
}
.sc-dest-chip {
  padding: 4rpx 14rpx;
  border: 2rpx solid currentColor;
  border-radius: 999rpx;
  font-size: 22rpx;
  opacity: 0.75;
}

.share-foot {
  display: flex; flex-direction: column;
  align-items: center;
  gap: 16rpx;
}
.share-btn {
  width: 100%;
  background: var(--ink);
  color: var(--bg);
  text-align: center;
  padding: 28rpx 0;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 500;
}
.share-btn.disabled { opacity: 0.5; }
.share-back {
  margin-top: 8rpx;
  font-size: 24rpx;
  opacity: 0.55;
}
```

- [ ] **Step 5.4:** 提交
```bash
git add src/pages/share/
git commit -m "feat(share): add share landing page (readonly clone / join collab)"
```

---

## Task 6: 注册 share 页

**Files:**
- Modify: `src/app.config.ts`

- [ ] **Step 6.1:** 加 `pages/share/index` 到 pages 数组
```ts
export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/new-trip/index',
    'pages/trip/index',
    'pages/share/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f7f1e3',
    navigationBarTitleText: '行册',
    navigationBarTextStyle: 'black',
  },
  lazyCodeLoading: 'requiredComponents',
})
```

- [ ] **Step 6.2:** 提交
```bash
git add src/app.config.ts
git commit -m "feat: register share page"
```

---

## Task 7: 改造 home 页 share 流程

**Files:**
- Modify: `src/pages/home/index.tsx`

- [ ] **Step 7.1:** 在 home 页 import 区添加
```tsx
import ShareTypeSheet from '../../components/ShareTypeSheet'
import { buildShareMessage, promptUserToShare } from '../../utils/share'
import { smartDeleteTrip } from '../../utils/db'
import type { ShareKind } from '../../utils/cloud'
```

- [ ] **Step 7.2:** 加 state
```tsx
const [shareTrip, setShareTrip] = useState<Trip | null>(null)
const [sharePayload, setSharePayload] = useState<{ title: string; path: string } | null>(null)
```

- [ ] **Step 7.3:** 替换 handleAction 里 `'share'` 分支
```tsx
if (action === 'share') {
  setShareTrip(t)
  return
}
```

- [ ] **Step 7.4:** 替换 `'delete'` 分支为智能删除
```tsx
if (action === 'delete') {
  const isOwner = t._openid === openid
  const collabCount = (t.collaborators || []).length
  const title = isOwner ? (collabCount > 0 ? '删除攻略？' : '删除攻略？') : '退出协作？'
  const content = isOwner
    ? collabCount > 0
      ? `还有 ${collabCount} 位协作者将失去访问，确认删除？`
      : `「${t.name}」将被永久删除`
    : `退出后，「${t.name}」不再出现在你的攻略册中（原作者仍可见）`
  const confirmText = isOwner ? '删除' : '退出'
  const res = await Taro.showModal({ title, content, confirmText, confirmColor: '#c43d3d' })
  if (res.confirm) {
    const action = await smartDeleteTrip(t, openid)
    Taro.showToast({ title: action === 'delete' ? '已删除' : '已退出', icon: 'success' })
  }
  return
}
```

- [ ] **Step 7.5:** 加分享流程方法
```tsx
const onSelectShareKind = async (kind: ShareKind) => {
  if (!shareTrip) return
  try {
    const payload = await buildShareMessage(shareTrip._id, shareTrip.name, kind)
    setSharePayload({ title: payload.title, path: payload.path })
    setShareTrip(null)
    promptUserToShare()
  } catch (e) {
    console.error('[share]', e)
    Taro.showToast({ title: '生成分享失败', icon: 'error' })
  }
}
```

- [ ] **Step 7.6:** 在 home 页 component 末尾（return 内的 ActionSheet 后面）添加
```tsx
<ShareTypeSheet
  open={!!shareTrip}
  onClose={() => setShareTrip(null)}
  onSelect={onSelectShareKind}
/>
```

- [ ] **Step 7.7:** 添加 `onShareAppMessage` 配置（home 页 default export 顶部 / 同文件添加）

在 `Home` 组件外加：
```tsx
import { useShareAppMessage } from '@tarojs/taro'
```

并在 `Home` 组件内（任意位置）加：
```tsx
useShareAppMessage(() => {
  if (sharePayload) {
    return {
      title: sharePayload.title,
      path: sharePayload.path,
    }
  }
  return {
    title: '行册 · 旅行攻略册',
    path: '/pages/home/index',
  }
})
```

- [ ] **Step 7.8:** 类型检查
```bash
npx tsc --noEmit
```

- [ ] **Step 7.9:** 提交
```bash
git add src/pages/home/index.tsx
git commit -m "feat(home): wire share kind sheet + smart delete + onShare hook"
```

---

## Task 8: trip 页头部 + 分享 + 智能删除

**Files:**
- Modify: `src/pages/trip/index.tsx`

- [ ] **Step 8.1:** 在 import 区添加
```tsx
import { useShareAppMessage } from '@tarojs/taro'
import CollaboratorsBar from '../../components/CollaboratorsBar'
import ShareTypeSheet from '../../components/ShareTypeSheet'
import TripActionSheet, { type TripAction } from '../../components/TripActionSheet'
import { buildShareMessage, promptUserToShare } from '../../utils/share'
import { smartDeleteTrip, renameTrip, copyTripLocally } from '../../utils/db'
import type { ShareKind } from '../../utils/cloud'
```

- [ ] **Step 8.2:** 修改 `TripBody` 加 state
```tsx
const [actionOpen, setActionOpen] = useState(false)
const [shareOpen, setShareOpen] = useState(false)
const [sharePayload, setSharePayload] = useState<{ title: string; path: string } | null>(null)
const { openid } = useTripStore()
const isOwner = state.trip ? state.trip._openid === openid : false
```

(注：`openid` 从 useTripStore 的 context 拿；trip-store.tsx 已 export 这个字段。)

- [ ] **Step 8.3:** 修改 head 部分，加协作者条和菜单按钮
```tsx
<View className='trip-head'>
  <View className='th-row'>
    <Text className='th-name'>{t.name}</Text>
    <View className='th-menu' onClick={() => setActionOpen(true)}>⋯</View>
  </View>
  <Text className='th-meta'>
    {t.startDate} → {t.endDate} · {t.pax} 人
  </Text>
  <CollaboratorsBar
    collaborators={t.collaborators || []}
    isOwner={isOwner}
  />
</View>
```

- [ ] **Step 8.4:** 加 action handler
```tsx
const handleAction = async (action: TripAction) => {
  if (!t) return

  if (action === 'rename') {
    const res = await Taro.showModal({
      title: '重命名', editable: true,
      placeholderText: '攻略名', content: t.name,
    })
    if (res.confirm && res.content?.trim()) {
      await renameTrip(t._id, res.content.trim(), openid)
    }
    return
  }
  if (action === 'copy') {
    const newId = await copyTripLocally(t._id, openid)
    Taro.showToast({ title: '已复制', icon: 'success' })
    setTimeout(() => Taro.redirectTo({ url: `/pages/trip/index?id=${newId}` }), 800)
    return
  }
  if (action === 'delete') {
    const collabCount = (t.collaborators || []).length
    const title = isOwner ? '删除攻略？' : '退出协作？'
    const content = isOwner
      ? (collabCount > 0
          ? `还有 ${collabCount} 位协作者将失去访问，确认删除？`
          : `「${t.name}」将被永久删除`)
      : `退出后，「${t.name}」不再出现在你的攻略册中`
    const confirmText = isOwner ? '删除' : '退出'
    const res = await Taro.showModal({ title, content, confirmText, confirmColor: '#c43d3d' })
    if (res.confirm) {
      await smartDeleteTrip(t, openid)
      Taro.showToast({ title: isOwner ? '已删除' : '已退出', icon: 'success' })
      setTimeout(() => Taro.reLaunch({ url: '/pages/home/index' }), 600)
    }
    return
  }
  if (action === 'share') {
    setShareOpen(true)
    return
  }
}

const onSelectShareKind = async (kind: ShareKind) => {
  if (!t) return
  if (!isOwner) {
    Taro.showToast({ title: '仅 owner 可分享', icon: 'none' })
    return
  }
  try {
    const payload = await buildShareMessage(t._id, t.name, kind)
    setSharePayload({ title: payload.title, path: payload.path })
    setShareOpen(false)
    promptUserToShare()
  } catch (e) {
    console.error(e)
    Taro.showToast({ title: '生成分享失败', icon: 'error' })
  }
}

useShareAppMessage(() => {
  if (sharePayload) return sharePayload
  return { title: t ? `行册 · ${t.name}` : '行册', path: '/pages/home/index' }
})
```

- [ ] **Step 8.5:** 在 return 中加 ActionSheet + ShareTypeSheet（紧邻 trip-content 后）
```tsx
<TripActionSheet
  open={actionOpen}
  tripName={t.name}
  onSelect={handleAction}
  onClose={() => setActionOpen(false)}
/>

<ShareTypeSheet
  open={shareOpen}
  onClose={() => setShareOpen(false)}
  onSelect={onSelectShareKind}
/>
```

- [ ] **Step 8.6:** 给 trip 页样式补上头部菜单按钮（追加到 index.scss）
```scss
.th-row { display: flex; align-items: center; justify-content: space-between; }
.th-menu {
  width: 60rpx; height: 60rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 40rpx;
  opacity: 0.6;
}
```

- [ ] **Step 8.7:** 类型检查
```bash
npx tsc --noEmit
```

- [ ] **Step 8.8:** 提交
```bash
git add src/pages/trip/
git commit -m "feat(trip): collaborators bar + share menu + owner-aware delete"
```

---

## Task 9: 修改 `pages/share/index` 接 onShareAppMessage（防止分享给二级好友时穿透）

**Files:**
- Modify: `src/pages/share/index.tsx`

- [ ] **Step 9.1:** 在 SharePage import 区加 `useShareAppMessage`
```tsx
import { useShareAppMessage } from '@tarojs/taro'
```

- [ ] **Step 9.2:** 在 SharePage 组件内（开头）加
```tsx
useShareAppMessage(() => ({
  title: '行册 · 旅行攻略册',
  path: '/pages/home/index',
}))
```

> 阻止收到分享的人再次转发原 token 链接给下游（下游再次进入后用同一 token 可能已失效或泄漏）。

- [ ] **Step 9.3:** 提交
```bash
git add src/pages/share/index.tsx
git commit -m "feat(share): override onShare to home (prevent token leak)"
```

---

## Task 10: 端到端验证

**Files:** 无；纯手动。需 **两个微信开发者工具实例**（或一个真机 + 一个开发者工具）。

- [ ] **Step 10.1:** 实例 A 创建一个 trip"测试分享"，加几个 spots

- [ ] **Step 10.2:** A 进 trip 详情页 → 右上角 ⋯ → ActionSheet → 分享 → ShareTypeSheet 弹出

- [ ] **Step 10.3:** 点"只读分享" → 看到 modal "点击右上角 ... → 转发" → 实际在 IDE 里用 console 看 `wx.shareAppMessage` 的 path（或在右上角 ··· → 转发，会得到分享卡片）

> IDE 模拟分享：点工具栏右上角"模拟器" → 三个点 → 转发 → 选择测试号 → 此时复制分享 path（含 token）

- [ ] **Step 10.4:** 实例 B（用另一个测试 openid）打开同一 path：
- 看到 share 落地页
- 标题"🔒 一份只读攻略"
- 攻略卡片
- 底部"复制到我的攻略册"按钮

- [ ] **Step 10.5:** B 点"复制" → toast"已复制" → 跳到 B 的副本 trip 详情页 → 改一项 → A 那边看不到变化（独立副本验证 ✅）

- [ ] **Step 10.6:** A 再分享一次，这次选"邀请协作" → 把 path 给 B → B 在落地页看到"👥 协作邀请"+ "加入协作"按钮

- [ ] **Step 10.7:** B 点"加入协作" → toast"已加入协作" → 跳 trip 页 → A 那边 collaborators 数组多出 B 的头像

- [ ] **Step 10.8:** A 改 spot 名 → B 几秒内看到 ✅；B 改 → A 看到 ✅

- [ ] **Step 10.9:** B 在 home 长按该协作 trip → 删除 → modal 标题"退出协作？" → 确认 → B 列表少一条；A 还能看到该 trip，且 collaborators 数组少了 B

- [ ] **Step 10.10:** B 重新接受协作链接，再次加入

- [ ] **Step 10.11:** A 在 home 长按 trip → 删除 → modal "还有 1 位协作者将失去访问，确认删除？" → 确认 → A 删除；B 的 trip 也消失（B 端 watch 应该会推送 doc 删除事件，list 自动刷新）

- [ ] **Step 10.12:** 提交杂项
```bash
git status
git add -A && git commit -m "chore(phase5): verification passed" 2>/dev/null || true
```

---

## 11. Phase 5 验收

- 11.1 ✅ trip 头部右上角 ⋯ 弹 ActionSheet，包含 4 项
- 11.2 ✅ 分享 → ShareTypeSheet 二选一（只读 / 协作）
- 11.3 ✅ 生成 token → modal 提示用户点右上角转发
- 11.4 ✅ 接收方落地页正确显示 trip 预览
- 11.5 ✅ 只读：B 复制后独立编辑，A 不受影响
- 11.6 ✅ 协作：B 加入后看到同一份；A/B 互改实时同步（< 3s）
- 11.7 ✅ B 删除协作 trip 实际是"退出"，A 还能看到
- 11.8 ✅ A 删除协作 trip 弹"还有 N 位协作者" 警告，确认后真删
- 11.9 ✅ Owner ∪ collaborator 在 home 列表中均可见
- 11.10 ✅ trip 头部协作者头像条显示正确（owner 视角 / 协作者视角）
- 11.11 ✅ share 页 onShare 不会泄漏 token

全部 ✅ 后，v1 完成。
