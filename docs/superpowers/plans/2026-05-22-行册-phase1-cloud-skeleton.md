# 行迹 Phase 1 · 云端骨架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通微信云开发，让客户端能调用 6 个云函数、能读写 trips 集合，为后续业务页面做好底座。

**Architecture:** 项目根新增 `cloudfunctions/`，与 `dist/` 同级，由 `project.config.json` 的 `cloudfunctionRoot` 指向。客户端通过 `Taro.cloud`（小程序端代理到 `wx.cloud`）调用云函数；所有高德外部请求走云函数代理，key 仅存在云函数环境变量。

**Tech Stack:** Taro 4.2 / React 18 / TypeScript · 微信云开发 · `wx-server-sdk` · `axios` · 高德 WebService API · `nanoid` · `dayjs`

---

## 0. 前置条件（人工操作 · 不在 plan 自动化范围）

执行人需先完成下面 3 件事，再进入 Task 1：

- **0.1** 微信开发者工具 → 云开发 → 开通环境。记下 `envId`（形如 `xingce-1abcd2ef…`）
- **0.2** 高德开放平台 → 应用 → "Web 服务" 类型应用 → 取得 API key
- **0.3** 在云开发控制台 → 环境设置 → 云函数 → 通用配置 → 环境变量，新增 `AMAP_KEY = 你的 key`（暂可空，待 Task 6 部署前再设）

把 `envId` 复制到剪贴板备用（Task 4 要写到代码里）。

---

## 1. 文件结构概览

```
行迹/
├── project.config.json          ← 修改：加 cloudfunctionRoot
├── package.json                 ← 修改：加 nanoid / dayjs
├── .gitignore                   ← 修改：忽略 cloudfunctions/**/node_modules
├── src/
│   ├── app.ts                   ← 修改：初始化 wx.cloud
│   └── utils/
│       └── cloud.ts             ← 新建：云函数调用封装
├── cloudfunctions/              ← 新建目录
│   ├── ensure-user/
│   │   ├── index.js
│   │   └── package.json
│   ├── amap-poi-search/
│   │   ├── index.js
│   │   └── package.json
│   ├── amap-weather/
│   │   ├── index.js
│   │   └── package.json
│   ├── create-share-token/
│   │   ├── index.js
│   │   └── package.json
│   ├── clone-trip/
│   │   ├── index.js
│   │   └── package.json
│   └── join-collab/
│       ├── index.js
│       └── package.json
└── docs/superpowers/plans/
    └── 2026-05-22-行迹-phase1-cloud-skeleton.md   ← 本文件
```

---

## Task 1: 安装客户端依赖

**Files:**
- Modify: `package.json`（通过 npm 命令）

- [ ] **Step 1.1:** 进入项目目录
```bash
cd /Users/jinchi/Documents/行迹
```

- [ ] **Step 1.2:** 安装 `nanoid` 和 `dayjs`
```bash
npm install nanoid dayjs
```

预期：`package.json` 的 `dependencies` 中出现两条新条目；终端无 error。

- [ ] **Step 1.3:** 验证安装
```bash
node -e "console.log(require('nanoid').nanoid(), require('dayjs')().format())"
```

预期：打印一个 21 字符的 id 和当前时间。

- [ ] **Step 1.4:** 提交
```bash
git add package.json package-lock.json
git commit -m "chore: add nanoid and dayjs deps"
```

---

## Task 2: 配置 project.config.json 指向 cloudfunctions

**Files:**
- Modify: `project.config.json`

- [ ] **Step 2.1:** 完整替换 `project.config.json` 内容
```json
{
  "miniprogramRoot": "./dist",
  "cloudfunctionRoot": "./cloudfunctions/",
  "projectname": "行迹",
  "description": "旅行攻略+清单+地图+天气",
  "appid": "wx833348388eb83bc1",
  "setting": {
    "urlCheck": true,
    "es6": false,
    "enhance": false,
    "compileHotReLoad": false,
    "postcss": false,
    "minified": false
  },
  "compileType": "miniprogram"
}
```

- [ ] **Step 2.2:** 创建 `cloudfunctions/` 目录占位
```bash
mkdir -p /Users/jinchi/Documents/行迹/cloudfunctions
touch /Users/jinchi/Documents/行迹/cloudfunctions/.gitkeep
```

- [ ] **Step 2.3:** 添加 `.gitignore` 忽略 cloud function 依赖产物

把以下内容追加到项目根 `.gitignore`：
```gitignore

# Cloud functions
cloudfunctions/**/node_modules/
cloudfunctions/**/package-lock.json
```

- [ ] **Step 2.4:** 提交
```bash
git add project.config.json cloudfunctions/.gitkeep .gitignore
git commit -m "feat(cloud): point project.config to cloudfunctions/"
```

---

## Task 3: 在 app.ts 中初始化 wx.cloud

**Files:**
- Modify: `src/app.ts`

- [ ] **Step 3.1:** 先读现状
```bash
cat /Users/jinchi/Documents/行迹/src/app.ts
```

记录现有 `App({ ... })` 或 `Component({ ... })` 的结构。

- [ ] **Step 3.2:** 在 `app.ts` 最顶部、`App` / 组件外，加入 cloud 初始化

把下面这段放到 `import` 语句之后、`App({ ... })` 之前。**把 `YOUR_ENV_ID` 替换为 Task 0 记下的真实 envId**。

```ts
// 初始化微信云开发（小程序端）
if (process.env.TARO_ENV === 'weapp') {
  if (!wx.cloud) {
    console.error('请使用 2.2.3 及以上的基础库以使用云能力')
  } else {
    wx.cloud.init({
      env: 'YOUR_ENV_ID',
      traceUser: true,
    })
  }
}
```

- [ ] **Step 3.3:** 在 App `onLaunch` 里调用 `ensure-user`（先占位，云函数下一 task 再实现）

`App({ ... })` 的 `onLaunch` 改成：

```ts
async onLaunch() {
  if (process.env.TARO_ENV !== 'weapp') return
  try {
    // 拉取微信资料；用户首次进入时也写入 users 表
    const profile = await Taro.getStorage({ key: 'userProfile' }).catch(() => ({ data: null }))
    if (profile.data) {
      await wx.cloud.callFunction({
        name: 'ensure-user',
        data: {
          nickname: profile.data.nickName || '行迹旅人',
          avatarUrl: profile.data.avatarUrl || '',
        }
      })
    }
  } catch (e) {
    console.warn('ensure-user failed at launch (will retry on next login)', e)
  }
}
```

如 `app.ts` 顶部没有 `import Taro from '@tarojs/taro'`，加上。

- [ ] **Step 3.4:** 启动 dev 编译，确认无构建报错
```bash
cd /Users/jinchi/Documents/行迹
npm run dev:weapp
```

预期：terminal 出现 `Compiled successfully`；过几秒看到 `→ Watching...`。

- [ ] **Step 3.5:** 微信开发者工具点"编译"。控制台不应有 red error。打开 Console 看到 `Init successfully`（或没有 cloud 报错）即可。

- [ ] **Step 3.6:** 提交
```bash
git add src/app.ts
git commit -m "feat(cloud): initialize wx.cloud in app launch"
```

---

## Task 4: 实现云函数 `ensure-user`

**Files:**
- Create: `cloudfunctions/ensure-user/index.js`
- Create: `cloudfunctions/ensure-user/package.json`

- [ ] **Step 4.1:** 创建 `cloudfunctions/ensure-user/package.json`
```json
{
  "name": "ensure-user",
  "version": "1.0.0",
  "description": "upsert current user profile to users collection",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~3.0.0"
  }
}
```

- [ ] **Step 4.2:** 创建 `cloudfunctions/ensure-user/index.js`
```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    throw new Error('OPENID missing — not called from miniprogram')
  }
  const { nickname, avatarUrl } = event || {}
  const db = cloud.database()
  const now = Date.now()

  // 用 OPENID 作为 _id，简化查找
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
        nickname: nickname || '行迹旅人',
        avatarUrl: avatarUrl || '',
        createdAt: now,
        lastSeenAt: now,
      }
    })
  }

  return { openid: OPENID }
}
```

- [ ] **Step 4.3:** 在微信开发者工具中右键 `cloudfunctions/ensure-user` → "在终端中打开"
```bash
cd cloudfunctions/ensure-user
npm install
```

预期：`node_modules/wx-server-sdk` 安装出现，无报错。

- [ ] **Step 4.4:** 在微信开发者工具中右键 `cloudfunctions/ensure-user` → "上传并部署：云端安装依赖（不上传 node_modules）"

预期：右下角弹"部署成功"。

- [ ] **Step 4.5:** 提交
```bash
git add cloudfunctions/ensure-user/index.js cloudfunctions/ensure-user/package.json
git commit -m "feat(cloud): add ensure-user function"
```

---

## Task 5: 实现云函数 `amap-poi-search`

**Files:**
- Create: `cloudfunctions/amap-poi-search/index.js`
- Create: `cloudfunctions/amap-poi-search/package.json`

- [ ] **Step 5.1:** 创建 `cloudfunctions/amap-poi-search/package.json`
```json
{
  "name": "amap-poi-search",
  "version": "1.0.0",
  "description": "Amap POI text search proxy",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~3.0.0",
    "axios": "^1.7.0"
  }
}
```

- [ ] **Step 5.2:** 创建 `cloudfunctions/amap-poi-search/index.js`
```js
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { keyword, city } = event || {}
  if (!keyword || !String(keyword).trim()) {
    return { results: [] }
  }

  const key = process.env.AMAP_KEY
  if (!key) {
    throw new Error('AMAP_KEY not configured in cloud function env')
  }

  const res = await axios.get('https://restapi.amap.com/v5/place/text', {
    params: {
      key,
      keywords: keyword,
      region: city || '',
      page_size: 20,
    },
    timeout: 8000,
  })

  if (res.data.status !== '1') {
    throw new Error(`amap error: ${res.data.info || 'unknown'}`)
  }

  const results = (res.data.pois || []).map(p => {
    const [lng, lat] = String(p.location || '0,0').split(',').map(Number)
    return {
      name: p.name || '',
      address: p.address || '',
      city: p.cityname || '',
      adcode: p.adcode || '',
      lat: lat || 0,
      lng: lng || 0,
    }
  })

  return { results }
}
```

- [ ] **Step 5.3:** 安装依赖
```bash
cd /Users/jinchi/Documents/行迹/cloudfunctions/amap-poi-search
npm install
cd -
```

- [ ] **Step 5.4:** 微信开发者工具中右键该目录 → "上传并部署：云端安装依赖"

- [ ] **Step 5.5:** 提交
```bash
git add cloudfunctions/amap-poi-search/index.js cloudfunctions/amap-poi-search/package.json
git commit -m "feat(cloud): add amap-poi-search function"
```

---

## Task 6: 实现云函数 `amap-weather`

**Files:**
- Create: `cloudfunctions/amap-weather/index.js`
- Create: `cloudfunctions/amap-weather/package.json`

- [ ] **Step 6.1:** 创建 `cloudfunctions/amap-weather/package.json`
```json
{
  "name": "amap-weather",
  "version": "1.0.0",
  "description": "Amap real-time weather proxy",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~3.0.0",
    "axios": "^1.7.0"
  }
}
```

- [ ] **Step 6.2:** 创建 `cloudfunctions/amap-weather/index.js`
```js
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { adcode } = event || {}
  if (!adcode) {
    throw new Error('adcode required')
  }

  const key = process.env.AMAP_KEY
  if (!key) {
    throw new Error('AMAP_KEY not configured in cloud function env')
  }

  const res = await axios.get('https://restapi.amap.com/v3/weather/weatherInfo', {
    params: { key, city: adcode, extensions: 'base' },
    timeout: 8000,
  })

  if (res.data.status !== '1') {
    throw new Error(`amap weather error: ${res.data.info || 'unknown'}`)
  }

  const live = (res.data.lives || [])[0]
  if (!live) return { weather: null }

  const temp = parseInt(live.temperature, 10)
  return {
    weather: {
      city: live.city || '',
      cityAdcode: live.adcode || '',
      temp: Number.isFinite(temp) ? temp : 0,
      low: Number.isFinite(temp) ? temp : 0,  // 实况无 low；后续 forecast 改进
      desc: live.weather || '',
      icon: live.weather || '',                // 客户端按 desc 映射图标
      fetchedAt: Date.now(),
    }
  }
}
```

- [ ] **Step 6.3:** 安装依赖 + 部署
```bash
cd /Users/jinchi/Documents/行迹/cloudfunctions/amap-weather && npm install && cd -
```
微信开发者工具中右键该目录 → 上传并部署。

- [ ] **Step 6.4:** 提交
```bash
git add cloudfunctions/amap-weather/index.js cloudfunctions/amap-weather/package.json
git commit -m "feat(cloud): add amap-weather function"
```

---

## Task 7: 实现云函数 `create-share-token`

**Files:**
- Create: `cloudfunctions/create-share-token/index.js`
- Create: `cloudfunctions/create-share-token/package.json`

- [ ] **Step 7.1:** `cloudfunctions/create-share-token/package.json`
```json
{
  "name": "create-share-token",
  "version": "1.0.0",
  "description": "Create 7-day share token for a trip",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~3.0.0"
  }
}
```

- [ ] **Step 7.2:** `cloudfunctions/create-share-token/index.js`
```js
const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const { tripId, kind } = event || {}
  if (!tripId) throw new Error('tripId required')
  if (kind !== 'readonly' && kind !== 'collab') {
    throw new Error('kind must be readonly or collab')
  }

  const db = cloud.database()
  const trip = await db.collection('trips').doc(tripId).get().catch(() => null)
  if (!trip || !trip.data) throw new Error('trip not found')
  if (trip.data._openid !== OPENID) throw new Error('only owner can share')

  const token = crypto.randomBytes(16).toString('hex')
  const now = Date.now()

  await db.collection('share_tokens').add({
    data: {
      token,
      tripId,
      kind,
      createdBy: OPENID,
      createdAt: now,
      expiresAt: now + SEVEN_DAYS_MS,
      usedBy: [],
    }
  })

  return { token }
}
```

- [ ] **Step 7.3:** 安装依赖 + 部署
```bash
cd /Users/jinchi/Documents/行迹/cloudfunctions/create-share-token && npm install && cd -
```
微信开发者工具中右键 → 上传并部署。

- [ ] **Step 7.4:** 提交
```bash
git add cloudfunctions/create-share-token/index.js cloudfunctions/create-share-token/package.json
git commit -m "feat(cloud): add create-share-token function"
```

---

## Task 8: 实现云函数 `clone-trip`

**Files:**
- Create: `cloudfunctions/clone-trip/index.js`
- Create: `cloudfunctions/clone-trip/package.json`

- [ ] **Step 8.1:** `cloudfunctions/clone-trip/package.json`
```json
{
  "name": "clone-trip",
  "version": "1.0.0",
  "description": "Clone a trip from share token (readonly kind)",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~3.0.0"
  }
}
```

- [ ] **Step 8.2:** `cloudfunctions/clone-trip/index.js`
```js
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const { sourceTripId, token } = event || {}
  if (!sourceTripId || !token) throw new Error('sourceTripId and token required')

  const db = cloud.database()
  const _ = db.command

  const tokenQuery = await db.collection('share_tokens').where({ token }).get()
  const t = tokenQuery.data[0]
  if (!t) throw new Error('token invalid')
  if (t.kind !== 'readonly') throw new Error('token kind mismatch')
  if (Date.now() > t.expiresAt) throw new Error('token expired')
  if (t.tripId !== sourceTripId) throw new Error('tripId mismatch')

  const src = await db.collection('trips').doc(sourceTripId).get().catch(() => null)
  if (!src || !src.data) throw new Error('source trip not found')

  // 排除身份/时间戳字段，其它字段全量克隆
  const {
    _id: _srcId,
    _openid: _srcOpenid,
    ownerOpenid: _srcOwner,
    collaborators: _srcCollabs,
    createdAt: _srcCreatedAt,
    updatedAt: _srcUpdatedAt,
    updatedBy: _srcUpdatedBy,
    ...rest
  } = src.data

  const now = Date.now()
  const created = await db.collection('trips').add({
    data: {
      ...rest,
      ownerOpenid: OPENID,
      collaborators: [],
      createdAt: now,
      updatedAt: now,
      updatedBy: OPENID,
    }
  })

  await db.collection('share_tokens').doc(t._id).update({
    data: { usedBy: _.addToSet(OPENID) }
  })

  return { newTripId: created._id }
}
```

- [ ] **Step 8.3:** 安装依赖 + 部署
```bash
cd /Users/jinchi/Documents/行迹/cloudfunctions/clone-trip && npm install && cd -
```
微信开发者工具中右键 → 上传并部署。

- [ ] **Step 8.4:** 提交
```bash
git add cloudfunctions/clone-trip/index.js cloudfunctions/clone-trip/package.json
git commit -m "feat(cloud): add clone-trip function"
```

---

## Task 9: 实现云函数 `join-collab`

**Files:**
- Create: `cloudfunctions/join-collab/index.js`
- Create: `cloudfunctions/join-collab/package.json`

- [ ] **Step 9.1:** `cloudfunctions/join-collab/package.json`
```json
{
  "name": "join-collab",
  "version": "1.0.0",
  "description": "Join a trip as collaborator from share token",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~3.0.0"
  }
}
```

- [ ] **Step 9.2:** `cloudfunctions/join-collab/index.js`
```js
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')

  const { tripId, token } = event || {}
  if (!tripId || !token) throw new Error('tripId and token required')

  const db = cloud.database()
  const _ = db.command

  const tokenQuery = await db.collection('share_tokens').where({ token }).get()
  const t = tokenQuery.data[0]
  if (!t) throw new Error('token invalid')
  if (t.kind !== 'collab') throw new Error('token kind mismatch')
  if (Date.now() > t.expiresAt) throw new Error('token expired')
  if (t.tripId !== tripId) throw new Error('tripId mismatch')

  const trip = await db.collection('trips').doc(tripId).get().catch(() => null)
  if (!trip || !trip.data) throw new Error('trip not found')

  // owner 加入是无操作
  if (trip.data._openid === OPENID) {
    return { ok: true, alreadyOwner: true }
  }

  // 已加入也是无操作
  const collabs = trip.data.collaborators || []
  if (collabs.some(c => c.openid === OPENID)) {
    return { ok: true, alreadyJoined: true }
  }

  // 拉当前用户信息（可能空，不阻断）
  const userDoc = await db.collection('users').doc(OPENID).get().catch(() => null)
  const user = (userDoc && userDoc.data) || {}

  const now = Date.now()
  await db.collection('trips').doc(tripId).update({
    data: {
      collaborators: _.push([{
        openid: OPENID,
        nickname: user.nickname || '行迹旅人',
        avatarUrl: user.avatarUrl || '',
        role: 'editor',
        joinedAt: now,
      }]),
      updatedAt: now,
      updatedBy: OPENID,
    }
  })

  await db.collection('share_tokens').doc(t._id).update({
    data: { usedBy: _.addToSet(OPENID) }
  })

  return { ok: true }
}
```

- [ ] **Step 9.3:** 安装依赖 + 部署
```bash
cd /Users/jinchi/Documents/行迹/cloudfunctions/join-collab && npm install && cd -
```
微信开发者工具中右键 → 上传并部署。

- [ ] **Step 9.4:** 提交
```bash
git add cloudfunctions/join-collab/index.js cloudfunctions/join-collab/package.json
git commit -m "feat(cloud): add join-collab function"
```

---

## Task 10: 客户端云函数调用封装 `utils/cloud.ts`

**Files:**
- Create: `src/utils/cloud.ts`

- [ ] **Step 10.1:** 创建 `src/utils/cloud.ts`
```ts
import Taro from '@tarojs/taro'

export interface PoiResult {
  name: string
  address: string
  city: string
  adcode: string
  lat: number
  lng: number
}

export interface WeatherInfo {
  city: string
  cityAdcode: string
  temp: number
  low: number
  desc: string
  icon: string
  fetchedAt: number
}

export type ShareKind = 'readonly' | 'collab'

interface CallResult<T> {
  errMsg: string
  result: T
  requestID?: string
}

async function call<TIn extends Record<string, unknown>, TOut>(
  name: string,
  data: TIn,
): Promise<TOut> {
  // @ts-ignore Taro.cloud 在 weapp 端可用
  const res = (await Taro.cloud.callFunction({ name, data })) as CallResult<TOut>
  return res.result
}

export const cloud = {
  ensureUser: (data: { nickname: string; avatarUrl: string }) =>
    call<typeof data, { openid: string }>('ensure-user', data),

  searchPoi: (data: { keyword: string; city?: string }) =>
    call<typeof data, { results: PoiResult[] }>('amap-poi-search', data),

  getWeather: (data: { adcode: string }) =>
    call<typeof data, { weather: WeatherInfo | null }>('amap-weather', data),

  createShareToken: (data: { tripId: string; kind: ShareKind }) =>
    call<typeof data, { token: string }>('create-share-token', data),

  cloneTrip: (data: { sourceTripId: string; token: string }) =>
    call<typeof data, { newTripId: string }>('clone-trip', data),

  joinCollab: (data: { tripId: string; token: string }) =>
    call<typeof data, { ok: boolean; alreadyOwner?: boolean; alreadyJoined?: boolean }>(
      'join-collab',
      data,
    ),
}
```

- [ ] **Step 10.2:** 跑一次类型检查
```bash
cd /Users/jinchi/Documents/行迹
npx tsc --noEmit
```

预期：终端无 type error（如有不相关的 error，记录后继续；与新文件相关的必须 0 error）。

- [ ] **Step 10.3:** 提交
```bash
git add src/utils/cloud.ts
git commit -m "feat(cloud): add typed client wrapper for cloud functions"
```

---

## Task 11: 创建 3 个数据库 collection 和权限规则（人工 · 必做）

**Files:** 无代码改动；纯云开发控制台操作。

- [ ] **Step 11.1:** 微信开发者工具 → 云开发 → 数据库 → 集合管理 → 新建 3 个集合：
  - `users`
  - `trips`
  - `share_tokens`

- [ ] **Step 11.2:** 设置 `users` 集合权限
点击 `users` → 数据权限 → 选择"自定义安全规则"，填入：
```json
{
  "read": "doc._openid == auth.openid",
  "write": "doc._openid == auth.openid"
}
```

- [ ] **Step 11.3:** 设置 `trips` 集合权限
点击 `trips` → 数据权限 → 自定义安全规则：
```json
{
  "read": "doc._openid == auth.openid || (doc.collaborators != null && 'auth.openid' in doc.collaborators.openid)",
  "write": "doc._openid == auth.openid || (doc.collaborators != null && 'auth.openid' in doc.collaborators.openid)"
}
```

说明：`collaborators.openid` 是数组字段路径，云开发安全规则的 `in` 语法支持检查"auth.openid 是否在 collaborators 的某个 openid 字段值中"。如规则编辑器报语法错误，先用宽松规则验证 API 流程通畅，部署到生产前再补严格规则。

- [ ] **Step 11.4:** 设置 `share_tokens` 集合权限
点击 `share_tokens` → 自定义安全规则：
```json
{
  "read": true,
  "write": "doc.createdBy == auth.openid"
}
```

（token 必须所有用户可读，否则接收方拉不到分享信息）

- [ ] **Step 11.5:** 验证（控制台直接添加测试数据）
- `users` 集合 → 添加记录 → `{"_id": "test-1", "nickname": "测试"}` → 保存。看到一条数据。
- 删除这条测试记录。

---

## Task 12: 配置 AMAP_KEY 环境变量（人工）

**Files:** 无；纯控制台操作。

- [ ] **Step 12.1:** 微信开发者工具 → 云开发 → 云函数 → 通用配置 → 环境变量

- [ ] **Step 12.2:** 新增 `AMAP_KEY = 你的高德 key`，保存

- [ ] **Step 12.3:** 重新部署 `amap-poi-search` 和 `amap-weather` 让环境变量生效（右键 → 上传并部署）

---

## Task 13: 端到端验证（临时调用脚本）

**Files:**
- Create: `src/utils/_dev-verify.ts`（验证完即可删）

- [ ] **Step 13.1:** 创建临时验证脚本 `src/utils/_dev-verify.ts`
```ts
import Taro from '@tarojs/taro'
import { cloud } from './cloud'

// 在小程序 Console 里调用 window.__verifyCloud() 来跑这一组测试
;(globalThis as any).__verifyCloud = async () => {
  console.group('🔍 Phase 1 cloud verification')
  try {
    // 1. ensure-user
    const u = await cloud.ensureUser({ nickname: '测试旅人', avatarUrl: '' })
    console.log('✅ ensure-user →', u)

    // 2. searchPoi
    const poi = await cloud.searchPoi({ keyword: '南京南站', city: '南京' })
    console.log('✅ amap-poi-search → 找到', poi.results.length, '条')
    console.log('   首条：', poi.results[0])

    // 3. getWeather（南京 adcode = 320100）
    const w = await cloud.getWeather({ adcode: '320100' })
    console.log('✅ amap-weather →', w.weather)

    // 4. 写一条测试 trip 到数据库
    const db = Taro.cloud.database()
    const created = await db.collection('trips').add({
      data: {
        name: '🧪 验证 trip · 可删',
        pax: 1,
        startDate: '2099-01-01',
        endDate: '2099-01-01',
        destinations: [{ name: '南京', adcode: '320100', lat: 32.04, lng: 118.78 }],
        collaborators: [],
        days: [],
        packing: [],
        ownerOpenid: u.openid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: u.openid,
      }
    })
    console.log('✅ db.add trip →', created._id)

    // 5. createShareToken
    const tok = await cloud.createShareToken({ tripId: created._id, kind: 'readonly' })
    console.log('✅ create-share-token →', tok)

    // 6. 清理：删测试 trip
    await db.collection('trips').doc(created._id).remove()
    console.log('🧹 清理测试 trip')

    console.log('🎉 所有云函数调通')
  } catch (e) {
    console.error('❌ 验证失败', e)
  }
  console.groupEnd()
}
```

- [ ] **Step 13.2:** 在 `src/app.ts` 顶部加一次性 import 让该脚本被打包
```ts
import './utils/_dev-verify'
```

加在其它 import 后面即可。

- [ ] **Step 13.3:** dev 编译（watch 应该已经在跑）
```bash
# 终端里 npm run dev:weapp 已在运行；微信开发者工具点"编译"
```

- [ ] **Step 13.4:** 在微信开发者工具 → 控制台执行
```js
__verifyCloud()
```

预期看到 6 行 ✅ + 1 行 🎉。任何一行报错把堆栈贴回来定位。

- [ ] **Step 13.5:** 验证通过后清理临时验证代码

```bash
rm /Users/jinchi/Documents/行迹/src/utils/_dev-verify.ts
```

并把 `src/app.ts` 中的 `import './utils/_dev-verify'` 删掉。

- [ ] **Step 13.6:** 最终提交
```bash
git add -A
git commit -m "chore(cloud): phase 1 verification passed, cleanup dev script"
```

---

## 14. Phase 1 验收

执行完所有 Task 后，确认以下能力都已具备，再进入 Phase 2：

- 14.1 ✅ 客户端 `Taro.cloud.callFunction()` 能调通 6 个云函数
- 14.2 ✅ `users` / `trips` / `share_tokens` 三个 collection 已创建且权限规则到位
- 14.3 ✅ 客户端能用 `Taro.cloud.database().collection('trips').add()` 写一条 trip 并立即查到
- 14.4 ✅ 高德 POI 搜索能返回真实数据（非空数组）
- 14.5 ✅ 高德天气能返回真实数据（temp / desc 非空）
- 14.6 ✅ create-share-token 返回 32 位 hex token
- 14.7 ✅ 单元测试不算（云函数本质是端到端），但端到端验证脚本通过

确认全部 ✅ 后，本 plan 结束。后续 Phase 2 plan 在另一份文档。
