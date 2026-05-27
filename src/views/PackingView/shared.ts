import type { PackingItem } from '../../types/trip'

export interface PackCategoryDef {
  id: string
  label: string
}

export interface PackViewProps {
  categories: PackCategoryDef[]
  packing: PackingItem[]
  draftByCat: Record<string, string>
  checkedCount: number
  onDraftChange: (catId: string, value: string) => void
  onAdd: (catId: string) => void
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onOpenTemplate: () => void
}
