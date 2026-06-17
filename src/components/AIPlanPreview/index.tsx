import { useEffect, useState } from 'react'
import { View, Text, ScrollView, RootPortal } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { GeneratedPlan, GeneratedSpot, AITaskStatus, Day } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  plan: GeneratedPlan | null
  status: AITaskStatus
  generating: boolean
  /** trip 当前已有的 days, 用于检测冲突 (该天已有手动 spots). 可空表示新建场景 (一律视为无冲突) */
  existingDays?: Day[] | null
  onRegenerate: () => void
  onApply: (selectedSpots: Record<string, number[]>) => void
  onDiscard: () => void
  onClose: () => void
}

const TYPE_LABEL: Record<string, string> = {
  spot: '景', hotel: '宿', meal: '食', transport: '行',
}

function unresolvedCount(plan: GeneratedPlan): number {
  let n = 0
  for (const d of plan.days) for (const s of d.spots) {
    if (s.lat == null || s.lng == null) n++
  }
  return n
}

/** 返回 plan 中和 existingDays 在同日期有 spots 的"冲突日期"集合 */
function getConflictDates(plan: GeneratedPlan, existingDays: Day[] | null | undefined): Set<string> {
  const conflicts = new Set<string>()
  if (!existingDays) return conflicts
  const byDate = new Map(existingDays.map(d => [d.date, d]))
  for (const gd of plan.days) {
    const ed = byDate.get(gd.date)
    if (ed && ed.spots && ed.spots.length > 0) conflicts.add(gd.date)
  }
  return conflicts
}

/** selectedSpots: { [date]: number[] } — 该天被选中的地点索引 */
function buildFullSelection(plan: GeneratedPlan): Record<string, number[]> {
  const sel: Record<string, number[]> = {}
  for (const d of plan.days) {
    sel[d.date] = d.spots.map((_, i) => i)
  }
  return sel
}

function totalSelected(sel: Record<string, number[]>): number {
  return Object.values(sel).reduce((acc, arr) => acc + arr.length, 0)
}

export default function AIPlanPreview({
  open, plan, status, generating, existingDays, onRegenerate, onApply, onDiscard, onClose,
}: Props) {
  const [selected, setSelected] = useState<Record<string, number[]>>({})

  const planDateKey = plan ? plan.days.map(d => d.date).join(',') : ''
  useEffect(() => {
    if (!plan) { setSelected({}); return }
    setSelected(buildFullSelection(plan))
  }, [planDateKey])

  if (!open || !plan) return null

  const unres = unresolvedCount(plan)
  const conflicts = getConflictDates(plan, existingDays)
  const spotCount = totalSelected(selected)
  const canApply = status === 'done' && spotCount > 0 && !generating

  const toggleSpot = (date: string, idx: number) => {
    setSelected(prev => {
      const cur = prev[date] ?? []
      const next = cur.includes(idx) ? cur.filter(i => i !== idx) : [...cur, idx]
      return { ...prev, [date]: next }
    })
  }

  const toggleDay = (date: string, total: number) => {
    setSelected(prev => {
      const cur = prev[date] ?? []
      const allOn = cur.length === total
      return { ...prev, [date]: allOn ? [] : Array.from({ length: total }, (_, i) => i) }
    })
  }

  return (
    <RootPortal>
      <View className='aip-mask' onClick={onClose}>
        <View className='aip-sheet' catchMove onClick={(e) => e.stopPropagation()}>
        <View className='aip-header'>
          <Text className='aip-title'>
            AI 方案 {status === 'streaming' ? '· 生成中…' : ''}
          </Text>
          <Text className='aip-close' onClick={onClose}>✕</Text>
        </View>

        {unres > 0 && (
          <View className='aip-warn'>
            有 {unres} 个地点未给出坐标，应用后可手动调整
          </View>
        )}

        <ScrollView scrollY className='aip-body'>
          {plan.days.map((d, di) => {
            const daySelected = selected[d.date] ?? []
            const allOn = daySelected.length === d.spots.length
            const someOn = daySelected.length > 0 && !allOn
            return (
              <View key={`d-${d.date}`} className='aip-day'>
                <View className='aip-day-head' onClick={() => toggleDay(d.date, d.spots.length)}>
                  <View className={`aip-check ${allOn ? 'on' : ''} ${someOn ? 'half' : ''}`}>
                    {allOn ? '✓' : someOn ? '—' : ''}
                  </View>
                  <Text className='aip-day-title'>第 {di + 1} 天 · {d.date}</Text>
                </View>
                {conflicts.has(d.date) && daySelected.length > 0 && (
                  <View className='aip-day-conflict'>
                    ⚠ 该天已有手动内容，应用将覆盖
                  </View>
                )}
                {d.spots.map((s: GeneratedSpot, si) => {
                  const on = daySelected.includes(si)
                  const noCoord = s.lat == null || s.lng == null
                  return (
                    <View
                      key={`s-${d.date}-${si}`}
                      className={`aip-spot ${noCoord ? 'unresolved' : ''} ${on ? '' : 'deselected'}`}
                      onClick={() => toggleSpot(d.date, si)}
                    >
                      <View className={`aip-spot-check ${on ? 'on' : ''}`}>{on ? '✓' : ''}</View>
                      <Text className='aip-spot-tag'>{TYPE_LABEL[s.type] || '·'}</Text>
                      <View className='aip-spot-body'>
                        <Text className='aip-spot-name'>{s.name}</Text>
                        {s.time && <Text className='aip-spot-time'>{s.time}</Text>}
                        {s.note && <Text className='aip-spot-note'>{s.note}</Text>}
                        {typeof s.price === 'number' && s.price > 0 && (
                          <Text className='aip-spot-price'>¥{s.price}</Text>
                        )}
                      </View>
                    </View>
                  )
                })}
              </View>
            )
          })}
        </ScrollView>

        <View className='aip-actions'>
          <View className='aip-btn-discard' onClick={onDiscard}>舍弃</View>
          <View
            className={`aip-btn-regen ${generating ? 'disabled' : ''}`}
            onClick={() => !generating && onRegenerate()}
          >{generating ? '生成中…' : '重新生成'}</View>
          <View
            className={`aip-btn-apply ${canApply ? '' : 'disabled'}`}
            onClick={async () => {
              if (!canApply) return
              const conflictedDays = Object.entries(selected)
                .filter(([date, idxs]) => idxs.length > 0 && conflicts.has(date))
                .map(([date]) => date)
              if (conflictedDays.length > 0) {
                const res = await Taro.showModal({
                  title: '覆盖确认',
                  content: `${conflictedDays.join('、')} 已有手动内容，应用后会被覆盖，继续？`,
                  confirmText: '继续',
                  confirmColor: '#c43d3d',
                })
                if (!res.confirm) return
              }
              onApply(selected)
            }}
          >应用 {spotCount > 0 ? `(${spotCount} 个地点)` : ''}</View>
        </View>
        </View>
      </View>
    </RootPortal>
  )
}
