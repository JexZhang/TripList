import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Textarea } from '@tarojs/components'
import type { GeneratedPlan, GeneratedSpot, AITaskStatus } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  plan: GeneratedPlan | null     // 可以是 progress(部分天数)或 result
  status: AITaskStatus           // 'streaming' 时禁用"应用"
  generating: boolean            // true 时禁用按钮(用于重新生成时)
  onRegenerate: (feedback: string) => void
  onApply: (selectedDates: string[]) => void
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

export default function AIPlanPreview({
  open, plan, status, generating, onRegenerate, onApply, onClose,
}: Props) {
  const [feedback, setFeedback] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // 当 plan 的日期集合变化时, 默认全选所有"已生成的天"
  const planDateKey = plan ? plan.days.map(d => d.date).join(',') : ''
  useEffect(() => {
    if (!plan) { setSelected(new Set()); return }
    setSelected(new Set(plan.days.map(d => d.date)))
  }, [planDateKey])

  if (!open || !plan) return null

  const unres = unresolvedCount(plan)
  const canApply = status === 'done' && selected.size > 0 && !generating

  const toggle = (date: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date); else next.add(date)
      return next
    })
  }

  return (
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

        <View className='aip-feedback'>
          <Text className='aip-feedback-label'>想调整哪里? (可选)</Text>
          <Textarea
            className='aip-feedback-input'
            value={feedback}
            onInput={(e) => setFeedback(e.detail.value)}
            placeholder='例如: 第二天太赶, 改悠闲点'
            maxlength={200}
            disabled={generating}
          />
        </View>

        <View className='aip-actions'>
          <View
            className={`aip-btn-regen ${generating ? 'disabled' : ''}`}
            onClick={() => !generating && onRegenerate(feedback)}
          >{generating ? '生成中…' : '重新生成'}</View>
          <View
            className={`aip-btn-apply ${canApply ? '' : 'disabled'}`}
            onClick={() => canApply && onApply(Array.from(selected))}
          >应用 {selected.size > 0 ? `(${selected.size} 天)` : ''}</View>
        </View>
      </View>
    </View>
  )
}
