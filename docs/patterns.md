# PATTERNS.md

## 基线不可变 + 覆盖可编辑模式
> 覆盖：2/4 个业务文件 | 来源：[trip-core §4](../openspec/specs/trip-core/spec.md)、[trip-core §5](../openspec/specs/trip-core/spec.md)

```typescript
// 基线数据只读，用户修改通过 override 层叠加
const merged = mergedDay(activeDay) // merge(base + override)
// 来源：[index.tsx:84-99](../src/pages/index/index.tsx#L84-L99)
```

该模式在 `trip-core` 和 `override-utils` 两个 spec 中得到确认。`trips.json` 作为只读数据源，用户修改通过 `override` 层（存储在 Taro Storage 中）叠加，不直接修改基线。这使得数据更新（如 JSON 版本升级）不会丢失用户自定义内容。

关键实现：
- `loadOverride(tripId)` 从 Storage 读取用户覆盖数据
- `mergedDay(baseDay)` 将基线 Day 与 DayOverride 合并，覆盖值优先，回退到基线值
- `saveOverride(tripId, ov)` 将完整 TripOverride 写入 Storage

## 防御性数据加载模式
> 覆盖：2/4 个业务文件 | 来源：[override-utils §4](../openspec/specs/override-utils/spec.md)、[override-utils §5](../openspec/specs/override-utils/spec.md)

```typescript
const raw = Taro.getStorageSync(KEY(tripId))
if (raw && typeof raw === 'object') {
  return { days: raw.days || {}, packing: raw.packing || [], transport: raw.transport || {} }
}
return { days: {}, packing: [], transport: {} }
// 来源：[override.ts:24-34](../src/utils/override.ts#L24-L34)
```

该模式在 `override-utils` 和 `trip-core` 两个 spec 中得到确认。`loadOverride()` 通过三层防御机制（读取原始数据 → typeof 类型守卫 → 逻辑运算符合并默认值）确保永远返回可用数据，调用方无需处理 null 或 undefined。

## 元组数据结构 [string, string]
> 覆盖：2/4 个业务文件 | 来源：[packing-data §1](../openspec/specs/packing-data/spec.md)、[packing-data §5](../openspec/specs/packing-data/spec.md)

```typescript
// 使用元组而非对象 { categoryId, name }
type PackingItem = [string, string] // [分类ID, 物品名称]
const DEFAULT_PACKING: PackingItem[] = [
  ['doc', '身份证'],
  ['wear', '换洗衣物'],
  // ...
]
// 来源：[packing.ts:16-23](../src/data/packing.ts#L16-L23)
```

该模式在 `packing-data` 和 `trip-core` 两个 spec 中得到确认。打包清单使用 `[category_id, item_name]` 二元组而非对象，JSON 序列化时为 `["doc", "身份证"]`，比对象 `{"categoryId":"doc","name":"身份证"}` 减少约 30% 字符数，对移动端存储和传输更友好。

潜在风险：元组缺乏自描述性，消费方需要查阅文档或类型定义才能理解 `[0]` 是分类 ID、`[1]` 是物品名称。建议在消费方代码中通过解构赋值 `const [categoryId, itemName] = item` 提升可读性。

## 分层配置合并模式
> 覆盖：2/4 个业务文件 | 来源：[project-config §4](../openspec/specs/project-config/spec.md)、[project-config §5](../openspec/specs/project-config/spec.md)

```typescript
export default defineConfig(async (merge, { command, mode }) => {
  const baseConfig = { /* 所有平台共有的配置 */ }
  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, await import('./dev').then(m => m.default))
  }
  return merge({}, baseConfig, await import('./prod').then(m => m.default))
})
// 来源：[config/index.ts:7-102](../config/index.ts#L7-L102)
```

该模式在 `project-config` spec 中得到确认。`config/index.ts` 采用"基础配置 + 环境配置"的分层合并策略：baseConfig 包含所有平台共有的配置项，devConfig 和 prodConfig 仅包含环境差异项。通过 `process.env.NODE_ENV` 判断当前环境，使用 `merge()` 深度合并后返回。

## 全量覆盖写入策略
> 覆盖：2/4 个业务文件 | 来源：[override-utils §4](../openspec/specs/override-utils/spec.md)、[override-utils §5](../openspec/specs/override-utils/spec.md)

```typescript
export function saveOverride(tripId: string, ov: TripOverride): void {
  Taro.setStorageSync(KEY(tripId), ov) // 全量写入，非增量更新
}
// 来源：[override.ts:36-38](../src/utils/override.ts#L36-L38)
```

该模式在 `override-utils` 和 `trip-core` 两个 spec 中得到确认。`saveOverride()` 采用全量覆盖策略，每次保存都写入完整的 TripOverride 对象，简化存储逻辑，避免合并冲突。要求调用方遵循"加载-修改-保存"模式。

### 反例（项目中不推荐）
> 来源：[override-utils §5](../openspec/specs/override-utils/spec.md)

若需增量更新，应先在内存中合并再整体写入，而非直接修改 Storage 中的部分字段——当前工具层无增量更新 API。

## 场景化模板直接引用默认列表
> 覆盖：2/4 个业务文件 | 来源：[packing-data §4](../openspec/specs/packing-data/spec.md)、[packing-data §5](../openspec/specs/packing-data/spec.md)

```typescript
const PACKING_TEMPLATES: PackingTemplate[] = [
  {
    name: '国内 · 基础',
    items: DEFAULT_PACKING, // 直接引用，非复制
  },
  // 其他场景模板...
]
// 来源：[packing.ts:30-34](../src/data/packing.ts#L30-L34)
```

该模式在 `packing-data` 和 `trip-core` 两个 spec 中得到确认。PACKING_TEMPLATES 的"国内 · 基础"模板通过 `items: DEFAULT_PACKING` 直接引用同一对象，而非复制数组内容。这保证了默认列表的修改会自动反映到基础模板中。

## 同步本地存储（StorageSync）
> 覆盖：2/4 个业务文件 | 来源：[override-utils §1](../openspec/specs/override-utils/spec.md)、[override-utils §3](../openspec/specs/override-utils/spec.md)

```typescript
// 使用同步 API 而非异步
const raw = Taro.getStorageSync(KEY(tripId))
Taro.setStorageSync(KEY(tripId), ov)
// 来源：[override.ts:24-38](../src/utils/override.ts#L24-L38)
```

该模式在 `override-utils` 和 `trip-core` 两个 spec 中得到确认。采用 Taro 的 `StorageSync` API 进行同步读写，简化调用方代码逻辑，避免异步状态管理复杂度。适用于轻量级用户偏好调整，对实时性要求不高但需要在页面切换时快速恢复状态。

潜在风险：StorageSync 在不同平台（微信小程序、H5、App）的存储容量上限不同，若用户添加大量打包清单项或超长行程，可能触发存储失败（源码中无容量检查或清理逻辑）。

## 单页视图切换模式
> 覆盖：1/4 个业务文件 | 来源：[trip-core §4](../openspec/specs/trip-core/spec.md)

```typescript
const [view, setView] = useState<'trip' | 'budget' | 'packing'>('trip')
// 通过 view state 切换视图，而非多页面跳转
{view === 'trip' && <TripView />}
{view === 'budget' && <BudgetView />}
{view === 'packing' && <PackingView />}
// 来源：[index.tsx:151-229](../src/pages/index/index.tsx#L151-L229)
```

该模式仅在 `trip-core` spec 中出现，为局部约定。通过 `view` state 在 TripView/BudgetView/PackingView 间切换，保持单页应用体验，减少页面跳转开销。
