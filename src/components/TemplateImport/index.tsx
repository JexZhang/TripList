import { View, Text, ScrollView } from '@tarojs/components'
import { PACKING_TEMPLATES } from '../../data/packing'
import { uid } from '../../utils/id'
import type { PackingItem } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  onClose: () => void
  onImport: (items: PackingItem[]) => void
}

export default function TemplateImport({ open, onClose, onImport }: Props) {
  if (!open) return null

  const importTemplate = (idx: number) => {
    const tpl = PACKING_TEMPLATES[idx]
    const items: PackingItem[] = tpl.items.map(([cat, label]) => ({
      id: uid(), category: cat, label, checked: false,
    }))
    onImport(items)
    onClose()
  }

  return (
    <View className='tpl-mask' onClick={onClose}>
      <View className='tpl-sheet' onClick={e => e.stopPropagation()}>
        <View className='tpl-head'>
          <Text className='tpl-title'>导入清单模板</Text>
          <Text className='tpl-close' onClick={onClose}>×</Text>
        </View>
        <Text className='tpl-hint'>选一个模板会追加到现有清单（不会覆盖）</Text>
        <ScrollView className='tpl-list' scrollY>
          {PACKING_TEMPLATES.map((t, i) => (
            <View key={t.name} className='tpl-item' onClick={() => importTemplate(i)}>
              <Text className='tpl-item-name'>{t.name}</Text>
              <Text className='tpl-item-count'>{t.items.length} 项</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  )
}
