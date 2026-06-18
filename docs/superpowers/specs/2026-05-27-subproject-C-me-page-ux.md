# 子项目 C · 我的页 UX 收口

> 上层 design system 文档：[2026-05-26-design-system-application-design.md](./2026-05-26-design-system-application-design.md)

---

## 1. 目标

1.1. 把我的页头像/昵称从"常驻编辑表单"改为"展示态默认 + 铅笔图标进入编辑 sheet"。

1.2. 把主题切换从"点即应用"改为"点即 pending + 底部应用按钮确认"，避免误触。

1.3. 修复主题缩略图溢出/裁切问题。

---

## 2. 范围

### 2.1. 涵盖

2.1.1. src/pages/me/index.tsx：重写顶部"个人资料"为展示态 + 铅笔角标；重写主题 section 为 pending + 应用按钮逻辑

2.1.2. src/pages/me/index.scss：展示态样式、pending vs is-current 区分、缩略图溢出修复

2.1.3. 新增 src/components/ProfileEditSheet/index.tsx + index.scss：RootPortal 包裹的编辑 sheet，复用 ProfileForm

### 2.2. 不涵盖

2.2.1. ProfileForm 内部样式调整（保持现状）

2.2.2. theme-store 结构重构（沿用 setTheme 已有的 cloud + storage 双写）

2.2.3. 跨页"实时预览"主题（脑暴中已放弃）

2.2.4. 我的页其它 section（版本号 footer 等）

---

## 3. 组件改造清单

### 3.1. ProfileEditSheet（新增）

3.1.1. 文件：src/components/ProfileEditSheet/index.tsx + index.scss

3.1.2. Props：

```typescript
interface Props {
  open: boolean
  onClose: () => void
  initialNickname?: string
  initialAvatarUrl?: string
  onSaved: () => void  // 保存成功后回调，父级 refresh me
}
```

3.1.3. 结构：参照 TemplateImport，顶层 RootPortal + mask + sheet；sheet 头部"编辑资料"标题 + ×；body 内放 `<ProfileForm initialNickname=... initialAvatarUrl=... onSubmit={...} />`，submit 内部调用 ensure-user 云函数 + onSaved + onClose。

3.1.4. 关键代码骨架：

```tsx
import { useEffect, useState } from 'react'
import { View, Text, RootPortal } from '@tarojs/components'
import Taro from '@tarojs/taro'
import ProfileForm from '../ProfileForm'
import { useTheme } from '../../store/theme-store'
import './index.scss'

interface Props {
  open: boolean
  onClose: () => void
  initialNickname?: string
  initialAvatarUrl?: string
  onSaved: () => void
}

export default function ProfileEditSheet({
  open, onClose, initialNickname, initialAvatarUrl, onSaved,
}: Props) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const t = setTimeout(() => setActive(true), 16)
      return () => clearTimeout(t)
    } else {
      setActive(false)
      const t = setTimeout(() => setMounted(false), 360)
      return () => clearTimeout(t)
    }
  }, [open])

  if (!mounted) return null

  return (
    <RootPortal>
      <View className={`pes-mask theme-tokens theme-${theme} ${active ? 'open' : ''}`} onClick={onClose} catchMove>
        <View className='pes-sheet' onClick={(e) => e.stopPropagation()}>
          <View className='pes-head'>
            <Text className='pes-title'>编辑资料</Text>
            <Text className='pes-close' onClick={onClose}>×</Text>
          </View>
          <View className='pes-body'>
            <ProfileForm
              initialNickname={initialNickname}
              initialAvatarUrl={initialAvatarUrl}
              onSubmit={async ({ nickname, avatarUrl }) => {
                // @ts-ignore Taro.cloud
                await Taro.cloud.callFunction({
                  name: 'ensure-user',
                  data: { nickname, avatarUrl },
                })
                onSaved()
                onClose()
                Taro.showToast({ title: '已保存', icon: 'success' })
              }}
            />
          </View>
        </View>
      </View>
    </RootPortal>
  )
}
```

3.1.5. SCSS 骨架：复用 TemplateImport 同款 mask/sheet 动画 token；样式类前缀 `pes-`；不引入新视觉元素。

### 3.2. 我的页 · 展示态

3.2.1. 文件：src/pages/me/index.tsx

3.2.2. 新增 state：

```typescript
const [editOpen, setEditOpen] = useState(false)
```

3.2.3. "个人资料" section 改为：

```tsx
<View className='me-section'>
  <View className='me-profile-card'>
    <Image
      className='me-profile-avatar'
      src={me?.avatarUrl || DEFAULT_AVATAR}
      mode='aspectFill'
    />
    <View className='me-profile-text'>
      <Text className='me-profile-nickname'>
        {me?.nickname && me.nickname !== '行迹旅人' ? me.nickname : '点击编辑昵称'}
      </Text>
    </View>
    <View className='me-profile-edit' onClick={() => setEditOpen(true)}>
      <PencilIcon size={32} />
    </View>
  </View>
</View>

<ProfileEditSheet
  open={editOpen}
  onClose={() => setEditOpen(false)}
  initialNickname={me?.nickname}
  initialAvatarUrl={me?.avatarUrl}
  onSaved={() => { void refresh() }}
/>
```

3.2.4. `DEFAULT_AVATAR` 常量：从 ProfileForm 导出或在 me/index.tsx 重复定义同一字符串（spec 推荐重复定义，避免 ProfileForm 暴露 internal 常量）。

3.2.5. `PencilIcon` 组件：新增极简 SVG 组件 src/components/PencilIcon/index.tsx（与 SparkleIcon 同风格），单文件包含 props `{ size?: number; className?: string }`；SVG path 用通用铅笔路径（M3 17.25 V21 H6.75 L17.81 9.94 L14.06 6.19 L3 17.25 Z M20.71 7.04 C21.1 6.65 21.1 6.02 20.71 5.63 L18.37 3.29 C17.98 2.9 17.35 2.9 16.96 3.29 L15.13 5.12 L18.88 8.87 L20.71 7.04 Z）。

### 3.3. 主题 section · pending + 应用按钮

3.3.1. 文件：src/pages/me/index.tsx

3.3.2. 新增 state：

```typescript
const [pendingTheme, setPendingTheme] = useState<ThemeName | null>(null)
const effectiveSelected = pendingTheme ?? theme
const dirty = pendingTheme !== null && pendingTheme !== theme
```

3.3.3. 主题 grid 渲染：

```tsx
<View className='me-theme-grid'>
  {VALID_THEMES.map((name) => {
    const isCurrent = name === theme && pendingTheme === null
    const isPending = name === pendingTheme
    return (
      <View
        key={name}
        className={`me-theme-card ${isCurrent ? 'is-current' : ''} ${isPending ? 'is-pending' : ''}`}
        onClick={() => {
          if (name === theme) setPendingTheme(null)
          else setPendingTheme(name)
        }}
      >
        <Image className='me-theme-thumb' src={THEME_THUMB[name]} mode='aspectFit' />
        <Text className='me-theme-name-zh'>{THEME_LABELS[name].zh}</Text>
        <Text className='me-theme-name-en'>{THEME_LABELS[name].en}</Text>
        {isCurrent && <View className='me-theme-badge me-theme-badge--current'>当前</View>}
        {isPending && <View className='me-theme-badge me-theme-badge--pending'>待应用</View>}
      </View>
    )
  })}
</View>

{dirty && (
  <View
    className='me-theme-apply'
    onClick={() => {
      if (!pendingTheme) return
      setTheme(pendingTheme)
      setPendingTheme(null)
      Taro.showToast({ title: '已切换主题', icon: 'success' })
    }}
  >
    应用「{THEME_LABELS[pendingTheme!].zh}」主题
  </View>
)}
```

3.3.4. 离开页面 pending 处理：state 随组件卸载自动清空，不持久化。无需额外 onUnload 钩子。

### 3.4. 缩略图溢出修复

3.4.1. 改动 1：`<Image mode='aspectFill'>` → `mode='aspectFit'`（防止裁切 SVG viewBox 内容）。

3.4.2. 改动 2：me/index.scss 的 .me-theme-thumb 补 `position: relative; display: block;`，并给 Image 自身加 `width: 100%; height: 100%; display: block`（避免 Image 内联尺寸超出容器）：

```scss
.me-theme-thumb {
  width: 100%;
  aspect-ratio: 5 / 6.5;
  border-radius: var(--r-sm);
  margin-bottom: 16rpx;
  overflow: hidden;
  position: relative;
  display: block;
  background: var(--surface);
}
.me-theme-thumb image,
.me-theme-thumb Image {
  width: 100%;
  height: 100%;
  display: block;
}
```

3.4.3. 实施期验证：在微信开发者工具的 wxml panel 检查 .me-theme-thumb 的实际尺寸与内部 Image 的实际尺寸是否一致。

### 3.5. 我的页 SCSS 新增样式

3.5.1. me-profile-card：

```scss
.me-profile-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 24rpx;
  background: var(--surface-2);
  border-radius: var(--r-md);
  position: relative;
}
.me-profile-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: var(--surface);
  flex: 0 0 auto;
}
.me-profile-text { flex: 1 1 auto; min-width: 0; }
.me-profile-nickname {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--ink);
  font-family: var(--font-display);
}
.me-profile-edit {
  flex: 0 0 auto;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-3);
  background: var(--surface);
  border: 1rpx solid var(--line);
}
.me-profile-edit:active { transform: scale(0.94); }
```

3.5.2. me-theme-card pending vs current：

```scss
.me-theme-card { position: relative; /* 其余属性沿用现状 */ }
.me-theme-card.is-current {
  border-color: var(--accent);
}
.me-theme-card.is-pending {
  border-color: var(--accent);
  border-style: dashed;
}
.me-theme-badge {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  padding: 4rpx 12rpx;
  border-radius: var(--r-sm);
  font-size: 18rpx;
  font-family: var(--font-mono);
  letter-spacing: 1rpx;
}
.me-theme-badge--current {
  background: var(--accent);
  color: #fff;
}
.me-theme-badge--pending {
  background: transparent;
  color: var(--accent);
  border: 1rpx dashed var(--accent);
}

.me-theme-apply {
  margin-top: 24rpx;
  padding: 20rpx;
  text-align: center;
  background: var(--accent);
  color: #fff;
  border-radius: var(--r-md);
  font-size: 28rpx;
  font-weight: 600;
}
.me-theme-apply:active { transform: scale(0.98); }
```

3.5.3. 删除原 `.me-theme-card.is-selected` 段（被 is-current 取代）。

---

## 4. 文件清单

### 4.1. 修改

| 路径 | 改动 |
| --- | --- |
| src/pages/me/index.tsx | 展示态卡片 + 编辑 sheet 入口 + pending 主题逻辑 + 应用按钮 |
| src/pages/me/index.scss | me-profile-* 新样式；me-theme-* pending/current 区分；.me-theme-thumb 溢出修复 |

### 4.2. 新增

| 路径 | 责任 |
| --- | --- |
| src/components/ProfileEditSheet/index.tsx | RootPortal 编辑 sheet，内部用 ProfileForm |
| src/components/ProfileEditSheet/index.scss | sheet 视觉样式（参照 TemplateImport） |
| src/components/PencilIcon/index.tsx | 极简 SVG 铅笔图标 |

### 4.3. 删除

无。

---

## 5. 错误处理

| 场景 | 行为 |
| --- | --- |
| ProfileEditSheet 保存失败 | toast；sheet 不关闭；输入保留（由 ProfileForm 已有逻辑兜底） |
| pendingTheme 点应用时 setTheme 失败 | theme-store 内部已 catch；前端 toast 仍按"已切换"展示（与现状一致） |
| me 数据未加载（首次进入未登录态） | 展示态显示 "点击编辑昵称" 占位 + 默认头像；点铅笔进 sheet 仍可编辑 |
| 主题缩略图加载失败 | Image 显示空白；不阻塞其它卡片渲染（沿用 Taro Image 默认行为） |
| pending 状态下用户切到其它 tab | pendingTheme state 随页面卸载自然清空，下次进入回到 currentTheme |

---

## 6. 验收冒烟（人工 · 微信开发者工具）

| # | 操作 | 期望 |
| --- | --- | --- |
| C1 | 进入我的页 | 顶部显示大头像 + 昵称 + 右侧铅笔角标；无常驻编辑控件 |
| C2 | 点铅笔 | ProfileEditSheet 从视口底部滑入；sheet 顶不贴文档底 |
| C3 | sheet 内改昵称 / 换头像 → 保存 | toast "已保存"；sheet 关闭；我的页展示态昵称/头像同步更新 |
| C4 | sheet 内点 ×（不保存） | sheet 关闭；展示态保持原状 |
| C5 | 点击与当前不同的主题卡 | 该卡虚线边框 + "待应用"角标；底部出现"应用「XX」主题"按钮 |
| C6 | 点应用按钮 | 立刻切主题 + toast "已切换主题"；按钮消失；该卡变 is-current；其它 tab（首页/trip 页）打开看也是新主题 |
| C7 | 点回与当前相同的主题卡 | pending 清空；按钮消失；该卡 is-current 不变 |
| C8 | 切到 home/trip tab 再回来 | pending 已清空；按钮不显示 |
| C9 | 4 主题缩略图渲染 | 缩略图完整显示，不裁切、不溢出，4 张并列对齐 |
| C10 | 触发 ProfileEditSheet 时滚动到底部触发 | sheet 仍贴视口底部（受 RootPortal 保障，与子项目 A 的 sheet 收口一致） |

---

## 7. 自审检查清单

7.1. 仅修改 2 个文件 + 新增 3 个文件 ✓

7.2. 不引入彩色 emoji（铅笔图标用 SVG）✓

7.3. 不改 ProfileForm 或 theme-store 的现有接口 ✓

7.4. RootPortal 模式与子项目 A 收口的 7 个 sheet 保持一致 ✓

7.5. pending 主题状态不持久化，避免与 theme-store cloud 值不一致 ✓

7.6. 类型严格：pendingTheme: ThemeName | null，无 any ✓

---

## 8. 后续 plan 入口

本 spec 完成 + 用户审查通过后，调用 superpowers:writing-plans 出实施计划。预计 4 个 task：

8.1. Task 1：新增 PencilIcon 组件

8.2. Task 2：新增 ProfileEditSheet 组件

8.3. Task 3：我的页展示态 + 编辑入口接入

8.4. Task 4：主题 pending 逻辑 + 应用按钮 + 缩略图溢出修复 + 验收冒烟
