# 子项目 C · 我的页 UX 收口 · 实施计划

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: 我的页头像/昵称从"常驻编辑表单"改为"展示态 + 铅笔图标进 sheet 编辑"；主题切换从"点即应用"改为"点即 pending + 应用按钮确认"；修复主题缩略图溢出。

Architecture: 我的页保留双 section 结构。新增 PencilIcon（SVG）+ ProfileEditSheet（RootPortal sheet 复用 ProfileForm）。me 页内 useState 管 pending 主题，apply 按钮一次性调 setTheme，沿用 theme-store 已有的 cloud + storage 双写。

Tech Stack: Taro 4.2 + React 18 + TypeScript + SCSS。

Spec 来源：[2026-05-27-subproject-C-me-page-ux.md](../specs/2026-05-27-subproject-C-me-page-ux.md)

测试说明：项目无自动测试套件，所有验证步骤指在「微信开发者工具」中手动冒烟。

---

## 1. 文件结构

### 1.1. 修改

| 路径 | 责任 |
| --- | --- |
| src/pages/me/index.tsx | 展示态卡 + 编辑 sheet 入口 + pending 主题 + 应用按钮 |
| src/pages/me/index.scss | me-profile-* 新样式；me-theme-* pending/current 区分；缩略图溢出修复 |

### 1.2. 新增

| 路径 | 责任 |
| --- | --- |
| src/components/PencilIcon/index.tsx | 极简 SVG 铅笔图标 |
| src/components/PencilIcon/index.scss | size + color token |
| src/components/ProfileEditSheet/index.tsx | RootPortal 包裹的编辑 sheet |
| src/components/ProfileEditSheet/index.scss | mask + sheet 样式（参照 TemplateImport） |

### 1.3. 删除

无。

---

## 2. 任务清单

### 2.1. Task 1：PencilIcon 组件

Files:
- 新增：src/components/PencilIcon/index.tsx
- 新增：src/components/PencilIcon/index.scss

- [ ] 2.1.1. 创建 src/components/PencilIcon/index.tsx

```typescript
import { View } from '@tarojs/components'
import './index.scss'

interface Props {
  size?: number
  className?: string
}

export default function PencilIcon({ size = 32, className }: Props) {
  return (
    <View
      className={`pencil-icon ${className || ''}`}
      style={{ width: `${size}rpx`, height: `${size}rpx` }}
    >
      <View
        className='pencil-icon-svg'
        style={{
          width: `${size}rpx`,
          height: `${size}rpx`,
          background: 'currentColor',
          maskImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41L18.37 3.29a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z'/></svg>")`,
          maskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41L18.37 3.29a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z'/></svg>")`,
          WebkitMaskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
        } as React.CSSProperties}
      />
    </View>
  )
}
```

- [ ] 2.1.2. 创建 src/components/PencilIcon/index.scss

```scss
.pencil-icon {
  display: inline-block;
  position: relative;
  color: currentColor;
}
.pencil-icon-svg {
  display: block;
}
```

- [ ] 2.1.3. 验证

`npm run dev:weapp` 编译应通过。临时在 home 页放 `<PencilIcon size={48} className='test' />`，应能看到铅笔形状（颜色继承父元素 color）。验证后撤回临时改动。

- [ ] 2.1.4. Commit

```bash
git add src/components/PencilIcon/
git commit -m "feat(pencil-icon): add minimal svg pencil icon"
```

---

### 2.2. Task 2：ProfileEditSheet 组件

Files:
- 新增：src/components/ProfileEditSheet/index.tsx
- 新增：src/components/ProfileEditSheet/index.scss

- [ ] 2.2.1. 创建 src/components/ProfileEditSheet/index.tsx

```typescript
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
  open,
  onClose,
  initialNickname,
  initialAvatarUrl,
  onSaved,
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
      <View
        className={`pes-mask theme-tokens theme-${theme} ${active ? 'open' : ''}`}
        onClick={onClose}
        catchMove
      >
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

- [ ] 2.2.2. 创建 src/components/ProfileEditSheet/index.scss

```scss
.pes-mask {
  position: fixed; inset: 0;
  background: rgba(43, 26, 16, 0);
  display: flex; align-items: flex-end;
  z-index: 100;
  transition: background 0.22s var(--ease-out);
}
.pes-mask.open {
  background: rgba(43, 26, 16, 0.45);
}
.pes-sheet {
  width: 100%; max-height: 80vh;
  background: var(--surface);
  color: var(--ink);
  border-radius: var(--r-xl) var(--r-xl) 0 0;
  padding: 32rpx 28rpx 40rpx;
  display: flex; flex-direction: column;
  box-sizing: border-box;
  box-shadow: 0 -16rpx 48rpx rgba(43, 26, 16, 0.15);
  transform: translateY(100%);
  transition: transform 0.36s var(--ease-spring);
}
.pes-mask.open .pes-sheet {
  transform: translateY(0);
}
.pes-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 24rpx;
}
.pes-title { font-size: 32rpx; font-weight: 800; color: var(--ink); }
.pes-close { font-size: 40rpx; color: var(--ink-3); padding: 0 12rpx; }
.pes-body { flex: 1; overflow: hidden; }
```

- [ ] 2.2.3. 验证

`npm run dev:weapp` 编译通过；暂不接入我的页（Task 3 会接入）。

- [ ] 2.2.4. Commit

```bash
git add src/components/ProfileEditSheet/
git commit -m "feat(profile-edit-sheet): add rootportal sheet wrapping ProfileForm"
```

---

### 2.3. Task 3：我的页展示态 + 编辑入口

Files:
- 修改：src/pages/me/index.tsx
- 修改：src/pages/me/index.scss

- [ ] 2.3.1. 在 src/pages/me/index.tsx 顶部追加 import

```typescript
import { useState } from 'react'
import ProfileEditSheet from '../../components/ProfileEditSheet'
import PencilIcon from '../../components/PencilIcon'
```

确认 `import { Image, View, Text } from '@tarojs/components'` 已存在；如果 `Image` 未在 import 列表中（当前文件第 1 行已有），跳过。

- [ ] 2.3.2. 在 Me 函数体顶部增加 state 与默认头像常量

```typescript
const DEFAULT_AVATAR = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

export default function Me() {
  const themeCls = useThemeClass('me')
  const { me, refresh } = useMe()
  const { theme, setTheme } = useTheme()
  const [editOpen, setEditOpen] = useState(false)
  // ...
}
```

- [ ] 2.3.3. 替换"个人资料" section 整段

定位现有：

```tsx
<View className='me-section'>
  <Text className='me-section-title'>个人资料</Text>
  <ProfileForm
    initialNickname={me?.nickname}
    initialAvatarUrl={me?.avatarUrl}
    onSubmit={async ({ nickname, avatarUrl }) => {
      // @ts-ignore Taro.cloud
      await Taro.cloud.callFunction({ name: 'ensure-user', data: { nickname, avatarUrl } })
      await refresh()
      Taro.showToast({ title: '已保存', icon: 'success' })
    }}
  />
</View>
```

替换为：

```tsx
<View className='me-section'>
  <Text className='me-section-title'>个人资料</Text>
  <View className='me-profile-card'>
    <Image
      className='me-profile-avatar'
      src={me?.avatarUrl || DEFAULT_AVATAR}
      mode='aspectFill'
    />
    <View className='me-profile-text'>
      <Text className='me-profile-nickname'>
        {me?.nickname && me.nickname !== '行册旅人' ? me.nickname : '点击编辑昵称'}
      </Text>
    </View>
    <View className='me-profile-edit' onClick={() => setEditOpen(true)}>
      <PencilIcon size={32} />
    </View>
  </View>
</View>
```

- [ ] 2.3.4. 删除原 ProfileForm import（如已不再使用）

```typescript
// 删除
import ProfileForm from '../../components/ProfileForm'
```

ProfileForm 仍由 ProfileEditSheet 内部使用，无需 me 页直接 import。如有其它用例则保留。

- [ ] 2.3.5. 在 return 末尾（</View> 之前）追加 ProfileEditSheet 渲染

```tsx
      <View className='me-section me-section--meta'>
        <Text className='me-meta'>行册 · v1.0.0</Text>
      </View>

      <ProfileEditSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialNickname={me?.nickname}
        initialAvatarUrl={me?.avatarUrl}
        onSaved={() => { void refresh() }}
      />
    </View>
  )
}
```

- [ ] 2.3.6. 在 src/pages/me/index.scss 末尾追加展示态样式

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
.me-profile-text {
  flex: 1 1 auto;
  min-width: 0;
}
.me-profile-nickname {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--ink);
  font-family: var(--font-display);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
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
  transition: transform 0.18s var(--ease-out);
}
.me-profile-edit:active { transform: scale(0.94); }
```

- [ ] 2.3.7. 验证

`npm run dev:weapp` → 我的页：

1) 顶部显示大圆头像 + 昵称 + 右侧铅笔角标，无常驻编辑表单
2) 点铅笔 → sheet 从视口底部滑入（在首页 me tab 滚动到底部触发，sheet 应贴视口底，不在文档底）
3) 改昵称保存 → toast "已保存"，sheet 关闭，昵称展示同步更新
4) 点 × 关闭 → 不改任何东西

- [ ] 2.3.8. Commit

```bash
git add src/pages/me/index.tsx src/pages/me/index.scss
git commit -m "feat(me): show profile card + pencil edit sheet entry"
```

---

### 2.4. Task 4：主题 pending 逻辑 + 应用按钮 + 缩略图溢出修复

Files:
- 修改：src/pages/me/index.tsx
- 修改：src/pages/me/index.scss

- [ ] 2.4.1. 在 me/index.tsx 中追加 pending 主题 state（与 Task 3 的 editOpen 同区域）

```typescript
const [pendingTheme, setPendingTheme] = useState<ThemeName | null>(null)
const dirty = pendingTheme !== null && pendingTheme !== theme
```

- [ ] 2.4.2. 重写主题 grid 渲染

定位现有：

```tsx
<View className='me-theme-grid'>
  {VALID_THEMES.map((name) => {
    const selected = name === theme
    return (
      <View
        key={name}
        className={`me-theme-card ${selected ? 'is-selected' : ''}`}
        onClick={() => setTheme(name)}
      >
        <Image className='me-theme-thumb' src={THEME_THUMB[name]} mode='aspectFill' />
        <Text className='me-theme-name-zh'>{THEME_LABELS[name].zh}</Text>
        <Text className='me-theme-name-en'>{THEME_LABELS[name].en}</Text>
      </View>
    )
  })}
</View>
```

替换为：

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

{dirty && pendingTheme && (
  <View
    className='me-theme-apply'
    onClick={() => {
      setTheme(pendingTheme)
      setPendingTheme(null)
      Taro.showToast({ title: '已切换主题', icon: 'success' })
    }}
  >
    应用「{THEME_LABELS[pendingTheme].zh}」主题
  </View>
)}
```

注意 mode 由 aspectFill 改为 aspectFit（spec § 3.4.1）。

- [ ] 2.4.3. me/index.scss：替换 .me-theme-thumb 段（第 53–59 行），新增 Image 子选择器

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

- [ ] 2.4.4. me/index.scss：删除 `.me-theme-card.is-selected` 段（第 50–52 行）

定位：

```scss
.me-theme-card.is-selected {
  border-color: var(--accent);
}
```

整段删除（被 is-current 取代）。

- [ ] 2.4.5. me/index.scss：在 .me-theme-card 段之后追加 pending/current 区分与 badge / apply 样式

```scss
.me-theme-card { position: relative; }
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
  transition: transform 0.18s var(--ease-out);
}
.me-theme-apply:active { transform: scale(0.98); }
```

- [ ] 2.4.6. 验证

`npm run dev:weapp` → 我的页：

1) 主题 grid 显示 4 张缩略图，无溢出/裁切，4 张对齐
2) 点击与当前不同的主题卡 → 该卡虚线边框 + "待应用"角标；底部出现 "应用「XX」主题"按钮
3) 点应用 → 立刻切主题 + toast "已切换主题"；按钮消失；该卡变成 "当前" 实线角标；首页/trip 页可见新主题
4) 点回当前主题 → pending 清空；按钮消失
5) 切到其它 tab 再回我的页 → pending 状态已清空

- [ ] 2.4.7. Commit

```bash
git add src/pages/me/index.tsx src/pages/me/index.scss
git commit -m "feat(me): pending theme selection with apply button + thumb overflow fix"
```

---

### 2.5. Task 5：验收冒烟 + PR

Files: 仅人工验证。

- [ ] 2.5.1. C1：我的页默认显示大头像 + 昵称 + 铅笔角标

- [ ] 2.5.2. C2：点铅笔 → ProfileEditSheet 贴视口底部弹出

- [ ] 2.5.3. C3：sheet 内改昵称保存 → toast，sheet 关闭，展示态同步更新

- [ ] 2.5.4. C4：sheet 内点 × → 关闭，展示态保持原状

- [ ] 2.5.5. C5：点不同主题卡 → 虚线边框 + "待应用"角标 + 底部应用按钮出现

- [ ] 2.5.6. C6：点应用 → 切主题 + toast；按钮消失；卡变 "当前"；首页/trip 也是新主题

- [ ] 2.5.7. C7：点回当前主题 → pending 清空；按钮消失

- [ ] 2.5.8. C8：切 home/trip tab 再回我的页 → pending 已清空

- [ ] 2.5.9. C9：4 主题缩略图渲染完整，不裁切、不溢出

- [ ] 2.5.10. C10：我的页滚到底部触发 sheet → 仍贴视口底

- [ ] 2.5.11. 建 PR

```bash
git checkout -b feat/subproject-c-me-page-ux
git push -u origin feat/subproject-c-me-page-ux
gh pr create --title "feat(me): subproject C · profile show/edit + pending theme apply" --body "$(cat <<'EOF'
## Summary
- 我的页头像/昵称改为展示态默认，点铅笔图标弹 sheet 编辑
- 主题切换改为 pending → 应用按钮确认，避免误触
- 修复主题缩略图溢出（mode 改 aspectFit + Image 显式 100% 尺寸）
- 新增 PencilIcon 与 ProfileEditSheet 两个组件

## Test plan
- [ ] C1-C10 人工冒烟（见 plan 2.5 节）
EOF
)"
```

---

## 3. 自审清单

3.1. Spec § 3.1 ProfileEditSheet → Task 2 ✓

3.2. Spec § 3.2 我的页展示态 → Task 3 ✓

3.3. Spec § 3.3 pending 主题逻辑 + 应用按钮 → Task 4 ✓

3.4. Spec § 3.4 缩略图溢出修复（mode + Image 尺寸）→ Task 4.2.4.3 ✓

3.5. Spec § 3.5 SCSS 新样式 → Task 3.2.3.6 + Task 4.2.4.5 ✓

3.6. Spec § 6 验收 C1–C10 → Task 5 ✓

3.7. 无占位词 ✓

3.8. 类型一致性：pendingTheme: ThemeName | null 唯一定义 ✓

3.9. 新增组件文件路径已确认（与现有 SparkleIcon / TemplateImport 结构一致）✓
