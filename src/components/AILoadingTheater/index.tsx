import { useEffect, useState } from 'react'
import { View, Text, RootPortal } from '@tarojs/components'
import './index.scss'

export type TheaterStatus = 'thinking' | 'ready' | 'error'

interface Props {
  open: boolean
  status?: TheaterStatus
  /** 用户点击「停止生成」时调用；父级负责真正取消任务 */
  onCancel?: () => void
  /** 用户点击右上「×」最小化时调用；不停止任务 */
  onMinimize?: () => void
}

const PHASES: ReadonlyArray<ReadonlyArray<string>> = [
  ['正在阅读你的偏好…', '理解你的旅行节奏…'],
  ['搜索目的地周边亮点…', '查阅当季节庆与限定活动…', '匹配你品味的小众场所…'],
  ['为你规划最优路线…', '权衡步行与公共交通…', '避开堵车与排队高峰…'],
  ['估算每日开销…', '挑选性价比餐厅…'],
  ['排版每日行程卡…', '为你写下攻略简介…', '正在为你编排成册…'],
] as const

function flatten(): string[] {
  const out: string[] = []
  for (const p of PHASES) for (const s of p) out.push(s)
  return out
}

const FLAT_MESSAGES = flatten()
const LAST_IDX = FLAT_MESSAGES.length - 1

export default function AILoadingTheater({
  open,
  status = 'thinking',
  onCancel,
  onMinimize,
}: Props) {
  const [streamText, setStreamText] = useState<string>(FLAT_MESSAGES[0])

  useEffect(() => {
    if (!open || status !== 'thinking') return
    let idx = 0
    setStreamText(FLAT_MESSAGES[0])
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      if (idx >= LAST_IDX) return
      const delay = 2400 + Math.floor(Math.random() * 1200)
      timer = setTimeout(() => {
        idx += 1
        setStreamText(FLAT_MESSAGES[idx])
        schedule()
      }, delay)
    }
    schedule()
    return () => { if (timer) clearTimeout(timer) }
  }, [open, status])

  if (!open) return null
  const done = status === 'ready'
  const err = status === 'error'

  return (
    <RootPortal>
      <View className='ait-mask theme-tokens'>
        <View className='ait-sheet'>
          <View className='ait-close' onClick={onMinimize}>×</View>
          <View className='ait-stage'>
            <View className={`ait-orb ait-orb--${status}`}>
              <View className='ait-orb-core' />
              <View className='ait-orb-ring r1' />
              <View className='ait-orb-ring r2' />
              <View className='ait-orb-ring r3' />
              {done && <Text className='ait-orb-check'>✓</Text>}
              {err  && <Text className='ait-orb-check'>!</Text>}
            </View>
            <Text className='ait-title'>
              {done ? '已为你编排好' : err ? '生成失败' : 'AI 正在为你编排'}
            </Text>
            <Text className='ait-stream' key={streamText}>
              {done ? '即将就绪' : err ? '请稍后重试' : streamText}
            </Text>
          </View>

          {status === 'thinking' && (
            <View className='ait-cancel' onClick={onCancel}>停止生成</View>
          )}
        </View>
      </View>
    </RootPortal>
  )
}
