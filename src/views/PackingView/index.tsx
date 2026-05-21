import { useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTripStore } from '../../store/trip-store'
import { PACKING_CATEGORIES } from '../../data/packing'
import { uid } from '../../utils/id'
import TemplateImport from '../../components/TemplateImport'
import type { PackingItem } from '../../types/trip'
import './index.scss'

export default function PackingView() {
  const { state, dispatch } = useTripStore()
  const trip = state.trip!
  const [draftByCat, setDraftByCat] = useState<Record<string, string>>({})
  const [tplOpen, setTplOpen] = useState(false)

  const setPacking = (next: PackingItem[]) =>
    dispatch({ type: 'UPDATE_TRIP', patch: { packing: next } })

  const toggle = (id: string) => {
    setPacking(trip.packing.map(p => p.id === id ? { ...p, checked: !p.checked } : p))
  }
  const remove = async (id: string) => {
    const res = await Taro.showModal({ title: '删除该项？', confirmText: '删除', confirmColor: '#c43d3d' })
    if (res.confirm) setPacking(trip.packing.filter(p => p.id !== id))
  }
  const add = (catId: string) => {
    const label = (draftByCat[catId] || '').trim()
    if (!label) return
    setPacking([...trip.packing, { id: uid(), category: catId, label, checked: false }])
    setDraftByCat({ ...draftByCat, [catId]: '' })
  }
  const onImport = (items: PackingItem[]) => {
    setPacking([...trip.packing, ...items])
    Taro.showToast({ title: `已导入 ${items.length} 项`, icon: 'success' })
  }

  const checkedCount = trip.packing.filter(p => p.checked).length

  return (
    <View className='packing'>
      <View className='pk-head'>
        <Text className='pk-summary'>已勾选 {checkedCount} / {trip.packing.length}</Text>
        <View className='pk-tpl-btn' onClick={() => setTplOpen(true)}>导入模板</View>
      </View>

      {PACKING_CATEGORIES.map(cat => {
        const list = trip.packing.filter(p => p.category === cat.id)
        return (
          <View key={cat.id} className='pk-group'>
            <Text className='pk-group-title'>{cat.icon} {cat.label}</Text>
            {list.map(it => (
              <View key={it.id} className='pk-item'>
                <View
                  className={`pk-check ${it.checked ? 'on' : ''}`}
                  onClick={() => toggle(it.id)}
                >{it.checked ? '✓' : ''}</View>
                <Text
                  className={`pk-label ${it.checked ? 'done' : ''}`}
                  onClick={() => toggle(it.id)}
                >{it.label}</Text>
                <Text className='pk-x' onClick={() => remove(it.id)}>×</Text>
              </View>
            ))}
            <Input
              className='pk-add-input'
              placeholder={`+ 添加${cat.label}`}
              value={draftByCat[cat.id] || ''}
              onInput={e => setDraftByCat({ ...draftByCat, [cat.id]: e.detail.value })}
              onConfirm={() => add(cat.id)}
            />
          </View>
        )
      })}

      <TemplateImport
        open={tplOpen}
        onClose={() => setTplOpen(false)}
        onImport={onImport}
      />
    </View>
  )
}
