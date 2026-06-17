import { View, Text, Input } from '@tarojs/components'
import type { PackViewProps } from './shared'
import './styles/magazine.scss'

export default function PackMagazine(props: PackViewProps) {
  const { categories, packing, draftByCat, checkedCount, onDraftChange, onAdd, onToggle, onRemove, onOpenTemplate } = props
  return (
    <View className='pmg'>
      <View className='pmg-masthead'>
        <Text className='pmg-eyebrow'>PACKING · 清单</Text>
        <Text className='pmg-progress'>{checkedCount} / {packing.length}</Text>
        <View className='pmg-tpl' onClick={onOpenTemplate}>+ TEMPLATE</View>
      </View>
      <View className='pmg-rule' />

      {categories.map((cat) => {
        const items = packing.filter((p) => p.category === cat.id)
        return (
          <View key={cat.id} className='pmg-cat'>
            <Text className='pmg-cat-label'>{cat.label}</Text>
            <View className='pmg-rule-thin' />
            <View className='pmg-list'>
              {items.map((p) => (
                <View
                  key={p.id}
                  className={`pmg-row ${p.checked ? 'on' : ''}`}
                  onClick={() => onToggle(p.id)}
                  onLongPress={() => onRemove(p.id)}
                >
                  <Text className='pmg-check'>{p.checked ? '■' : '□'}</Text>
                  <Text className='pmg-name'>{p.label}</Text>
                </View>
              ))}
              <View className='pmg-add'>
                <Text className='pmg-check'>＋</Text>
                <Input
                  className='pmg-input'
                  value={draftByCat[cat.id] || ''}
                  placeholder='加一项…'
                  onInput={(e) => onDraftChange(cat.id, e.detail.value)}
                  onConfirm={() => onAdd(cat.id)}
                  cursorSpacing={20}
                />
              </View>
            </View>
          </View>
        )
      })}
    </View>
  )
}
