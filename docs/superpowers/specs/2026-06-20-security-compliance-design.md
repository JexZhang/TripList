# 安全合规改造设计规格

## 概述

对「行迹」微信小程序进行全面安全合规改造，覆盖五个维度：AI 生成内容标注、内容安全审核接入、输入校验与鉴权加固、隐私合规、账号注销。采用方案 A（共享安全工具模块 `_shared`），所有审核/校验逻辑封装为可复用模块，各云函数按需引入。

---

## 1. AI 生成内容标注

### 1.1 问题

微信要求所有 AI 生成合成内容必须在显著位置标注"AI生成"或同等含义字样。当前 `AIPlanPreview` 标题为"AI 方案"，合规性不够明确；其他 AI 相关界面（Loading、StatusBar）已含 AI 标识，无需改动。

### 1.2 改动

**文件**: `src/components/AIPlanPreview/index.tsx` + `index.scss`

- 标题文案从 `"AI 方案"` 改为 `"AI 生成方案"`（生成中保持 `"· 生成中…"` 后缀不变）
- 在标题行下方、ScrollView 上方新增一行免责声明：
  > "内容由 AI 生成，可能存在偏差，建议核实后再使用"
- 样式：字号 22rpx，颜色 `#999`（次要文本色），行高正常

### 1.3 不改动的位置

| 位置 | 理由 |
|------|------|
| `AILoadingTheater` | "AI 正在为你编排" 已含 AI 标识 |
| `AIInterview` | 用户输入界面，非 AI 输出 |
| `TripAIStatusBar` | "AI 生成中"/"AI 方案已就绪" 已含 AI 标识 |
| 应用后的行程页 | 用户确认采纳后的内容视为用户内容，无需标注 |

---

## 2. 共享安全模块 `_shared`

### 2.1 目录结构

```
cloudfunctions/_shared/
  ├── content-security.js   // 内容审核封装
  ├── input-guard.js        // 输入校验与清洗
  └── auth-helper.js        // 鉴权辅助
```

不使用 npm，纯 Node.js 相对路径 `require('../_shared/xxx')` 引入。

### 2.2 `content-security.js`

```js
const cloud = require('wx-server-sdk')

/**
 * 文本内容安全审核
 * @param {string} content - 待审核文本（已 trim，≤2500字）
 * @param {string} openid  - 用户 openid（近 2h 访问过小程序）
 * @param {number} scene   - 1=资料 2=评论 3=论坛 4=社交日志
 * @returns {{ pass: boolean, label?: number, reason?: string }}
 *
 * 降级策略：审核接口异常时放行 + console.warn
 */
async function checkText(content, openid, scene = 2) {
  if (!content || !content.trim()) return { pass: true }
  // 截断到 2500 字（API 上限）
  const truncated = content.slice(0, 2500)
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      content: truncated,
      openid,
      scene,
      version: 2,
    })
    const suggest = res?.result?.suggest
    if (suggest === 'risky') {
      return { pass: false, label: res.result.label, reason: '内容包含违规信息' }
    }
    // 'pass' 或 'review' 都放行
    return { pass: true }
  } catch (err) {
    // 降级放行：超时、频率限制、系统错误
    console.warn('[content-security] msgSecCheck failed, fallback pass:', err.errCode, err.errMsg)
    return { pass: true }
  }
}

/**
 * 图片内容安全审核（异步）
 * @param {string} mediaUrl - 可公网访问的图片 URL
 * @param {string} openid
 * @param {number} scene
 * @returns {{ traceId: string }} 异步结果通过消息推送返回
 *
 * 降级策略：审核接口异常时放行
 */
async function checkImage(mediaUrl, openid, scene = 1) {
  if (!mediaUrl) return { traceId: null }
  try {
    const res = await cloud.openapi.security.mediaCheckAsync({
      media_url: mediaUrl,
      media_type: 2, // 2=图片
      openid,
      scene,
      version: 2,
    })
    return { traceId: res.trace_id }
  } catch (err) {
    console.warn('[content-security] mediaCheckAsync failed, fallback pass:', err.errCode, err.errMsg)
    return { traceId: null }
  }
}

module.exports = { checkText, checkImage, recordCheck }
```

### 2.3 `input-guard.js`

所有 validator 返回 `{ ok, clean?, error? }` 结构：

| 函数 | 用途 | 最大长度 |
|------|------|---------|
| `validateNickname(text)` | 用户昵称 | 20 |
| `validateTripName(text)` | 攻略名称 | 50 |
| `validateSpotName(text)` | 地点名称 | 50 |
| `validateSpotNote(text)` | 地点备注 | 200 |
| `validateFreeText(text)` | AI 偏好自由文本 | 500 |
| `validateSearchKw(text)` | POI 搜索关键词 | 50 |
| `validateTransport(text)` | 交通方式 | 30 |
| `validateLocation(text)` | 交通起点/终点 | 50 |
| `validatePrice(val)` | 价格 | 非负整数 0~999999 |
| `validateNights(val)` | 住几晚 | 正整数 1~30 |
| `validateAdcode(text)` | 行政区划代码 | 正则 `/^\d{6}$/` |
| `validateDate(text)` | 日期 | YYYY-MM-DD + 日期合法性 |

所有文本 validator 共用 `sanitizeText(text, maxLen)` 内核：
- trim 首尾空白
- 移除控制字符（`\x00-\x1f` 除 `\n` 外）
- 截断到 maxLen
- 空字符串返回 `ok: false`（除非调用方允许空）

### 2.4 `auth-helper.js`

```js
/**
 * 从 cloud context 获取 OPENID，缺失则 throw
 */
function requireOpenid() {
  const cloud = require('wx-server-sdk')
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) throw new Error('OPENID missing')
  return OPENID
}

/**
 * 读取 trip 并校验 owner，返回 trip doc
 */
async function requireTripOwner(db, tripId, openid) {
  const trip = await db.collection('trips').doc(tripId).get().catch(() => null)
  if (!trip || !trip.data) throw new Error('trip not found')
  if (trip.data._openid !== openid) throw new Error('forbidden: not owner')
  return trip.data
}

/**
 * 读取 trip 并校验 owner 或 collaborator，返回 { trip, isOwner, isCollab }
 */
async function requireTripAccess(db, tripId, openid) {
  const trip = await db.collection('trips').doc(tripId).get().catch(() => null)
  if (!trip || !trip.data) throw new Error('trip not found')
  const isOwner = trip.data._openid === openid
  const isCollab = (trip.data.collaboratorOpenids || []).includes(openid)
  if (!isOwner && !isCollab) throw new Error('forbidden')
  return { trip: trip.data, isOwner, isCollab }
}

module.exports = { requireOpenid, requireTripOwner, requireTripAccess }
```

---

## 3. 内容安全审核集成

### 3.1 `ensure-user` — 昵称 + 头像

**改动**：
1. 引入 `checkText` + `validateNickname`
2. 昵称写入前：先 `validateNickname` 清洗/校验长度，再 `checkText(nickname, OPENID, scene=1)` 审核
3. risky → `throw new Error('昵称包含违规内容，请修改')`
4. 头像：`checkImage(avatarUrl, OPENID, scene=1)` 异步发起，不阻塞写入

**头像异步审核回调**：新增 `sec-check-callback` 云函数（见 3.6），审核不通过时清空头像。

### 3.2 `update-trip` — 攻略名/地点文本

**改动**：
1. 引入 `checkText` + 各 validator
2. 仅审核**实际变更的文本字段**（对比 patch 与现有 trip 值，跳过未改动项）
3. 审核字段及对应 scene：
   - `patch.name` → `validateTripName` + `checkText(scene=1)`
   - `patch.days` 中每个 spot 的 `name` → `validateSpotName` + `checkText(scene=2)`
   - `patch.days` 中每个 spot 的 `note` → `validateSpotNote` + `checkText(scene=2)`
4. 非文本变更（拖拽排序、日期、pax 等）不触发审核
5. 任一 risky → `throw new Error('内容包含违规信息，请修改')`

**性能优化**：
- 只对比变更字段，避免每次 edit 都审核全部内容
- `days` 数组变更时，只审核相比原值有差异的 spot 文本

### 3.3 `ai-plan-trip` — AI 偏好文本

**改动**：
1. `preferences.freeText` → `validateFreeText` + `checkText(scene=2)`
2. risky → `throw new Error('偏好描述包含违规内容')`
3. AI 生成结果本身不审核（LLM 输出由模型自带安全策略保障）

### 3.4 `amap-poi-search` — 搜索关键词

**改动**：
1. 补鉴权：`requireOpenid()`
2. 输入清洗：`validateSearchKw(keyword)` → 使用清洗后的值调高德 API
3. 不做 msgSecCheck（搜索关键词不入库）

### 3.5 `amap-weather` — 鉴权补全

**改动**：
1. 补鉴权：`requireOpenid()`
2. 输入校验：`validateAdcode(adcode)`

### 3.6 新增云函数：`sec-check-callback`

**用途**：接收微信 `mediaCheckAsync` 异步审核结果推送。

**流程**：
1. 解析 `wxa_media_check` 推送消息
2. 如果 `result.suggest === 'risky'`：
   - 根据 `trace_id` 查找对应记录（需要在发起审核时将 traceId 与资源类型/ID 关联存储）
   - 头像审核不通过 → 清空 `users.avatarUrl`
   - 封面审核不通过 → 清空 `trips.coverUrl`
3. 记录日志

**关联存储**：在 `content-security.js` 中新增辅助函数 `recordCheck(traceId, collection, docId, field)`，将 traceId → 资源的映射写入 `sec_check_records` 集合，供回调查询。

**部署配置**：`sec-check-callback` 需配置为 HTTP 触发云函数（微信云开发支持），在微信后台 → 开发管理 → 开发设置 → 消息推送 中配置消息接收 URL 指向此函数的 HTTP 地址。

### 3.7 不需审核的云函数

| 云函数 | 理由 |
|--------|------|
| `list-my-trips` | 纯读取 |
| `create-share-token` | 输入是系统 ID，无自由文本 |
| `join-collab` | 输入是 token + tripId，无自由文本 |
| `clone-trip` | 克隆已有数据（源头已审核） |
| `clone-template` | 模板数据由管理员预置 |
| `ai-task-sweeper` | 定时清理，无用户输入 |

---

## 4. 输入校验与鉴权加固

### 4.1 前端 maxlength 补全

| 文件 | 字段 | 改动 |
|------|------|------|
| `src/components/ProfileForm/index.tsx` | 昵称 Input (L104) | 加 `maxlength={20}` |
| `src/pages/new-trip/index.tsx` | 攻略名 Input (L53) | 加 `maxlength={50}` |
| `src/components/AIInterview/index.tsx` | AI 攻略名 Input (L314) | 加 `maxlength={50}` |
| `src/components/SpotSearch/index.tsx` | 搜索关键词 Input (L98) | 加 `maxlength={50}` |
| `src/components/EditSpotSheet/index.tsx` | 备注 Textarea (L134) | `maxlength={500}` → `200` |
| `src/components/EditSpotSheet/index.tsx` | 交通方式 Input (L161) | 加 `maxlength={30}` |
| `src/components/EditSpotSheet/index.tsx` | 起点 Input (L171) | 加 `maxlength={50}` |
| `src/components/EditSpotSheet/index.tsx` | 终点 Input (L181) | 加 `maxlength={50}` |

### 4.2 前端数值范围校验

| 字段 | 改动 |
|------|------|
| 价格 (`EditSpotSheet` L113) | `onInput` 中 clamp 到 0~999999 |
| 住几晚 (`EditSpotSheet` L145) | `onInput` 中 clamp 到 1~30 |

### 4.3 后端二次校验

各云函数在写入数据库前调用 `_shared/input-guard.js` 的 validator：

- `ensure-user`：`validateNickname(nickname)`
- `update-trip`：`validateTripName(patch.name)`、遍历 days 中 spot 的 name/note
- `ai-plan-trip`：`validateFreeText(preferences.freeText)`
- `amap-poi-search`：`validateSearchKw(keyword)`
- `amap-weather`：`validateAdcode(adcode)`

校验失败返回明确错误信息，前端展示给用户。

### 4.4 鉴权加固

| 云函数 | 当前状态 | 改动 |
|--------|---------|------|
| `amap-poi-search` | ❌ 无 OPENID 校验 | 加 `requireOpenid()` |
| `amap-weather` | ❌ 无 OPENID 校验 | 加 `requireOpenid()` + `validateAdcode()` |
| 其余 9 个云函数 | ✅ 已有 OPENID 校验 | 无改动 |

---

## 5. 隐私合规与账号注销

### 5.1 隐私政策弹窗

**新组件**：`src/components/PrivacyConsent/index.tsx` + `index.scss`

**触发时机**：`MeProvider` 初始化时检查 `Taro.getStorageSync('privacyConsentedAt')`，不存在则弹出。

**弹窗内容**：
```
标题：隐私政策

「行迹」尊重你的隐私。我们仅收集以下信息用于提供旅行攻略服务：
• 微信昵称和头像（用于协作身份显示）
• 你创建的攻略内容（存储在云端，仅你和你邀请的协作者可见）
• 位置信息（仅在你主动使用地图功能时获取）

你可以随时在「我的」页面注销账号并删除所有数据。
继续使用即表示你同意以上政策。

按钮：[不同意]  [同意并继续]
```

**交互**：
- "同意并继续" → 存 `privacyConsentedAt` 到 storage → 关闭弹窗
- "不同意" → 关闭弹窗，显示受限首页（引导文案"需同意隐私政策后使用"，按钮可重新弹出协议）
- 使用 `RootPortal` 全屏覆盖

**集成**：在 `src/store/me-store.tsx` 的 `MeProvider` 中新增 `consented` state，控制渲染流程。

### 5.2 账号注销

**前端入口**：`src/pages/me/index.tsx` 底部新增"注销账号"按钮。

**交互流程**：
1. 点击 → `Taro.showModal` 二次确认（红色确认按钮）
2. 确认 → 调用云函数 `delete-account`
3. 成功 → Toast "已注销" → 清本地 storage → `Taro.reLaunch('/pages/home/index')`
4. `MeProvider` 检测 storage 无 `privacyConsentedAt`，重新弹隐私弹窗

**新云函数**：`cloudfunctions/delete-account/index.js`

```
流程：
1. requireOpenid() 鉴权
2. 删除用户作为 owner 的所有 trips
3. 从所有他人 trips 的 collaborators/collaboratorOpenids 中移除自己
4. 删除 users 集合中该用户文档
5. 删除 ai_tasks 中该用户的所有任务
6. 删除 ai_daily_usage 中该用户的所有用量记录
7. 删除 share_tokens 中该用户创建的所有 token
8. 返回 { ok: true }
```

**Owner 攻略处理策略**：直接删除。理由：
- 工具类产品，攻略是用户个人数据
- 协作者是被邀请方，owner 注销后失去访问合理
- 避免复杂的 owner 转让逻辑

---

## 6. 新增文件汇总

| 类型 | 路径 |
|------|------|
| 云函数 | `cloudfunctions/_shared/content-security.js` |
| 云函数 | `cloudfunctions/_shared/input-guard.js` |
| 云函数 | `cloudfunctions/_shared/auth-helper.js` |
| 云函数 | `cloudfunctions/delete-account/index.js` |
| 云函数 | `cloudfunctions/sec-check-callback/index.js` |
| 前端组件 | `src/components/PrivacyConsent/index.tsx` |
| 前端样式 | `src/components/PrivacyConsent/index.scss` |

## 7. 修改文件汇总

| 文件 | 改动摘要 |
|------|---------|
| `src/components/AIPlanPreview/index.tsx` | 标题改"AI 生成方案" + 免责小字 |
| `src/components/AIPlanPreview/index.scss` | 免责声明样式 |
| `src/components/ProfileForm/index.tsx` | Input maxlength=20 |
| `src/pages/new-trip/index.tsx` | Input maxlength=50 |
| `src/components/AIInterview/index.tsx` | Input maxlength=50 |
| `src/components/SpotSearch/index.tsx` | Input maxlength=50 |
| `src/components/EditSpotSheet/index.tsx` | maxlength 调整 + 数值 clamp |
| `cloudfunctions/ensure-user/index.js` | 引入 _shared, 昵称审核+头像异步审核 |
| `cloudfunctions/update-trip/index.js` | 引入 _shared, 变更文本审核 |
| `cloudfunctions/ai-plan-trip/index.js` | 引入 _shared, freeText 审核 |
| `cloudfunctions/amap-poi-search/index.js` | 引入 _shared, 补鉴权+输入清洗 |
| `cloudfunctions/amap-weather/index.js` | 引入 _shared, 补鉴权+adcode校验 |
| `src/store/me-store.tsx` | 集成 PrivacyConsent 弹窗逻辑 |
| `src/pages/me/index.tsx` | 新增注销账号按钮 |
| `src/utils/cloud.ts` | 新增 deleteAccount 云函数调用封装 |


## 8. 部署与配置

### 8.1 云函数部署顺序

1. 部署 `delete-account`（新云函数）
2. 部署 `sec-check-callback`（新云函数）
3. 重新部署所有被修改的云函数：`ensure-user`, `update-trip`, `ai-plan-trip`, `amap-poi-search`, `amap-weather`
   （`_shared` 目录随这些函数的 node_modules/相对路径自动上传，无需单独部署）

### 8.2 微信后台配置

- **消息推送**：配置消息接收 URL 指向 `sec-check-callback` 云函数的 HTTP 触发地址
- **内容安全 API**：确认小程序已开通安全中心 → 内容安全 API 权限

### 8.3 数据库集合

- `sec_check_records`：存储 mediaCheckAsync 的 traceId → 资源映射，供异步回调查询。安全规则：仅管理端可读写。
