import { View, Text, Input } from '@tarojs/components'
import type { PackViewProps } from './shared'
import './styles/tegami.scss'

export default function PackTegami(props: PackViewProps) {
  const { categories, packing, draftByCat, checkedCount, onDraftChange, onAdd, onToggle, onRemove, onOpenTemplate } = props
  return (
    <View className='ptg'>
      <View className='ptg-head'>
        <Text className='ptg-progress'>{checkedCount} / {packing.length} 已打包</Text>
        <View className='ptg-tpl' onClick={onOpenTemplate}>导入模板</View>
      </View>

      {categories.map((cat) => {
        const items = packing.filter((p) => p.category === cat.id)
        return (
          <View key={cat.id} className='ptg-cat'>
            <Text className='ptg-cat-label'>{cat.label}</Text>
            <View className='ptg-chips'>
              {items.map((p) => (
                <View
                  key={p.id}
                  className={`ptg-chip ${p.checked ? 'on' : ''}`}
                  onClick={() => onToggle(p.id)}
                  onLongPress={() => onRemove(p.id)}
                >
                  <Text className='ptg-chip-check'>{p.checked ? '✓' : '○'}</Text>
                  <Text>{p.label}</Text>
                </View>
              ))}
              <View className='ptg-add-row'>
                <Input
                  className='ptg-input'
                  value={draftByCat[cat.id] || ''}
                  placeholder='加一项…'
                  onInput={(e) => onDraftChange(cat.id, e.detail.value)}
                  onConfirm={() => onAdd(cat.id)}
                  confirmType='done'
                />
                <View className='ptg-add-btn' onClick={() => onAdd(cat.id)}>+</View>
              </View>
            </View>
          </View>
        )
      })}
    </View>
  )
}
