# 协作可见性修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复"owner 看不到协作者 / 协作者首页看不到协作 trip"两个 bug;给首页协作 trip 卡片加角标和原作者信息;给协作者头像栏加点击查看名单。

**Architecture:** 新增 `list-my-trips` 云函数(admin 权限绕过 client 规则),trip 文档冗余 owner nickname/avatar 字段,首页混排显示但协作 trip 卡片加角标,新增 `me-store` 管理当前用户,新增 `CollaboratorsSheet` 组件展示完整名单。

**Tech Stack:** Taro + React + 微信云开发;无单元测试基建,验证全部手动 + 微信开发者工具。

参考 spec: `docs/superpowers/specs/2026-05-21-collaboration-fixes-design.md`

---

## 与另一个 plan 的关系

另一个待实施 plan `docs/superpowers/plans/2026-05-21-map-view.md` 也会修改 `src/pages/trip/index.tsx`,但**改动区域不冲突**:
- 地图 plan: `VIEWS` 数组 + 视图渲染分支
- 本 plan: import 段 + CollaboratorsBar 渲染 + 新增 useDidShow + 挂载 CollaboratorsSheet

执行顺序无所谓。两个 plan 串行执行时,本 plan 的 trip/index.tsx edit 用**代码语义定位**(以"在 `<CollaboratorsBar` 标签处替换"等方式描述)而非行号,以免对方 plan 先合并后行号变化导致 edit 失败。

---

## 文件结构

| 路径 | 操作 | 责任 |
| --- | --- | --- |
| `src/types/trip.ts` | 改 | Trip 加 ownerNickname/ownerAvatarUrl 可选字段 |
| `cloudfunctions/ensure-user/index.js` | 改 | 返回值扩展为 `{ openid, nickname, avatarUrl }` |
| `src/store/me-store.tsx` | 新 | 当前用户 Provider/hook,首页/new-trip 复用 |
| `src/pages/new-trip/index.tsx` | 改 | useMe 拿 nickname/avatarUrl,传入 createTrip input |
| `cloudfunctions/list-my-trips/index.js` | 新 | admin 权限查 owner∪collaborator trips |
| `cloudfunctions/list-my-trips/package.json` | 新 | 标准云函数 manifest |
| `src/utils/db.ts` | 改 | `listMyTrips` 改走云函数;删除 `watchMyTrips` |
| `src/pages/home/index.tsx` | 改 | 接 me-store;去除 watcher;协作卡片角标 + 原作者行 |
| `src/pages/home/index.scss` | 改 | `.tc-badge` 角标 + `.tc-owner` 原作者行样式 |
| `src/components/CollaboratorsSheet/index.tsx` | 新 | 点头像后弹出的全员名单 sheet |
| `src/components/CollaboratorsSheet/index.scss` | 新 | sheet 样式 |
| `src/components/CollaboratorsBar/index.tsx` | 改 | 加 `onTap` prop,外层 View 加 onClick |
| `src/pages/trip/index.tsx` | 改 | 传 ownerNickname 给 bar,挂 sheet,useDidShow 刷新 |

云端 manual(非代码):
- 上传 `list-my-trips`、`ensure-user` 云函数
- (可选)同步云控制台 trips 集合 read/write 规则,去掉 `auth.openid` 引号

---

### Task 1: Trip 类型加 owner 冗余字段

**Files:**
- Modify: `src/types/trip.ts`

- [ ] **Step 1: 修改 Trip interface**

把原来的:

```ts
export interface Trip {
  _id: string
  _openid: string
  ownerOpenid: string

  name: string
```

改成:

```ts
export interface Trip {
  _id: string
  _openid: string
  ownerOpenid: string
  ownerNickname?: string
  ownerAvatarUrl?: string

  name: string
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新报错(可选字段不会破坏现有调用方)。

- [ ] **Step 3: 提交**

```bash
git add src/types/trip.ts
git commit -m "feat(types): add owner nickname/avatar to Trip"
```

---

### Task 2: ensure-user 云函数扩展返回值

**Files:**
- Modify: `cloudfunctions/ensure-user/index.js`

- [ ] **Step 1: 改返回语句**

把文件末尾的 `return { openid: OPENID }` 替换为:

```js
  // 重新拉一次以拿到最新合并后的 user doc
  const fresh = await db.collection('users').doc(OPENID).get().catch(() => null)
  const u = (fresh && fresh.data) || {}
  return {
    openid: OPENID,
    nickname: u.nickname || nickname || '行册旅人',
    avatarUrl: u.avatarUrl || avatarUrl || '',
  }
}
```

(替换函数末尾两个字符 `}` 之前的 `return { openid: OPENID }` 行 —— 注意保留外层 `}`)

完整 main 函数最终样子:

```js
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    throw new Error('OPENID missing — not called from miniprogram')
  }
  const { nickname, avatarUrl } = event || {}
  const db = cloud.database()
  const now = Date.now()

  const existing = await db.collection('users').doc(OPENID).get().catch(() => null)

  if (existing && existing.data) {
    await db.collection('users').doc(OPENID).update({
      data: {
        nickname: nickname || existing.data.nickname || '',
        avatarUrl: avatarUrl || existing.data.avatarUrl || '',
        lastSeenAt: now,
      }
    })
  } else {
    await db.collection('users').add({
      data: {
        _id: OPENID,
        nickname: nickname || '行册旅人',
        avatarUrl: avatarUrl || '',
        createdAt: now,
        lastSeenAt: now,
      }
    })
  }

  const fresh = await db.collection('users').doc(OPENID).get().catch(() => null)
  const u = (fresh && fresh.data) || {}
  return {
    openid: OPENID,
    nickname: u.nickname || nickname || '行册旅人',
    avatarUrl: u.avatarUrl || avatarUrl || '',
  }
}
```

- [ ] **Step 2: 上传云函数(manual,在 IDE 操作时执行)**

在微信开发者工具中右键 `cloudfunctions/ensure-user` → "上传并部署:云端安装依赖(不上传 node_modules)"。

如果当前不在 IDE 里写代码,跳过此 step,在最终验证前做。

- [ ] **Step 3: 提交**

```bash
git add cloudfunctions/ensure-user/index.js
git commit -m "feat(ensure-user): return nickname and avatarUrl"
```

---

### Task 3: me-store

**Files:**
- Create: `src/store/me-store.tsx`

- [ ] **Step 1: 写组件**

```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import Taro from '@tarojs/taro'

export interface Me {
  openid: string
  nickname: string
  avatarUrl: string
}

interface Ctx {
  me: Me | null
  refresh: () => Promise<void>
}

const MeContext = createContext<Ctx | null>(null)

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)

  const refresh = async () => {
    try {
      // @ts-ignore Taro.cloud
      const r = await Taro.cloud.callFunction({
        name: 'ensure-user',
        data: { nickname: '行册旅人', avatarUrl: '' },
      })
      const result = (r as any).result || {}
      setMe({
        openid: result.openid,
        nickname: result.nickname || '行册旅人',
        avatarUrl: result.avatarUrl || '',
      })
    } catch (e) {
      console.error('[me-store] ensure-user failed', e)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <MeContext.Provider value={{ me, refresh }}>{children}</MeContext.Provider>
  )
}

export function useMe(): Ctx {
  const ctx = useContext(MeContext)
  if (!ctx) throw new Error('useMe must be used within MeProvider')
  return ctx
}
```

- [ ] **Step 2: 提交**

```bash
git add src/store/me-store.tsx
git commit -m "feat(store): add me-store for current user info"
```

---

### Task 4: 在 app 根挂载 MeProvider

**Files:**
- Modify: `src/app.tsx`

- [ ] **Step 1: 读 app.tsx 当前内容**

先 `cat src/app.tsx` 看现在的结构。预期是一个返回 `props.children` 的简单组件。

- [ ] **Step 2: 在根组件外裹一层 MeProvider**

在 import 段加:

```tsx
import { MeProvider } from './store/me-store'
```

把 `App` 组件的 return 部分(原本可能是 `return this.props.children` 或 `return props.children`)改为:

```tsx
return <MeProvider>{this.props.children}</MeProvider>
```

(class 写法用 `this.props.children`;function 写法用 `props.children`。改成函数版本时记得保留原签名)

如果 `app.tsx` 现在是 class 组件且 render 形如:

```tsx
render () { return this.props.children }
```

改为:

```tsx
render () { return <MeProvider>{this.props.children}</MeProvider> }
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无报错。

- [ ] **Step 4: 提交**

```bash
git add src/app.tsx
git commit -m "feat(app): mount MeProvider at root"
```

---

### Task 5: new-trip 页接 me-store,传 owner info 给 createTrip

**Files:**
- Modify: `src/pages/new-trip/index.tsx`

- [ ] **Step 1: 替换 ensure-user 直接调用为 useMe**

在 import 段加:

```tsx
import { useMe } from '../../store/me-store'
```

把组件顶部的:

```tsx
const [openid, setOpenid] = useState('')
const [submitting, setSubmitting] = useState(false)

useEffect(() => {
  // @ts-ignore Taro.cloud
  Taro.cloud.callFunction({
    name: 'ensure-user',
    data: { nickname: '行册旅人', avatarUrl: '' }
  }).then((r: any) => setOpenid(r.result.openid))
}, [])
```

替换为:

```tsx
const { me } = useMe()
const openid = me?.openid || ''
const [submitting, setSubmitting] = useState(false)
```

(去掉 useState + useEffect)

清理 imports: 删掉不再需要的 `useEffect`(确认 useState 还在用,在);如果 Taro 只在 `Taro.cloud` 里用,Taro 还要保留供 `Taro.showToast` 等使用,保留。

- [ ] **Step 2: submit 时把 owner info 传入**

定位到 submit 函数里的:

```tsx
input.ownerOpenid = openid
const tripId = await createTrip(input)
```

替换为:

```tsx
input.ownerOpenid = openid
input.ownerNickname = me?.nickname || '行册旅人'
input.ownerAvatarUrl = me?.avatarUrl || ''
const tripId = await createTrip(input)
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无报错。`NewTripInput` 因为 `Omit<Trip, ...>` 自动包含可选的 ownerNickname/ownerAvatarUrl,直接赋值合法。

- [ ] **Step 4: 提交**

```bash
git add src/pages/new-trip/index.tsx
git commit -m "feat(new-trip): persist owner nickname/avatar with new trips"
```

---

### Task 6: list-my-trips 云函数

**Files:**
- Create: `cloudfunctions/list-my-trips/index.js`
- Create: `cloudfunctions/list-my-trips/package.json`

- [ ] **Step 1: package.json**

```json
{
  "name": "list-my-trips",
  "version": "1.0.0",
  "description": "List trips where current user is owner or collaborator",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

(版本号参照 `cloudfunctions/ensure-user/package.json` —— 若那边是别的版本号,跟齐它。若不存在 package.json,跳过此 step 也行,wxcloud 会用默认。)

- [ ] **Step 2: index.js**

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const db = cloud.database()
  const _ = db.command

  const res = await db.collection('trips')
    .where(_.or([
      { _openid: OPENID },
      { 'collaborators.openid': OPENID },
    ]))
    .orderBy('updatedAt', 'desc')
    .limit(100)
    .get()

  return { trips: res.data || [] }
}
```

- [ ] **Step 3: 上传(manual)**

在微信开发者工具右键 `cloudfunctions/list-my-trips` → 上传并部署。

如不在 IDE 里写,跳过,验证前再上传。

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/list-my-trips/
git commit -m "feat(cloudfn): list-my-trips with admin perm"
```

---

### Task 7: db.ts — listMyTrips 走云函数 + 删除 watchMyTrips

**Files:**
- Modify: `src/utils/db.ts`

- [ ] **Step 1: 替换 listMyTrips 实现**

定位到 `listMyTrips` 函数,替换整个函数体为:

```ts
/**
 * 获取当前用户拥有的所有 trips(owner ∪ collaborator)。
 * 走 list-my-trips 云函数以绕过 client 端权限规则限制。
 */
export async function listMyTrips(_openid: string): Promise<Trip[]> {
  const r = await (Taro as any).cloud.callFunction({ name: 'list-my-trips' })
  const trips = ((r && r.result && r.result.trips) || []) as Trip[]
  return trips
}
```

(参数仍保留 `_openid` 兼容调用方,但下划线前缀表明不用)

- [ ] **Step 2: 删除 watchMyTrips**

整个 `watchMyTrips` 函数及其上方 JSDoc 注释一并删除。

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 一个新报错,来自 `src/pages/home/index.tsx` 里 `import { listMyTrips, watchMyTrips, ... } from '../../utils/db'` —— watchMyTrips 不再导出。Task 8 会修。

- [ ] **Step 4: 提交**

```bash
git add src/utils/db.ts
git commit -m "feat(db): listMyTrips via cloud function, drop watchMyTrips"
```

---

### Task 8: home 页 — useMe + 去 watcher + 协作角标

**Files:**
- Modify: `src/pages/home/index.tsx`

- [ ] **Step 1: import 替换**

把:

```tsx
import { listMyTrips, watchMyTrips, renameTrip, copyTripLocally, smartDeleteTrip } from '../../utils/db'
```

替换为:

```tsx
import { listMyTrips, renameTrip, copyTripLocally, smartDeleteTrip } from '../../utils/db'
import { useMe } from '../../store/me-store'
```

把 `Image` 加到 `@tarojs/components` 的 import 里(用来渲染原作者头像):

```tsx
import { View, Text, Button, Image } from '@tarojs/components'
```

- [ ] **Step 2: 替换 openid useEffect 块为 useMe**

把组件顶部的:

```tsx
const [openid, setOpenid] = useState<string>('')

// 获取当前用户 openid（通过 ensure-user 同步）
useEffect(() => {
  // 调用 ensure-user 拿 openid
  // @ts-ignore Taro.cloud
  Taro.cloud.callFunction({
    name: 'ensure-user',
    data: { nickname: '行册旅人', avatarUrl: '' }
  }).then((r: any) => {
    setOpenid(r.result.openid)
  }).catch(e => {
    console.error('ensure-user failed', e)
  })
}, [])
```

替换为:

```tsx
const { me } = useMe()
const openid = me?.openid || ''
```

- [ ] **Step 3: 替换 watcher useEffect 为单次 list**

把:

```tsx
// 初次拉 + watch
useEffect(() => {
  if (!openid) return
  let cancelled = false
  listMyTrips(openid).then(list => {
    if (cancelled) return
    setTrips(list)
    setLoading(false)
  })
  const watcher = watchMyTrips(openid, list => {
    if (cancelled) return
    setTrips(list)
    setLoading(false)
  })
  return () => {
    cancelled = true
    watcher.close()
  }
}, [openid])
```

替换为:

```tsx
useEffect(() => {
  if (!openid) return
  let cancelled = false
  listMyTrips(openid)
    .then(list => { if (!cancelled) { setTrips(list); setLoading(false) } })
    .catch(e => {
      console.error('[home] listMyTrips failed', e)
      Taro.showToast({ title: '加载失败', icon: 'none' })
      if (!cancelled) setLoading(false)
    })
  return () => { cancelled = true }
}, [openid])
```

- [ ] **Step 4: home-list 卡片渲染加协作角标 + 原作者行**

定位到现有的 `{trips.map(t => (` 区块,完整替换该 map 回调:

```tsx
{trips.map(t => {
  const isCollab = t._openid !== openid
  return (
    <View
      key={t._id}
      className='trip-card'
      onClick={() => Taro.navigateTo({ url: `/pages/trip/index?id=${t._id}` })}
      onLongPress={() => setActionTrip(t)}
    >
      {isCollab && <View className='tc-badge'>协作</View>}
      <Text className='tc-name'>{t.name}</Text>
      <Text className='tc-meta'>
        {fmtDateShort(t.startDate)} → {fmtDateShort(t.endDate)} · {tripSummary(t.startDate, t.endDate, t.pax)}
      </Text>
      <View className='tc-dest'>
        {t.destinations.map((d, i) => (
          <Text key={`${d.adcode || 'na'}-${i}`} className='tc-dest-chip'>{d.name}</Text>
        ))}
      </View>
      {isCollab && (
        <View className='tc-owner'>
          {t.ownerAvatarUrl
            ? <Image className='tc-owner-avatar' src={t.ownerAvatarUrl} mode='aspectFill' />
            : <View className='tc-owner-avatar tc-owner-avatar-fallback'>
                <Text>{(t.ownerNickname || '?').slice(0, 1)}</Text>
              </View>
          }
          <Text className='tc-owner-name'>来自 {t.ownerNickname || '未知'}</Text>
        </View>
      )}
    </View>
  )
})}
```

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无报错。

- [ ] **Step 6: 提交**

```bash
git add src/pages/home/index.tsx
git commit -m "feat(home): collab badge with owner info, single-fetch via cloud fn"
```

---

### Task 9: home 页样式

**Files:**
- Modify: `src/pages/home/index.scss`

- [ ] **Step 1: 在文件末尾追加**

```scss
.trip-card { position: relative; }

.tc-badge {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  font-size: 20rpx;
  font-weight: 600;
  padding: 4rpx 12rpx;
  background: var(--ink, #2c2c2c);
  color: var(--bg, #f7f1e3);
  border-radius: 8rpx;
  letter-spacing: 2rpx;
}

.tc-owner {
  display: flex;
  align-items: center;
  margin-top: 12rpx;
  font-size: 22rpx;
  opacity: 0.65;
}
.tc-owner-avatar {
  width: 32rpx;
  height: 32rpx;
  border-radius: 999rpx;
  margin-right: 8rpx;
  background: rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 18rpx;
  font-weight: 600;
}
.tc-owner-avatar-fallback {
  background: rgba(0,0,0,0.15);
}
.tc-owner-name {
  font-size: 22rpx;
}
```

(`.trip-card { position: relative; }` 单独一行确保角标定位生效。如果文件里已经有 `.trip-card` 块,改为追加 `position: relative;` 到那个块里;不要重复声明)

- [ ] **Step 2: 提交**

```bash
git add src/pages/home/index.scss
git commit -m "feat(home): styles for collab badge and owner row"
```

---

### Task 10: CollaboratorsSheet 组件

**Files:**
- Create: `src/components/CollaboratorsSheet/index.tsx`
- Create: `src/components/CollaboratorsSheet/index.scss`

- [ ] **Step 1: index.tsx**

```tsx
import { View, Text, Image } from '@tarojs/components'
import type { Collaborator } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  collaborators: Collaborator[]
  ownerNickname?: string
  ownerAvatarUrl?: string
  onClose: () => void
}

export default function CollaboratorsSheet({
  open, collaborators, ownerNickname, ownerAvatarUrl, onClose,
}: Props) {
  if (!open) return null

  const renderAvatar = (avatarUrl: string | undefined, nickname: string | undefined, fallbackKey: string) => (
    avatarUrl
      ? <Image key={fallbackKey} className='cs-avatar' src={avatarUrl} mode='aspectFill' />
      : <View key={fallbackKey} className='cs-avatar cs-avatar-fallback'>
          <Text>{(nickname || '?').slice(0, 1)}</Text>
        </View>
  )

  return (
    <View className='cs-mask' onClick={onClose}>
      <View className='cs-sheet' onClick={(e) => e.stopPropagation()}>
        <View className='cs-title'>协作成员</View>

        <View className='cs-row'>
          {renderAvatar(ownerAvatarUrl, ownerNickname, 'owner')}
          <View className='cs-info'>
            <Text className='cs-name'>{ownerNickname || '原作者'}</Text>
            <Text className='cs-tag'>创建者</Text>
          </View>
        </View>

        {collaborators.map(c => (
          <View key={c.openid} className='cs-row'>
            {renderAvatar(c.avatarUrl, c.nickname, c.openid)}
            <View className='cs-info'>
              <Text className='cs-name'>{c.nickname || '匿名旅人'}</Text>
              <Text className='cs-tag'>
                {new Date(c.joinedAt).toLocaleDateString()} 加入
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
```

- [ ] **Step 2: index.scss**

```scss
.cs-mask {
  position: fixed;
  left: 0; right: 0; top: 0; bottom: 0;
  background: rgba(0,0,0,0.32);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}
.cs-sheet {
  width: 100%;
  background: var(--bg, #f7f1e3);
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 32rpx 48rpx;
  box-sizing: border-box;
  max-height: 70vh;
  overflow-y: auto;
}
.cs-title {
  font-size: 30rpx;
  font-weight: 700;
  margin-bottom: 24rpx;
}
.cs-row {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 2rpx solid rgba(0,0,0,0.06);
}
.cs-row:last-child {
  border-bottom: none;
}
.cs-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 999rpx;
  margin-right: 20rpx;
  background: rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 24rpx;
  font-weight: 600;
}
.cs-avatar-fallback {
  background: rgba(0,0,0,0.15);
}
.cs-info {
  display: flex;
  flex-direction: column;
}
.cs-name {
  font-size: 28rpx;
  font-weight: 600;
}
.cs-tag {
  font-size: 22rpx;
  opacity: 0.55;
  margin-top: 4rpx;
}
```

- [ ] **Step 3: 提交**

```bash
git add src/components/CollaboratorsSheet/
git commit -m "feat(component): CollaboratorsSheet for showing full member list"
```

---

### Task 11: CollaboratorsBar 加 onTap

**Files:**
- Modify: `src/components/CollaboratorsBar/index.tsx`

- [ ] **Step 1: 替换整个文件**

```tsx
import { View, Text, Image } from '@tarojs/components'
import type { Collaborator } from '../../types/trip'
import './index.scss'

interface Props {
  collaborators: Collaborator[]
  ownerNickname?: string
  isOwner: boolean
  onTap?: () => void
}

export default function CollaboratorsBar({ collaborators, ownerNickname, isOwner, onTap }: Props) {
  if (collaborators.length === 0 && isOwner) return null

  return (
    <View className='collab-bar' onClick={onTap}>
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

(变更仅: 加 `onTap?: () => void` prop;外层 `<View className='collab-bar'>` 加 `onClick={onTap}`)

- [ ] **Step 2: 提交**

```bash
git add src/components/CollaboratorsBar/index.tsx
git commit -m "feat(collab-bar): clickable to open member sheet"
```

---

### Task 12: trip 页 — 传 ownerNickname + 挂 sheet + useDidShow 刷新

**Files:**
- Modify: `src/pages/trip/index.tsx`

- [ ] **Step 1: import 段加 useDidShow / CollaboratorsSheet / 改 state hook**

定位 `import` 段。

把:

```tsx
import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
```

改为(加 useShareAppMessage 边上的 useDidShow 已经存在则跳过加;此处只补充新模块):

```tsx
import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage, useDidShow } from '@tarojs/taro'
```

(如果 useDidShow 已经在 import 里,Step 1 不变此行)

新增 CollaboratorsSheet import,放在 `import CollaboratorsBar` 同区域:

```tsx
import CollaboratorsBar from '../../components/CollaboratorsBar'
import CollaboratorsSheet from '../../components/CollaboratorsSheet'
```

- [ ] **Step 2: 在 TripBody 组件里加 sheet 开关 state**

定位到 `function TripBody()` 内部,与其他 useState 同级,加:

```tsx
const [collabSheetOpen, setCollabSheetOpen] = useState(false)
```

- [ ] **Step 3: 加 useDidShow 触发 trip 重拉**

trip-store 已经监听单 doc 的实时变更(watch),所以本来 owner 视角下协作者加入会自动 push。但作为兜底,加一个 useDidShow 让用户从其他页面回来时手动刷一遍 trip。

实施方式:trip-store 已经把 `getTrip` 包装在 Provider 内部,无外部 refresh 钩子。最小改动:**跳过此 step**,信任 watch。

若实际验证(Task 13 Step 5)发现 owner 还是看不到新增协作者,**再回来这里**给 trip-store 加 `refresh` 方法,或在 TripBody 用 useDidShow 直接调用 store 的某种重载机制。本 plan 不预先加,因为可能不需要。

(本 step 仅为说明,不产生代码改动)

- [ ] **Step 4: 改 CollaboratorsBar 渲染,加 sheet 挂载**

定位到当前的:

```tsx
<CollaboratorsBar
  collaborators={t.collaborators || []}
  isOwner={isOwner}
/>
```

替换为:

```tsx
<CollaboratorsBar
  collaborators={t.collaborators || []}
  ownerNickname={t.ownerNickname}
  isOwner={isOwner}
  onTap={() => setCollabSheetOpen(true)}
/>
```

然后在 trip 页 JSX 的合适位置(推荐放在 `<TripActionSheet>` / `<ShareTypeSheet>` 附近,这俩都是顶层 modal),新增:

```tsx
<CollaboratorsSheet
  open={collabSheetOpen}
  collaborators={t.collaborators || []}
  ownerNickname={t.ownerNickname}
  ownerAvatarUrl={t.ownerAvatarUrl}
  onClose={() => setCollabSheetOpen(false)}
/>
```

具体放置:在 trip 页 return 的最外层 `<View className='trip ...'>` 的结尾位置,跟其他 ActionSheet / ShareTypeSheet 同级。读现有文件确认位置,然后追加这一段。

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无报错。

- [ ] **Step 6: 提交**

```bash
git add src/pages/trip/index.tsx
git commit -m "feat(trip): clickable collab bar with member sheet"
```

---

### Task 13: 手动验证

**Files:** 无改动。

- [ ] **Step 1: 上传两个云函数(若 Task 2/6 没在 IDE 里上传)**

在微信开发者工具中:
- 右键 `cloudfunctions/ensure-user` → 上传并部署
- 右键 `cloudfunctions/list-my-trips` → 上传并部署

- [ ] **Step 2: 启动 dev**

Run: `npm run dev:weapp`
Expected: 编译成功。微信开发者工具自动 reload。

- [ ] **Step 3: 验证新建 trip 携带 owner 字段**

用账号 A 登录 → 新建一个 trip → 在云控制台 trips 集合找到该文档,确认有 `ownerNickname` 和 `ownerAvatarUrl` 字段。

- [ ] **Step 4: 验证 A 自己首页**

回首页 → 看到该 trip 卡片,**无**"协作"角标,**无**"来自"行。

- [ ] **Step 5: 验证协作流程**

A 打开 trip → 点右上 ⋯ → 分享 → 选"邀请协作" → 提示用户右上"..."转发,把卡片发给 B 账号(可以是企业微信内自己另一个号、或微信开发者工具切到第二个测试号)

B 收到卡 → 点 → 落到 share 页 → 点"加入协作" → toast"已加入协作" → 跳到 trip 页。

- [ ] **Step 6: 验证 B 首页(关键 bug 修复点)**

B 退回首页(可以路径: trip 页左上返回,或重新打开小程序)。

Expected:
- 首页列表里**出现**该 trip 卡片
- 卡片右上角有"协作"chip
- destinations 下方有一行"[A 的头像] 来自 [A 的昵称]"
- 长按卡片 ActionSheet 里"删除"显示为"退出协作"

如果没出现,排查顺序:
1. 检查 `list-my-trips` 云函数是否上传成功(云控制台 → 云函数 → 看版本号)
2. 在云控制台 → 云函数 → list-my-trips → 日志,看调用日志中 query 返回的 trips 数组是否包含目标 trip 文档
3. 若云函数返回了但 client 没显示 → 看 console 报错

- [ ] **Step 7: 验证 A 视角看到协作者(关键 bug 修复点)**

A 切回小程序 → 打开同一 trip → trip 详情顶部应该看到 CollaboratorsBar:`协作者 [B 的头像]`。

如果看不到,排查:
1. 在云控制台 trips 集合直接看该文档的 `collaborators` 数组,确认 B 的对象已 push 进去
2. 若数组有,但 UI 不显示 → trip-store 的 watch 没拿到推送(或者 owner 是从缓存进入的)。试杀进程重启小程序 → A 再打开 trip → 应该能看到
3. 若 watch 推送有但还是不渲染 → 检查 `<CollaboratorsBar>` props,看 collaborators 是否真的非空

- [ ] **Step 8: 验证点头像弹 sheet**

A trip 页 → 点 CollaboratorsBar 任意位置 → 底部弹出 sheet → 看到:
- 第一行:A 自己(创建者标签)
- 第二行:B(`<日期> 加入`标签)

点 sheet 外区域或下滑 → 关闭。

- [ ] **Step 9: 验证旧 trip 兼容**

(如果你数据库里有早于本次改动创建的 trip)由 B 加入它的协作 → B 首页应该看到该卡片,"来自 未知" + 默认灰底头像(因为该 trip 没有 ownerNickname/ownerAvatarUrl 字段)。

- [ ] **Step 10: 若任何步骤失败,记录现象 → 回去修对应 Task 的代码 → 重新走通该验证 → 然后再继续。**

- [ ] **Step 11: 最终 push**

```bash
git status
# 应该是 clean
git push -u origin claude/install-superpowers-skill-8d88r
```

---

## 自检要点

1. **createTrip 不会改 schema**:它只是 `data: { ...input, ... }` 写入云端,新字段顺着 input 自动落库,不需要改云控制台 schema(wxcloud 是 NoSQL,字段自由)
2. **list-my-trips 返回的 trip 是否带 ownerNickname**:云函数直接 `.get()`,返回原始文档;只要新建 trip 时写入了,list 自然带回。旧 trip 不带,UI 用 `t.ownerNickname || '未知'` 兜底
3. **B 自己作为协作者**在 trip.collaborators 数组里。`isCollab = t._openid !== openid` 判断的是 owner ≠ me。对 B 来说所有协作 trip 都 isCollab=true ✓
4. **deletion 提示**:home 页 ActionSheet 里"删除/退出"判断已经是 `t._openid === openid`,无需改动
5. **app.tsx 嵌套 Provider**:MeProvider 包裹整个 app 后,所有页面都能用 useMe(包括 share 页 / trip 页,即便它们目前没用,以后扩展也方便)
6. **删除 watchMyTrips 后的影响**:协作者 B 加入后,A 仍然有 trip-store 的 doc-level watch(在 trip 详情页才生效),首页变化需要 useDidShow / 重进。可接受
