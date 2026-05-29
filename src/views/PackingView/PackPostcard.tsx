import { View, Text, Input } from '@tarojs/components'
import type { PackViewProps } from './shared'
import './styles/postcard.scss'

export default function PackPostcard(props: PackViewProps) {
  const { categories, packing, draftByCat, checkedCount, onDraftChange, onAdd, onToggle, onRemove, onOpenTemplate } = props
  return (
    <View className='ppp'>
      <View className='ppp-head'>
        <Text className='ppp-lab'>BAGGAGE / 行李 · {checkedCount} / {packing.length}</Text>
        <View className='ppp-tpl' onClick={onOpenTemplate}>导入模板</View>
      </View>

      {categories.map((cat) => {
        const items = packing.filter((p) => p.category === cat.id)
        return (
          <View key={cat.id} className='ppp-cat'>
            <Text className='ppp-cat-label'>{cat.label}</Text>
            {items.map((p) => (
              <View
                key={p.id}
                className={`ppp-tag ${p.checked ? 'on' : ''}`}
                onClick={() => onToggle(p.id)}
                onLongPress={() => onRemove(p.id)}
              >
                <View className='ppp-tag-stamp'>{p.checked ? '✓' : '○'}</View>
                <View className='ppp-tag-body'>
                  <Text className='ppp-tag-name'>{p.label}</Text>
                  <View className='ppp-tag-barcode'>
                    {Array.from({ length: 16 }).map((_, i) => (
                      <View key={i} className='ppp-bar' style={{ width: `${2 + (i % 4)}rpx` }} />
                    ))}
                  </View>
                </View>
              </View>
            ))}
            <View className='ppp-add'>
              <Input
                className='ppp-input'
                value={draftByCat[cat.id] || ''}
                placeholder='加一项…'
                onInput={(e) => onDraftChange(cat.id, e.detail.value)}
                onConfirm={() => onAdd(cat.id)}
                cursorSpacing={20}
              />
              <View className='ppp-add-btn' onClick={() => onAdd(cat.id)}>+</View>
            </View>
          </View>
        )
      })}
    </View>
  )
}
