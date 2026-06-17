import { View, Text, Input } from '@tarojs/components'
import type { PackViewProps } from './shared'
import './styles/minimal.scss'

export default function PackMinimal(props: PackViewProps) {
  const { categories, packing, draftByCat, checkedCount, onDraftChange, onAdd, onToggle, onRemove, onOpenTemplate } = props
  return (
    <View className='pmin'>
      <View className='pmin-head'>
        <View className='pmin-head-left'>
          <Text className='pmin-eyebrow'>打包清单</Text>
          <Text className='pmin-progress'>{checkedCount} / {packing.length}</Text>
        </View>
        <View className='pmin-tpl' onClick={onOpenTemplate}>
          <Text className='pmin-tpl-text'>导入模板</Text>
        </View>
      </View>

      {categories.map((cat) => {
        const items = packing.filter((p) => p.category === cat.id)
        return (
          <View key={cat.id} className='pmin-cat'>
            <Text className='pmin-cat-label'>{cat.label}</Text>
            {items.map((p) => (
              <View
                key={p.id}
                className={`pmin-row ${p.checked ? 'on' : ''}`}
                onClick={() => onToggle(p.id)}
                onLongPress={() => onRemove(p.id)}
              >
                <View className='pmin-box'>{p.checked && '✓'}</View>
                <Text className='pmin-name'>{p.label}</Text>
              </View>
            ))}
            <View className='pmin-add'>
              <View className='pmin-box pmin-box--add'>+</View>
              <Input
                className='pmin-input'
                value={draftByCat[cat.id] || ''}
                placeholder='添加…'
                onInput={(e) => onDraftChange(cat.id, e.detail.value)}
                onConfirm={() => onAdd(cat.id)}
                cursorSpacing={20}
              />
            </View>
          </View>
        )
      })}
    </View>
  )
}
