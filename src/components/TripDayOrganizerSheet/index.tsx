import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, RootPortal, ScrollView, MovableArea, MovableView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import dayjs from 'dayjs'
import { useTheme } from '../../store/theme-store'
import type { Day } from '../../types/trip'
import { buildOrganizerDateSlots } from './date-slots'
import { dragTargetIndexFromY, organizerRowStepPx } from './drag'
import './index.scss'

interface Props {
  open: boolean
  days: Day[]
  initialDayId?: string
  onClose: () => void
  onComplete: (dayIds: string[]) => void
}

interface MovableChangeEventLike { detail?: { y?: number } }
interface DragState { id: string; yPx: number }

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
  const [slotCount, setSlotCount] = useState(days.length)
  const [draftDays, setDraftDays] = useState(days)
  const [highlightedSlotIndex, setHighlightedSlotIndex] = useState<number | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const rowStepPx = useMemo(() => {
    const width = Taro.getSystemInfoSync().windowWidth || 375
    return organizerRowStepPx(width)
  }, [])
  const rowStepRpx = 134
  const dateSlots = useMemo(
    () => buildOrganizerDateSlots(days[0]?.date || dayjs().format('YYYY-MM-DD'), slotCount),
    [days, slotCount],
  )
  const boardHeight = `${Math.max(dateSlots.length, 1) * rowStepRpx}rpx`

  useEffect(() => {
    if (open) {
      setSlotCount(days.length)
      setDraftDays(days)
      const initialIndex = days.findIndex((day) => day.id === initialDayId)
      setHighlightedSlotIndex(initialIndex >= 0 ? initialIndex : null)
      dragIdRef.current = null
      setDragState(null)
    }
  }, [days, initialDayId, open])

  if (!open) return null

  const startDrag = (id: string, index: number) => {
    dragIdRef.current = id
    setDragState({ id, yPx: index * rowStepPx })
  }

  const moveDrag = (id: string, event: MovableChangeEventLike) => {
    const y = event.detail?.y
    if (dragIdRef.current !== id || typeof y !== 'number') return
    const target = dragTargetIndexFromY(y, rowStepPx, draftDays.length)
    setDragState({ id, yPx: y })
    setDraftDays((current) => {
      const from = current.findIndex((item) => item.id === id)
      if (from < 0 || from === target) return current
      return moveItem(current, from, target)
    })
  }

  const endDrag = () => {
    const id = dragIdRef.current
    if (!id) {
      setDragState(null)
      return
    }
    dragIdRef.current = null
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
    if (day.id === initialDayId) setHighlightedSlotIndex(null)
    setSlotCount((current) => Math.max(1, current - 1))
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

          <ScrollView className='tdos-list' scrollY={!dragState}>
            <View className='tdos-organizer-board' style={{ height: boardHeight }}>
              <View className='tdos-slot-column'>
                {dateSlots.map((slot, index) => {
                  const highlighted = highlightedSlotIndex === index
                  return (
                    <View
                      key={slot.key}
                      className={`tdos-slot-row ${highlighted ? 'is-highlighted' : ''}`}
                      style={{ top: `${index * rowStepRpx}rpx` }}
                    >
                      <Text className='tdos-day'>Day {index + 1}</Text>
                      <Text className='tdos-date'>{dayjs(slot.date).format('MM/DD')}</Text>
                    </View>
                  )
                })}
              </View>
              <MovableArea className='tdos-card-area' style={{ height: boardHeight }}>
                {draftDays.map((day, index) => {
                  const dragging = dragState?.id === day.id
                  const y = dragging ? dragState.yPx : index * rowStepPx
                  return (
                    <MovableView
                      key={day.id}
                      className={`tdos-movable-row ${dragging ? 'is-dragging' : ''}`}
                      direction='vertical'
                      x={0}
                      y={y}
                      damping={40}
                      friction={2}
                      inertia={false}
                      outOfBounds={false}
                      onChange={(event) => moveDrag(day.id, event)}
                      onTouchEnd={endDrag}
                      onTouchCancel={endDrag}
                    >
                      <View className={`tdos-card ${dragging ? 'is-dragging' : ''}`}>
                        <View className='tdos-card-main'>
                          <Text className='tdos-summary'>{summarizeDay(day)}</Text>
                        </View>
                        <View
                          className='tdos-drag-handle'
                          onTouchStart={() => startDrag(day.id, index)}
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
                    </MovableView>
                  )
                })}
              </MovableArea>
            </View>
          </ScrollView>
        </View>
      </View>
    </RootPortal>
  )
}
