import { useEffect, useState } from 'react'
import { View, Text, ScrollView, RootPortal } from '@tarojs/components'
import { PACKING_TEMPLATES } from '../../data/packing'
import { uid } from '../../utils/id'
import { useTheme } from '../../store/theme-store'
import type { PackingItem } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  onClose: () => void
  onImport: (items: PackingItem[]) => void
}

export default function TemplateImport({ open, onClose, onImport }: Props) {
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

  const importTemplate = (idx: number) => {
    const tpl = PACKING_TEMPLATES[idx]
    const items: PackingItem[] = tpl.items.map(([cat, label]) => ({
      id: uid(), category: cat, label, checked: false,
    }))
    onImport(items)
    onClose()
  }

  return (
    <RootPortal>
      <View className={`tpl-mask theme-tokens theme-${theme} ${active ? 'open' : ''}`} onClick={onClose} catchMove>
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
    </RootPortal>
  )
}
