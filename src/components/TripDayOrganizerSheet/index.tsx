import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, RootPortal } from '@tarojs/components'
import Taro from '@tarojs/taro'
import dayjs from 'dayjs'
import { useTheme } from '../../store/theme-store'
import type { Day } from '../../types/trip'
import { clampDragOffset, dragTargetIndex, organizerRowStepPx } from './drag'
import './index.scss'

interface Props {
  open: boolean
  days: Day[]
  initialDayId?: string
  onClose: () => void
  onComplete: (dayIds: string[]) => void
}

interface TouchPoint { clientY: number }
interface TouchEventLike { touches?: TouchPoint[]; changedTouches?: TouchPoint[] }
interface DragRef { id: string; index: number; startY: number }
interface DragState { id: string; offsetPx: number }

function summarizeDay(day: Day): string {
  if (!day.spots.length) return '暂无安排'
  const names = day.spots.slice(0, 2).map((spot) => spot.name).join('、')
  return day.spots.length > 2 ? `${names} 等 ${day.spots.length} 项` : `${names} · ${day.spots.length} 项`
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items
  const next = items.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export default function TripDayOrganizerSheet({ open, days, initialDayId, onClose, onComplete }: Props) {
  const { theme } = useTheme()
  const [draftDays, setDraftDays] = useState(days)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const dragRef = useRef<DragRef | null>(null)
  const rowStepPx = useMemo(() => {
    const width = Taro.getSystemInfoSync().windowWidth || 375
    return organizerRowStepPx(width)
  }, [])

  useEffect(() => {
    if (open) {
      setDraftDays(days)
      dragRef.current = null
      setDragState(null)
    }
  }, [days, open])

  if (!open) return null

  const startDrag = (event: TouchEventLike, index: number) => {
    const y = event.touches?.[0]?.clientY
    if (typeof y !== 'number') return
    const day = draftDays[index]
    if (!day) return
    dragRef.current = { id: day.id, index, startY: y }
    setDragState({ id: day.id, offsetPx: 0 })
  }

  const moveDrag = (event: TouchEventLike) => {
    const drag = dragRef.current
    const y = event.touches?.[0]?.clientY
    if (!drag || typeof y !== 'number') return
    const offset = clampDragOffset(y - drag.startY, rowStepPx, drag.index, draftDays.length)
    const target = dragTargetIndex(drag.index, offset, rowStepPx, draftDays.length)
    if (target === drag.index) {
      setDragState({ id: drag.id, offsetPx: offset })
      return
    }

    const movedSteps = target - drag.index
    const remainder = offset - movedSteps * rowStepPx
    setDraftDays((current) => {
      const from = current.findIndex((item) => item.id === drag.id)
      if (from < 0) return current
      return moveItem(current, from, target)
    })
    dragRef.current = { id: drag.id, index: target, startY: y - remainder }
    setDragState({ id: drag.id, offsetPx: remainder })
  }

  const endDrag = () => {
    dragRef.current = null
    setDragState(null)
  }

  const requestDelete = async (day: Day) => {
    if (draftDays.length <= 1) {
      Taro.showToast({ title: '至少保留 1 天', icon: 'none' })
      return
    }
    if (day.spots.length > 0) {
      const res = await Taro.showModal({
        title: '删除这一天？',
        content: `这一天有 ${day.spots.length} 项安排，删除后不可恢复。`,
        cancelText: '取消',
        confirmText: '删除',
        confirmColor: '#c43d3d',
      })
      if (!res.confirm) return
    } else {
      Taro.showToast({ title: '已移除空白日期', icon: 'none', duration: 900 })
    }
    setDraftDays((current) => current.filter((item) => item.id !== day.id))
  }

  return (
    <RootPortal>
      <View className={`tdos-mask theme-tokens theme-${theme}`} onClick={onClose}>
        <View className='tdos-sheet' onClick={(e) => e.stopPropagation()}>
          <View className='tdos-top'>
            <View className='tdos-top-action' onClick={onClose}><Text>取消</Text></View>
            <Text className='tdos-title'>整理日期</Text>
            <View
              className='tdos-top-action tdos-done'
              onClick={() => {
                onComplete(draftDays.map((day) => day.id))
                onClose()
              }}
            >
              <Text>完成</Text>
            </View>
          </View>

          <View className='tdos-list'>
            {draftDays.map((day, index) => {
              const highlighted = day.id === initialDayId
              const dragging = dragState?.id === day.id
              return (
                <View key={day.id} className={`tdos-row ${highlighted ? 'is-highlighted' : ''}`}>
                  <View className='tdos-slot'>
                    <Text className='tdos-day'>Day {index + 1}</Text>
                    <Text className='tdos-date'>{dayjs(day.date).format('MM/DD')}</Text>
                  </View>
                  <View
                    className={`tdos-card ${dragging ? 'is-dragging' : ''}`}
                    style={dragging ? { transform: `translateY(${dragState.offsetPx}px) scale(1.015)` } : undefined}
                    catchMove={dragging}
                  >
                    <View className='tdos-card-main'>
                      <Text className='tdos-summary'>{summarizeDay(day)}</Text>
                      <Text className='tdos-card-label'>按住右侧把手拖动</Text>
                    </View>
                    <View
                      className='tdos-drag-handle'
                      catchMove={dragging}
                      onTouchStart={(e) => startDrag(e, index)}
                      onTouchMove={moveDrag}
                      onTouchEnd={endDrag}
                      onTouchCancel={endDrag}
                    >
                      <View className='tdos-grip-icon'>
                        <View className='tdos-grip-line' />
                        <View className='tdos-grip-line' />
                        <View className='tdos-grip-line' />
                      </View>
                    </View>
                    <View className='tdos-delete' onClick={() => requestDelete(day)}>
                      <View className='tdos-trash-icon'>
                        <View className='tdos-trash-lid' />
                        <View className='tdos-trash-can'>
                          <View className='tdos-trash-line' />
                          <View className='tdos-trash-line' />
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      </View>
    </RootPortal>
  )
}
