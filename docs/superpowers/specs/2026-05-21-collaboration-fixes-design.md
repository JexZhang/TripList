# 协作模式 Bug 修复 + 首页协作角标设计

- 日期: 2026-05-21
- 范围: 修复 owner 视角看不到协作者、协作者首页看不到协作 trip 两个 bug;给首页协作 trip 卡片加角标 + 原作者信息;给协作者栏加点击查看名单
- 状态: Brainstorming → 已通过设计,待落实施计划

## 背景与根因

现状(已经核对代码):

1. **首页**(`src/pages/home/index.tsx`)调 `listMyTrips`/`watchMyTrips`,这俩 client-side 查询条件已经是 `_openid == me OR collaborators.openid == me`,数据层意图正确
2. 但 trips 集合的 wxcloud 安全规则(`docs/superpowers/plans/2026-05-22-行迹-phase1-cloud-skeleton.md` 第 11.3 步)写的是:
   ```
   doc._openid == auth.openid || (doc.collaborators != null && 'auth.openid' in doc.collaborators.openid)
   ```
   `'auth.openid'` 是**字符串字面量**,不是变量。这条规则在 client-side `.where()` 列查询里会过滤掉所有协作 trip(因为没有一个 collaborators.openid 等于字符串 "auth.openid")
3. 单 doc `db.collection('trips').doc(id).get()` 对协作者也走同一条规则,但实测协作者**可以**通过分享链接进入 trip 页编辑 —— 说明云控制台规则要么没生效、要么 wxcloud 对 in 的 quirk 行为让单 doc 通过了。无论如何,client `.where()` 不可靠
4. `CollaboratorsBar` 本身渲染逻辑 OK(owner 有协作者就显示头像);用户报告 owner 看不到,可能是 trip 状态在协作者加入后没及时刷新

## 修复策略

不再依赖云控制台规则的怪异行为,把 list 查询挪到云函数(admin 权限可靠匹配),同时记录推荐的规则修改作为 manual 补丁。schema 上给 trip 冗余 owner 信息,避免每次 list 都要 join users 表。

---

## 1. 新云函数 `list-my-trips`

**位置:** `cloudfunctions/list-my-trips/index.js`

**职责:** 用 admin 权限按 owner 或 collaborator 身份返回当前用户的所有 trips。

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

**Client 改造**(`src/utils/db.ts`):

- `listMyTrips(openid)` 改为 `cloud.callFunction({ name: 'list-my-trips' })`,签名保持(`openid` 参数实际不用,但保留以免改调用处类型 — 或干脆移除参数)
- `watchMyTrips` **删除**(client 端 watch 同样被规则过滤,不可靠)。首页改为:
  - 初次 mount 时调 listMyTrips
  - `useDidShow` 触发刷新(从 new-trip 返回、从 trip 页返回都覆盖到)
  - 不再做实时推送 — 协作者那侧通过自己的下拉 / useDidShow 拉新

**调用方:** 仅 `src/pages/home/index.tsx`。删除 watcher 相关代码块。

## 2. 推荐的云控制台规则修改(manual, 不阻塞代码)

记录在 spec 中,用户手动同步到云控制台:

```json
{
  "read": "doc._openid == auth.openid || auth.openid in doc.collaborators.openid",
  "write": "doc._openid == auth.openid || auth.openid in doc.collaborators.openid"
}
```

去掉 `auth.openid` 的引号;移除冗余的 `doc.collaborators != null` 防护(wxcloud rule 表达式里访问不存在字段不会报错,会被视为 falsy)。

如果改完规则后 client 端的 .where 列查询能直接工作,云函数 list-my-trips 仍然保留作为防御层,不需要回退。

## 3. Trip schema 冗余 owner 信息

**类型变更**(`src/types/trip.ts` 中 `Trip` 接口):

```ts
export interface Trip {
  _id: string
  _openid: string
  ownerOpenid: string
  ownerNickname?: string     // 新增, 冗余字段, 可选(旧文档没有)
  ownerAvatarUrl?: string    // 新增, 同上

  name: string
  // ... 其他字段不变
}
```

**`NewTripInput`** 自动包含这两个字段(因为 `Omit<Trip, ...>` 排除的字段不包含 owner info)。

**写入逻辑**(`src/utils/db.ts` 中 `createTrip` 不需要改 —— 它接 `NewTripInput`,调用方需要把 owner info 传入):

调用 `createTrip` 的地方在 `src/pages/new-trip/index.tsx`。该页面已经能拿到 openid;需要额外拿到当前用户的 nickname/avatarUrl。两种来源:
- `ensure-user` 云函数返回值现在包含 nickname/avatarUrl?如果不包含,扩展返回
- 或者 client 维护一个全局当前用户 store

最小改动:扩展 `ensure-user` 返回 `{ openid, nickname, avatarUrl }`,home 页拿到时一起 setState(在已有 setOpenid 旁多 setMe),传给 new-trip 页时通过路由参数太长不合适 → 推荐建立一个轻量 `me-store` 或 React Context。

**实施选择(spec 拍板):** 在 `src/store/` 下新建 `me-store.tsx`(模仿现有 trip-store),暴露 `useMe()`,首页或 app 入口 `useEffect` 调 ensure-user 后 setMe。new-trip 页 useMe 拿 nickname/avatarUrl 传入 createTrip。

**`ensure-user` 云函数返回扩展**(`cloudfunctions/ensure-user/index.js`):

```js
// 现状返回 { openid }, 改为:
return {
  openid: OPENID,
  nickname: userDoc.nickname || event.nickname || '行迹旅人',
  avatarUrl: userDoc.avatarUrl || event.avatarUrl || '',
}
```

**旧文档 fallback:** 任何读到 trip 而 `ownerNickname` undefined 的地方,UI 显示 "未知";`ownerAvatarUrl` undefined 用默认灰底首字母头像。

不做数据迁移脚本。旧 trip 慢慢被 owner 修改时,可以在 saveTrip 路径上顺便补字段;但这超出当前范围,本次只让新建 trip 携带这些字段、UI 兜底缺字段。

## 4. 首页协作角标 + 原作者信息

`src/pages/home/index.tsx` 的 `trip-card` 渲染区域改造:

每张卡片渲染时,根据 `t._openid !== openid` 判断是否协作 trip:

```tsx
{trips.map(t => {
  const isCollab = t._openid !== openid
  return (
    <View key={t._id} className='trip-card' onClick={...} onLongPress={...}>
      {isCollab && <View className='tc-badge'>协作</View>}
      <Text className='tc-name'>{t.name}</Text>
      <Text className='tc-meta'>{fmtDateShort(t.startDate)} → {fmtDateShort(t.endDate)} · {tripSummary(...)}</Text>
      <View className='tc-dest'>
        {t.destinations.map((d, i) => <Text key={...} className='tc-dest-chip'>{d.name}</Text>)}
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

**样式要点**(`src/pages/home/index.scss`):
- `.tc-badge` 绝对定位右上角,小 chip 样式(背景 `var(--ink)`,白字,12px 字号,圆角 8rpx)
- `.tc-owner` 在 destinations 下方,flex row + 12rpx avatar + 24rpx font
- `.tc-owner-avatar` 32rpx 圆头像

**不分组**:协作 trip 和自己的 trip 仍然按 updatedAt 倒序混排在同一个 `home-list` 容器。用角标和"来自"行区分。

## 5. trip 详情页 CollaboratorsBar 修复 + 点击查看名单

### 5.1 现有渲染逻辑保留 + 修小问题

`src/pages/trip/index.tsx` 第 121 行现状:

```tsx
<CollaboratorsBar
  collaborators={t.collaborators || []}
  isOwner={isOwner}
/>
```

补传 `ownerNickname`(协作者视角下显示原作者名):

```tsx
<CollaboratorsBar
  collaborators={t.collaborators || []}
  ownerNickname={t.ownerNickname}
  isOwner={isOwner}
/>
```

### 5.2 useDidShow 刷新

trip 详情页加 `useDidShow` 触发一次 `getTrip(id)`(替换或叠加现有 store dispatch),确保 owner 离开页面再回来时拿到新加入的协作者。要去 trip-store 的 reducer 看现有 load 入口 —— 实施时若已有 refresh action 直接复用。

### 5.3 点头像弹 sheet

新建组件 `src/components/CollaboratorsSheet/index.tsx`:

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
  open, collaborators, ownerNickname, ownerAvatarUrl, onClose
}: Props) {
  if (!open) return null
  return (
    <View className='cs-mask' onClick={onClose}>
      <View className='cs-sheet' onClick={e => e.stopPropagation()}>
        <View className='cs-title'>协作成员</View>

        {/* 原作者(顶部, 独立分组) */}
        <View className='cs-row'>
          {ownerAvatarUrl
            ? <Image className='cs-avatar' src={ownerAvatarUrl} mode='aspectFill' />
            : <View className='cs-avatar cs-avatar-fallback'>
                <Text>{(ownerNickname || '?').slice(0, 1)}</Text>
              </View>
          }
          <View className='cs-info'>
            <Text className='cs-name'>{ownerNickname || '原作者'}</Text>
            <Text className='cs-tag'>创建者</Text>
          </View>
        </View>

        {/* 协作者列表 */}
        {collaborators.map(c => (
          <View key={c.openid} className='cs-row'>
            {c.avatarUrl
              ? <Image className='cs-avatar' src={c.avatarUrl} mode='aspectFill' />
              : <View className='cs-avatar cs-avatar-fallback'>
                  <Text>{(c.nickname || '?').slice(0, 1)}</Text>
                </View>
            }
            <View className='cs-info'>
              <Text className='cs-name'>{c.nickname || '匿名旅人'}</Text>
              <Text className='cs-tag'>{new Date(c.joinedAt).toLocaleDateString()} 加入</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
```

`CollaboratorsBar` 改造:

- 加 onClick 在外层 View 上,触发 props 里的 `onTap` 回调
- trip 页传 `onTap={() => setSheetOpen(true)}` 并在 trip 页内渲染 `<CollaboratorsSheet>`(把 ownerNickname/ownerAvatarUrl 从 trip 文档取)
- 如果 owner 视角下 collaborators 为空,bar 仍然不渲染(保留现状),点不到 sheet —— 没人可看

```tsx
// CollaboratorsBar 新签名
interface Props {
  collaborators: Collaborator[]
  ownerNickname?: string
  isOwner: boolean
  onTap?: () => void
}
```

外层 View 加 `onClick={onTap}` 即可,样式加一点 `:active` 反馈。

## 数据流

```
[创建 trip]
  new-trip 页 → useMe() 拿 nickname/avatarUrl → createTrip(input + ownerNickname/ownerAvatarUrl)
  → trip 文档落盘时携带这俩字段

[查看 trips 列表]
  home 页 mount / useDidShow → callFunction('list-my-trips')
  → 拿到混合 trips(自有 + 协作)
  → 渲染卡片, 协作卡片右上角"协作"chip + 底部"来自 owner"

[加入协作]
  分享卡 → /pages/share?kind=collab → 点"加入协作" → joinCollab 云函数
  → trip.collaborators 数组 push 新协作者
  → 跳转 trip 页

[trip 详情]
  trip-store 加载 trip → CollaboratorsBar 显示协作者头像
  → 点头像 → CollaboratorsSheet 弹出, 列原作者 + 所有协作者
```

## 不在本次范围

- 协作者权限分层(目前都是 editor)
- 移除协作者(踢人)功能
- 旧 trip 数据迁移补 ownerNickname/ownerAvatarUrl
- 协作 trip 的实时变更推送(取消 watch 后,变更靠 useDidShow 触发)
- 防止协作者通过非分享渠道(直接 url 拼接)进 trip 页:权限规则已经能挡读,不另做 client 防御

## 错误与边界

- `list-my-trips` 云函数失败:toast 失败 + 空列表;不做 client `.where` fallback(规则下协作者也是空,无意义)
- trip 缺 `ownerNickname` 字段:UI 显示"未知" / 默认头像
- `useMe()` 拿不到 me(ensure-user 失败):createTrip 允许传 undefined,trip 文档不带 owner info,后续 UI 仍能渲染(走 fallback)

## 验证(手动)

1. **首页**: owner 账号登录 → 看到自己的 trip 卡,无"协作"chip,无"来自"行
2. **协作流程**: A 账号建 trip → 发"邀请协作"卡片 → B 账号点卡 → share 页 → 点"加入协作" → 跳 trip 页可编辑
3. **B 账号首页**: 回首页 → 看到该 trip 卡,右上"协作"chip,下方"来自 A"
4. **A 账号首页**: 不变
5. **A 账号打开 trip**: CollaboratorsBar 显示 B 的头像
6. **点头像**: 底部弹 sheet,显示 A(创建者)+ B(加入日期)
7. **B 账号打开 trip**: CollaboratorsBar 显示"A 的攻略"label + B 自己的头像(因为 collaborators 数组只有 B)
8. **新 trip 携带 owner info**: 直接 wxcloud 控制台看新建的 trip 文档,确认有 ownerNickname/ownerAvatarUrl 字段
9. **旧 trip 兼容**: 数据库里手动找一个老 trip(没有 owner info 字段),在协作者首页看,显示"来自 未知" + 默认头像;不报错

## 文件改动清单

- 新建: `cloudfunctions/list-my-trips/index.js`、`cloudfunctions/list-my-trips/package.json`(参照同目录其他 cloudfunctions)
- 新建: `src/store/me-store.tsx`
- 新建: `src/components/CollaboratorsSheet/index.tsx` + `index.scss`
- 修改: `cloudfunctions/ensure-user/index.js`(扩展返回值)
- 修改: `src/types/trip.ts`(`Trip` 加两字段)
- 修改: `src/utils/db.ts`(`listMyTrips` 走云函数, 删除 `watchMyTrips`)
- 修改: `src/pages/home/index.tsx`(去 watch、useMe、协作卡片角标)
- 修改: `src/pages/home/index.scss`(角标 + owner 行样式)
- 修改: `src/pages/new-trip/index.tsx`(useMe,传 owner info 给 createTrip)
- 修改: `src/components/CollaboratorsBar/index.tsx`(加 onTap)
- 修改: `src/pages/trip/index.tsx`(传 ownerNickname,挂 sheet,useDidShow 刷新)
- 新增 spec/plan 文档

manual(非代码):
- 云控制台 trips 集合规则去掉 `auth.openid` 引号(推荐,但即使不改本设计也能工作,云函数兜底)
- 微信开发者工具上传 `list-my-trips` 和 `ensure-user` 两个云函数
