import { useState } from 'react'
import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTripStore } from '../../store/trip-store'
import { useTheme } from '../../store/theme-store'
import { PACKING_CATEGORIES } from '../../data/packing'
import { uid } from '../../utils/id'
import TemplateImport from '../../components/TemplateImport'
import type { PackingItem } from '../../types/trip'
import PackTegami from './PackTegami'
import PackMagazine from './PackMagazine'
import PackPostcard from './PackPostcard'
import PackMinimal from './PackMinimal'
import type { PackViewProps } from './shared'
import './index.scss'

export default function PackingView() {
  const { state, dispatch, readonly: ro } = useTripStore()
  const trip = state.trip!
  const { theme } = useTheme()
  const [draftByCat, setDraftByCat] = useState<Record<string, string>>({})
  const [tplOpen, setTplOpen] = useState(false)

  const setPacking = (next: PackingItem[]) =>
    dispatch({ type: 'UPDATE_TRIP', patch: { packing: next } })

  const toggle = (id: string) => {
    setPacking(trip.packing.map((p) => p.id === id ? { ...p, checked: !p.checked } : p))
  }
  const remove = async (id: string) => {
    const res = await Taro.showModal({ title: '删除该项？', confirmText: '删除', confirmColor: '#c43d3d' })
    if (res.confirm) setPacking(trip.packing.filter((p) => p.id !== id))
  }
  const add = (catId: string) => {
    const label = (draftByCat[catId] || '').trim()
    if (!label) return
    setPacking([...trip.packing, { id: uid(), category: catId, label, checked: false }])
    setDraftByCat({ ...draftByCat, [catId]: '' })
  }
  const onImport = (items: PackingItem[]) => {
    const existingKey = new Set(trip.packing.map((p) => `${p.category}::${p.label}`))
    const fresh = items.filter((p) => !existingKey.has(`${p.category}::${p.label}`))
    setPacking([...fresh, ...trip.packing])
    Taro.pageScrollTo({ scrollTop: 0, duration: 240 }).catch(() => {})
    Taro.showToast({
      title: fresh.length ? `已导入 ${fresh.length} 项` : '清单已包含该模板',
      icon: 'none',
    })
  }

  const checkedCount = trip.packing.filter((p) => p.checked).length

  const props: PackViewProps = {
    categories: PACKING_CATEGORIES,
    packing: trip.packing,
    draftByCat,
    checkedCount,
    onDraftChange: (catId, value) => setDraftByCat({ ...draftByCat, [catId]: value }),
    onAdd: add,
    onToggle: toggle,
    onRemove: remove,
    onOpenTemplate: () => setTplOpen(true),
  }

  return (
    <View className={`packing${ro ? ' is-ro' : ''}`}>
      {theme === 'tegami'   && <PackTegami   {...props} />}
      {theme === 'magazine' && <PackMagazine {...props} />}
      {theme === 'postcard' && <PackPostcard {...props} />}
      {theme === 'minimal'  && <PackMinimal  {...props} />}

      {!ro && <TemplateImport open={tplOpen} onClose={() => setTplOpen(false)} onImport={onImport} />}
    </View>
  )
}
