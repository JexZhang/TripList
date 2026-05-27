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
  onApply: (selectedDates: string[]) => void
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

export default function AIPlanPreview({
  open, plan, status, generating, existingDays, onRegenerate, onApply, onDiscard, onClose,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // 当 plan 的日期集合变化时, 默认全选所有"已生成的天"
  const planDateKey = plan ? plan.days.map(d => d.date).join(',') : ''
  useEffect(() => {
    if (!plan) { setSelected(new Set()); return }
    setSelected(new Set(plan.days.map(d => d.date)))
  }, [planDateKey])

  if (!open || !plan) return null

  const unres = unresolvedCount(plan)
  const conflicts = getConflictDates(plan, existingDays)
  const canApply = status === 'done' && selected.size > 0 && !generating

  const toggle = (date: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date); else next.add(date)
      return next
    })
  }

  return (
    <RootPortal>
      <View className='aip-mask' onClick={onClose}>
        <View className='aip-sheet' catchMove onClick={(e) => e.stopPropagation()}>
        <View className='aip-header'>
          <Text className='aip-title'>
            AI 方案 {status === 'streaming' ? '· 生成中…' : status === 'done' ? '' : ''}
          </Text>
          <Text className='aip-close' onClick={onClose}>✕</Text>
        </View>

        {unres > 0 && (
          <View className='aip-warn'>
            有 {unres} 个地点未给出坐标, 应用后可手动调整
          </View>
        )}

        <ScrollView scrollY className='aip-body'>
          {plan.days.map((d, di) => {
            const on = selected.has(d.date)
            return (
              <View key={`d-${d.date}`} className='aip-day'>
                <View className='aip-day-head' onClick={() => toggle(d.date)}>
                  <View className={`aip-check ${on ? 'on' : ''}`}>{on ? '✓' : ''}</View>
                  <Text className='aip-day-title'>Day {di + 1} · {d.date}</Text>
                </View>
                {conflicts.has(d.date) && (
                  <View className='aip-day-conflict'>
                    ⚠ 该天已有手动内容, 应用将覆盖
                  </View>
                )}
                {d.spots.map((s: GeneratedSpot, si) => {
                  const noCoord = s.lat == null || s.lng == null
                  return (
                    <View
                      key={`s-${d.date}-${si}`}
                      className={`aip-spot ${noCoord ? 'unresolved' : ''}`}
                    >
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
          <View
            className='aip-btn-discard'
            onClick={onDiscard}
          >舍弃</View>
          <View
            className={`aip-btn-regen ${generating ? 'disabled' : ''}`}
            onClick={() => !generating && onRegenerate()}
          >{generating ? '生成中…' : '重新生成'}</View>
          <View
            className={`aip-btn-apply ${canApply ? '' : 'disabled'}`}
            onClick={async () => {
              if (!canApply) return
              const picked = Array.from(selected)
              const conflictedPicked = picked.filter(d => conflicts.has(d))
              if (conflictedPicked.length > 0) {
                const res = await Taro.showModal({
                  title: '覆盖确认',
                  content: `${conflictedPicked.join(', ')} 已有手动内容, 应用后会被覆盖, 继续?`,
                  confirmText: '继续',
                  confirmColor: '#c43d3d',
                })
                if (!res.confirm) return
              }
              onApply(picked)
            }}
          >应用 {selected.size > 0 ? `(${selected.size} 天)` : ''}</View>
        </View>
        </View>
      </View>
    </RootPortal>
  )
}
