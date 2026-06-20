# 安全合规改造实施计划

> 对应设计规格：`docs/superpowers/specs/2026-06-20-security-compliance-design.md`

---

## Task 1：创建 `_shared` 安全模块

**依赖**：无  
**产出**：3 个文件，后续所有云函数改造的前置

| 文件 | 要点 |
|------|------|
| `cloudfunctions/_shared/content-security.js` | `checkText` + `checkImage` + `recordCheck`；降级放行；截断 2500 字。`recordCheck` 实现：写入 `sec_check_records` 集合，文档结构 `{ _id: traceId, collection, docId, field, createdAt: Date.now() }` |
| `cloudfunctions/_shared/input-guard.js` | `sanitizeText(text, maxLen)` 内核 + 12 个 validator（见 spec 2.3 节）；返回 `{ ok, clean?, error? }` |
| `cloudfunctions/_shared/auth-helper.js` | `requireOpenid()` + `requireTripOwner(db, tripId, openid)` + `requireTripAccess(db, tripId, openid)` |

---

## Task 2：AI 生成内容标注

**依赖**：无  
**产出**：2 个文件修改

- `src/components/AIPlanPreview/index.tsx`：标题 `"AI 方案"` → `"AI 生成方案"`；ScrollView 上方插入免责 `<Text>`
- `src/components/AIPlanPreview/index.scss`：新增 `.aip-disclaimer` 样式（22rpx, #999）

---

## Task 3：前端输入校验

**依赖**：无  
**产出**：5 个文件修改

### 3.1 maxlength 补全

| 文件 | 改动 |
|------|------|
| `src/components/ProfileForm/index.tsx` | 昵称 Input 加 `maxlength={20}` |
| `src/pages/new-trip/index.tsx` | 攻略名 Input 加 `maxlength={50}` |
| `src/components/AIInterview/index.tsx` | AI 攻略名 Input 加 `maxlength={50}` |
| `src/components/SpotSearch/index.tsx` | 搜索关键词 Input 加 `maxlength={50}` |
| `src/components/EditSpotSheet/index.tsx` | 备注 maxlength 500→200；交通方式加 30；起点/终点加 50 |

### 3.2 数值范围 clamp

| 文件 | 改动 |
|------|------|
| `src/components/EditSpotSheet/index.tsx` | 价格 onInput clamp 0~999999；住几晚 clamp 1~30 |

---

## Task 4：amap 云函数鉴权加固

**依赖**：Task 1（_shared）  
**产出**：2 个云函数修改

### 4.1 `amap-poi-search/index.js`

- 引入 `requireOpenid()` 鉴权
- 引入 `validateSearchKw(keyword)` 清洗（不做 msgSecCheck）
- 鉴权失败 / keyword 空 → throw

### 4.2 `amap-weather/index.js`

- 引入 `requireOpenid()` 鉴权
- 引入 `validateAdcode(adcode)` 格式校验 `/^\d{6}$/`
- 鉴权失败 / adcode 不合法 → throw

---

## Task 5：ensure-user 内容审核集成

**依赖**：Task 1（_shared）  
**产出**：1 个云函数修改

- 引入 `checkText` + `checkImage` + `validateNickname`
- 昵称：`validateNickname` → `checkText(nickname, OPENID, scene=1)` → risky 抛错
- 头像异步审核流程：
  ```
  const { traceId } = await checkImage(avatarUrl, OPENID, 1)
  if (traceId) await recordCheck(traceId, 'users', OPENID, 'avatarUrl')
  ```
  其中用户文档 `_id` 即为 OPENID；`traceId` 为 null 时（降级放行）跳过 recordCheck
- 不阻塞写入

---

## Task 6：update-trip 内容审核集成

**依赖**：Task 1（_shared）  
**产出**：1 个云函数修改

- 引入 `checkText` + `validateTripName` / `validateSpotName` / `validateSpotNote`
- 仅审核**实际变更的文本字段**（对比 patch 与现有 trip）
- `patch.name` → `validateTripName` + `checkText(scene=1)`
- `patch.days` 变更 diff 策略：按 `spot._id` 匹配新旧 spot（无 `_id` 视为新增，新增一律审核）；仅对比 `name`、`note` 字段，值相同则跳过；删除 spot 不触发审核
- 对变更的 spot：`name` → `validateSpotName` + `checkText(scene=2)`；`note` → `validateSpotNote` + `checkText(scene=2)`
- 非文本变更（拖拽排序、日期、pax）不触发审核

---

## Task 7：ai-plan-trip 内容审核集成

**依赖**：Task 1（_shared）  
**产出**：1 个云函数修改

- 引入 `checkText` + `validateFreeText`
- `preferences.freeText` → `validateFreeText` + `checkText(scene=2)`
- risky → throw；AI 输出本身不审核

---

## Task 8：新增 `sec-check-callback` 云函数

**依赖**：Task 1（_shared）  
**产出**：`cloudfunctions/sec-check-callback/index.js` + `package.json`

- HTTP 触发，接收微信 `mediaCheckAsync` 异步结果推送
- 解析 `wxa_media_check` 消息体
- risky → 根据 `sec_check_records` 查找资源 → 清空对应字段（头像/封面）
- 记录日志

**部署前置**：在云开发控制台创建 `sec_check_records` 集合，安全规则设为「仅管理端可读写」

---

## Task 9：新增 `delete-account` 云函数

**依赖**：Task 1（_shared）  
**产出**：`cloudfunctions/delete-account/index.js` + `package.json`

- `requireOpenid()` 鉴权
- 删除用户 owner 的所有 trips（含关联 days/spots）
- 从他人 trips 的 collaborators/collaboratorOpenids 移除自己
- 删除 `users` 中该用户文档
- 删除 `ai_tasks`、`ai_daily_usage`、`share_tokens` 中该用户记录
- 返回 `{ ok: true }`

---

## Task 10：隐私合规 + 账号注销 UI

**依赖**：Task 9（delete-account 云函数）  
**产出**：新组件 + 4 个文件修改

### 10.1 PrivacyConsent 组件

- 新建 `src/components/PrivacyConsent/index.tsx` + `index.scss`
- `RootPortal` 全屏覆盖弹窗
- 按钮：不同意 / 同意并继续
- 同意后存 `privacyConsentedAt` 到 storage

### 10.2 me-store 集成

- `src/store/me-store.tsx`：新增 `consented` state；`MeProvider` 检查 storage 决定是否渲染弹窗
- 未同意时显示受限页面（引导文案 + 重新弹出按钮）

### 10.3 账号注销 UI

- `src/pages/me/index.tsx`：底部新增"注销账号"按钮
- 交互：showModal 二次确认 → 调 `deleteAccount` 云函数 → 清 storage → reLaunch 到首页
- `src/utils/cloud.ts`：新增 `deleteAccount()` 调用封装

---

## 执行顺序

```
Task 1 (_shared)  ──┬──→ Task 4 (amap鉴权)
                    ├──→ Task 5 (ensure-user审核)
                    ├──→ Task 6 (update-trip审核)
                    ├──→ Task 7 (ai-plan-trip审核)
                    ├──→ Task 8 (sec-check-callback)
                    └──→ Task 9 (delete-account) ──→ Task 10 (隐私+注销UI)

Task 2 (AI标注)     — 独立，可并行
Task 3 (前端校验)   — 独立，可并行
```

并行组：
- **批次 A**：Task 1 + Task 2 + Task 3（同时开工）
- **批次 B**：Task 4 + Task 5 + Task 6 + Task 7（等 Task 1 完成后并行）
- **批次 C**：Task 8 + Task 9（等 Task 1 完成后并行）
- **批次 D**：Task 10（等 Task 9 完成后）

---

## 部署顺序

参见设计规格 §8.1：
1. 部署 `delete-account`（新云函数）
2. 部署 `sec-check-callback`（新云函数）
3. 重新部署所有被修改的云函数：`ensure-user`, `update-trip`, `ai-plan-trip`, `amap-poi-search`, `amap-weather`
   （`_shared` 目录随这些函数一起上传，无需单独部署）

---

## 验证清单

- [ ] 编译通过（`npm run build:weapp`）
- [ ] 各云函数 require 路径正确（`../_shared/xxx`）
- [ ] msgSecCheck 降级：模拟异常 → 放行 + warn 日志
- [ ] amap 函数无 OPENID 调用 → 被拦截
- [ ] 前端 maxlength 生效（超长输入被截断）
- [ ] 隐私弹窗首次启动弹出
- [ ] 注销流程：确认 → 删除数据 → 清 storage → 回到首页
- [ ] AIPlanPreview 标题显示"AI 生成方案" + 免责小字
- [ ] 云开发控制台：`sec_check_records` 集合已创建，安全规则设为仅管理端可读写
- [ ] 微信后台 → 消息推送 URL 已指向 `sec-check-callback` 云函数 HTTP 触发地址
- [ ] 微信后台 → 安全中心 → 内容安全 API 已开通
