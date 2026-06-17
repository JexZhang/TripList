import { useCallback, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Textarea, Input, RootPortal, Picker } from '@tarojs/components'
import type { ITouchEvent } from '@tarojs/components/types'
import DatePicker from '../DatePicker'
import DestinationPicker from '../DestinationPicker'
import SparkleIcon from '../SparkleIcon'
import { useKeyboardLift } from '../../utils/use-keyboard-height'
import { useMe } from '../../store/me-store'
import {
  AI_INTERVIEW,
  type InterviewAnswers,
  type InterviewQuestion,
  type OptionLabel,
  answersToPreferences,
} from '../../data/ai-interview'
import {
  STEP_TITLES,
  STEP_SKIP_HINT,
  emptyCreateAnswers,
  type CreateAnswers,
} from '../../data/ai-interview-create'
import type { AIPreferences, Destination } from '../../types/trip'
import './index.scss'

export type AIInterviewSubmit =
  | {
      mode: 'create'
      destinations: Destination[]
      startDate: string
      endDate: string
      pax: number
      preferences: AIPreferences
      name?: string
    }
  | {
      mode: 'enrich'
      preferences: AIPreferences
    }

interface Props {
  open: boolean
  mode: 'create' | 'enrich'
  tripId?: string
  onClose: () => void
  onSubmit: (data: AIInterviewSubmit) => void
}

// === Draft persistence ===
const DRAFT_KEY_CREATE = 'ai-interview-draft-create'
const draftKeyEnrich = (tripId: string) => `ai-interview-draft-enrich-${tripId}`

interface CreateDraft { stepIdx: number; answers: CreateAnswers }
interface EnrichDraft { stepIdx: number; answers: InterviewAnswers }

function readDraft<T>(key: string): T | null {
  try {
    const v = Taro.getStorageSync(key)
    return v ? (v as T) : null
  } catch {
    return null
  }
}
function writeDraft(key: string, value: unknown): void {
  try { Taro.setStorageSync(key, value) } catch { /* storage full, ignore */ }
}
function clearDraft(key: string): void {
  try { Taro.removeStorageSync(key) } catch { /* ignore */ }
}

export { DRAFT_KEY_CREATE, draftKeyEnrich, clearDraft }

// === Step count constants ===
const PREFS_COUNT = AI_INTERVIEW.length // 5
const CREATE_TOTAL = 3 + PREFS_COUNT + 1 // dest + dates + pax + prefs×5 + name = 9
const ENRICH_TOTAL = PREFS_COUNT // 5
const CREATE_PREFS_START = 3
const CREATE_NAME_IDX = 8

// === Component ===
export default function AIInterview({ open, mode, tripId, onClose, onSubmit }: Props) {
  const isCreate = mode === 'create'
  const totalSteps = isCreate ? CREATE_TOTAL : ENRICH_TOTAL

  const [answers, setAnswers] = useState<CreateAnswers>(emptyCreateAnswers)
  const [prefAnswers, setPrefAnswers] = useState<InterviewAnswers>({})
  const [stepIdx, setStepIdx] = useState(0)
  const [slideDir, setSlideDir] = useState<'left' | 'right' | ''>('')
  const [textBuf, setTextBuf] = useState('')
  const touchRef = useRef<{ x: number; y: number } | null>(null)
  const { height: keyboardHeight, bind: kbProps } = useKeyboardLift()

  // ─── 配额：消费 me-store 缓存（SWR：有缓存立即显示 + 打开时后台校正）───
  const { quota: cachedQuota, refreshQuota } = useMe()
  const quota = cachedQuota ?? { flash: 0, pro: 0 }
  useEffect(() => {
    if (!open) return
    void refreshQuota()
  }, [open, refreshQuota])

  // Mount: restore draft or reset
  useEffect(() => {
    if (!open) return
    if (isCreate) {
      const d = readDraft<CreateDraft>(DRAFT_KEY_CREATE)
      if (d) {
        setAnswers(d.answers)
        setStepIdx(Math.min(d.stepIdx, CREATE_TOTAL - 1))
      } else {
        setAnswers(emptyCreateAnswers())
        setStepIdx(0)
      }
      setPrefAnswers({})
    } else {
      const key = tripId ? draftKeyEnrich(tripId) : ''
      const d = key ? readDraft<EnrichDraft>(key) : null
      setPrefAnswers(d?.answers ?? {})
      setStepIdx(d ? Math.min(d.stepIdx, ENRICH_TOTAL - 1) : 0)
    }
    setTextBuf('')
  }, [open, isCreate, tripId])

  // Persist draft on every change
  useEffect(() => {
    if (!open) return
    if (isCreate) {
      writeDraft(DRAFT_KEY_CREATE, { stepIdx, answers } satisfies CreateDraft)
    } else if (tripId) {
      writeDraft(draftKeyEnrich(tripId), { stepIdx, answers: prefAnswers } satisfies EnrichDraft)
    }
  }, [open, isCreate, tripId, stepIdx, answers, prefAnswers])

  const animateStep = useCallback((dir: 'left' | 'right', fn: () => void) => {
    setSlideDir(dir)
    setTimeout(() => { fn(); setSlideDir('') }, 180)
  }, [])

  // === Derived state (before early return for hook ordering) ===
  const inPrefs = isCreate
    ? (stepIdx >= CREATE_PREFS_START && stepIdx < CREATE_NAME_IDX)
    : true
  const prefSubStep = isCreate ? stepIdx - CREATE_PREFS_START : stepIdx

  // Sync textBuf when navigating to a text/number prefs question
  useEffect(() => {
    if (!open || !inPrefs) return
    const q = AI_INTERVIEW[prefSubStep]
    if (q && (q.type === 'number' || q.type === 'free')) {
      const saved = prefAnswers[q.id as keyof InterviewAnswers] as string | undefined
      setTextBuf(saved || '')
    }
  }, [open, stepIdx, inPrefs, prefSubStep, prefAnswers])

  if (!open) return null

  const isLastStep = stepIdx === totalSteps - 1

  // === Navigation ===
  const goNext = () => animateStep('left', () => setStepIdx((s) => Math.min(s + 1, totalSteps - 1)))
  const goBack = () => animateStep('right', () => setStepIdx((s) => Math.max(s - 1, 0)))

  const handleBack = () => {
    if (stepIdx === 0) return
    if (isCreate && stepIdx === CREATE_PREFS_START) goBack() // exit prefs → pax
    else if (!isCreate && stepIdx === 0) return // enrich first step: no-op
    else goBack()
  }

  const handleCreateSubmit = () => {
    onSubmit({
      mode: 'create',
      destinations: answers.destinations,
      startDate: answers.startDate,
      endDate: answers.endDate,
      pax: answers.pax,
      preferences: answers.preferences,
      name: answers.name.trim() || undefined,
    })
  }

  const handleEnrichSubmit = (final?: InterviewAnswers) => {
    onSubmit({ mode: 'enrich', preferences: answersToPreferences(final ?? prefAnswers) })
  }

  const handleSubmit = () => {
    // 配额校验由云函数 ai-plan-trip 服务端权威执行，前端直接提交
    if (isCreate) {
      handleCreateSubmit()
    } else {
      handleEnrichSubmit()
    }
  }

  const handleNext = () => {
    if (isLastStep) {
      handleSubmit()
      return
    }
    goNext()
  }

  const handleSkip = () => {
    if (!isCreate) { handleSubmit(); return }
    if (stepIdx === 0) { goNext(); return } // dest skip → dates
    if (stepIdx === CREATE_NAME_IDX) { handleSubmit(); return } // name skip → submit
    goNext()
  }

  const handlePrefAnswer = (updated: InterviewAnswers) => {
    setPrefAnswers(updated)
    if (isCreate) {
      setAnswers((a) => ({ ...a, preferences: answersToPreferences(updated) }))
    }
  }

  const handleTextSubmit = (updated: InterviewAnswers) => {
    setPrefAnswers(updated)
    if (isCreate) {
      setAnswers((a) => ({ ...a, preferences: answersToPreferences(updated) }))
    }
    setTextBuf('')
    if (!isLastStep) goNext()
    else handleSubmit()
  }

  const handleSkipFree = () => {
    const q = AI_INTERVIEW[prefSubStep]
    if (!q) return
    const updated = { ...prefAnswers, [q.id]: '' }
    setPrefAnswers(updated)
    if (isCreate) {
      setAnswers((a) => ({ ...a, preferences: answersToPreferences(updated) }))
    }
    setTextBuf('')
    if (!isLastStep) goNext()
    else handleSubmit()
  }

  // Touch swipe
  const onTouchStart = (e: ITouchEvent) => {
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: ITouchEvent) => {
    if (!touchRef.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchRef.current.x
    const dy = t.clientY - touchRef.current.y
    touchRef.current = null
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.7) return
    if (dx > 0) handleBack()
    else handleNext()
  }

  // === Step content rendering ===
  const renderStepContent = () => {
    // Create: dest (0), dates (1), pax (2)
    if (isCreate && stepIdx === 0) {
      return (
        <View className='aiv-step'>
          <Text className='aiv-q'>{STEP_TITLES.dest}</Text>
          <DestinationPicker value={answers.destinations} onChange={(v) => setAnswers((a) => ({ ...a, destinations: v }))} />
          <View className='aiv-foot'>
            <View className='aiv-skip' onClick={handleSkip}>{STEP_SKIP_HINT.dest}</View>
            <View className='aiv-next' onClick={handleNext}>下一步 →</View>
          </View>
        </View>
      )
    }
    if (isCreate && stepIdx === 1) {
      return (
        <View className='aiv-step'>
          <Text className='aiv-q'>{STEP_TITLES.dates}</Text>
          <DatePicker
            value={{ start: answers.startDate, end: answers.endDate }}
            onChange={(v) => setAnswers((a) => ({ ...a, startDate: v.start, endDate: v.end }))}
          />
          <View className='aiv-foot'>
            <View className='aiv-back' onClick={handleBack}>← 上一步</View>
            <View className='aiv-next' onClick={handleNext}>下一步 →</View>
          </View>
        </View>
      )
    }
    if (isCreate && stepIdx === 2) {
      const PAX_OPTIONS = Array.from({ length: 99 }, (_, i) => `${i + 1} 人`)
      return (
        <View className='aiv-step'>
          <Text className='aiv-q'>{STEP_TITLES.pax}</Text>
          <Picker
            mode='selector'
            range={PAX_OPTIONS}
            value={Math.max(0, Math.min(98, answers.pax - 1))}
            onChange={(e) => setAnswers((a) => ({ ...a, pax: Number(e.detail.value) + 1 }))}
          >
            <View className='aiv-pax-picker'>
              <Text>{answers.pax} 人</Text>
              <Text>▾</Text>
            </View>
          </Picker>
          <View className='aiv-foot'>
            <View className='aiv-back' onClick={handleBack}>← 上一步</View>
            <View className='aiv-next' onClick={handleNext}>下一步 →</View>
          </View>
        </View>
      )
    }
    // Create: name (8)
    if (isCreate && stepIdx === CREATE_NAME_IDX) {
      return (
        <View className='aiv-step'>
          <Text className='aiv-q'>{STEP_TITLES.name}</Text>
          <Input
            className='aiv-input'
            value={answers.name}
            placeholder='例：京都 · 晚秋四日'
            {...kbProps}
            onInput={(e) => setAnswers((a) => ({ ...a, name: e.detail.value }))}
          />
          <View className='aiv-foot'>
            <View className='aiv-back' onClick={handleBack}>← 上一步</View>
            <View className='aiv-skip' onClick={handleSkip}>{STEP_SKIP_HINT.name}</View>
            <View className='aiv-next' onClick={handleNext}>开始生成</View>
          </View>
        </View>
      )
    }
    // Prefs (create steps 3-7 or enrich steps 0-4)
    if (inPrefs) {
      const isFirst = stepIdx === 0
      return (
        <PrefsSubflow
          question={AI_INTERVIEW[prefSubStep]}
          answers={isCreate ? (answers.preferences as unknown as InterviewAnswers) : prefAnswers}
          onAnswer={handlePrefAnswer}
          onNext={handleNext}
          onBack={isFirst ? undefined : handleBack}
          onSkip={handleSkip}
          onTextSubmit={handleTextSubmit}
          onSkipFree={handleSkipFree}
          textBuf={textBuf}
          setTextBuf={setTextBuf}
          kbProps={kbProps}
          isLast={isLastStep}
          quota={quota}
        />
      )
    }
    return null
  }

  return (
    <RootPortal>
      <View className='aiv-mask theme-tokens' onClick={onClose}>
        <View
          className='aiv-sheet'
          catchMove
          style={{
            // 用 margin-bottom 抬升（mask 为 align-items:flex-end，等效上推）。
            // 不能用 transform：sheet-up 入场动画(fill:both)会保留 translateY(0) 覆盖内联 transform。
            marginBottom: `${keyboardHeight}px`,
            transition: 'margin-bottom 0.25s ease',
          }}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <View className='aiv-head'>
            <View className='aiv-progress'>
              {Array.from({ length: totalSteps }, (_, i) => (
                <View key={i}
                  className={`aiv-dot ${i < stepIdx ? 'done' : ''} ${i === stepIdx ? 'now' : ''}`}
                  onClick={() => {
                    if (i < stepIdx) animateStep('right', () => setStepIdx(i))
                    else if (i > stepIdx) animateStep('left', () => setStepIdx(i))
                  }}
                />
              ))}
            </View>
            <View className='aiv-close' onClick={onClose}>×</View>
          </View>

          <View className={`aiv-slide ${slideDir ? `out-${slideDir}` : 'in'}`} key={stepIdx}>
            {renderStepContent()}
          </View>
        </View>
      </View>
    </RootPortal>
  )
}

// === PrefsSubflow: controlled, stateless ===
interface KbBind {
  adjustPosition: false
  onKeyboardHeightChange: (e: { detail: { height: number } }) => void
}

interface PrefsSubflowProps {
  question: InterviewQuestion
  answers: InterviewAnswers
  onAnswer: (a: InterviewAnswers) => void
  onNext: () => void
  onBack?: () => void
  onSkip: () => void
  onTextSubmit: (a: InterviewAnswers) => void
  onSkipFree: () => void
  textBuf: string
  setTextBuf: (s: string) => void
  kbProps: KbBind
  isLast: boolean
  quota: { flash: number; pro: number }
}

function PrefsSubflow({
  question: q, answers, onAnswer, onNext, onBack, onSkip,
  onTextSubmit, onSkipFree, textBuf, setTextBuf, kbProps, isLast, quota,
}: PrefsSubflowProps) {
  if (!q) return null
  const nextLabel = isLast ? '开始生成' : '下一步 →'

  return (
    <View className='aiv-step aiv-prefs-host'>
      <View className='aiv-bubble'>
        <View className='aiv-bubble-avatar'><SparkleIcon size={28} /></View>
        <Text className='aiv-bubble-text'>{q.q}</Text>
      </View>

      {q.type === 'single' && q.options && (
        <>
          {q.optionLabels ? (
            <View className='aiv-model-cards'>
              {q.options.map((opt) => {
                const info: OptionLabel | undefined = q.optionLabels![opt]
                const selected = answers[q.id as keyof InterviewAnswers] === opt
                const remain = opt === 'DeepSeek-V4-PRO' ? quota.pro : quota.flash
                return (
                  <View key={opt}
                    className={`aiv-model-card ${selected ? 'on' : ''}`}
                    onClick={() => onAnswer({ ...answers, [q.id]: opt })}
                  >
                    <View className='aiv-model-head'>
                      <Text className='aiv-model-label'>{info?.label ?? opt}</Text>
                      {info?.tag && <Text className='aiv-model-tag'>{info.tag}</Text>}
                    </View>
                    {info?.desc && <Text className='aiv-model-desc'>{info.desc}</Text>}
                    <Text className='aiv-model-quota'>
                      今日剩余 {remain} 次
                    </Text>
                  </View>
                )
              })}
            </View>
          ) : (
            <View className='aiv-chips'>
              {q.options.map((opt) => (
                <View key={opt}
                  className={`aiv-chip ${answers[q.id as keyof InterviewAnswers] === opt ? 'on' : ''}`}
                  onClick={() => onAnswer({ ...answers, [q.id]: opt })}
                >{opt}</View>
              ))}
            </View>
          )}
          <View className='aiv-foot'>
            {onBack && <View className='aiv-back' onClick={onBack}>← 上一步</View>}
            <View className='aiv-next' onClick={onNext}>{nextLabel}</View>
          </View>
        </>
      )}

      {q.type === 'multi' && q.options && (
        <>
          <View className='aiv-chips'>
            {q.options.map((opt) => {
              const arr = (answers[q.id as keyof InterviewAnswers] as string[] | undefined) || []
              return (
                <View key={opt}
                  className={`aiv-chip ${arr.includes(opt) ? 'on' : ''}`}
                  onClick={() => {
                    const prev = (answers[q.id as keyof InterviewAnswers] as string[] | undefined) || []
                    const next = prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
                    onAnswer({ ...answers, [q.id]: next })
                  }}
                >{opt}</View>
              )
            })}
          </View>
          <View className='aiv-foot'>
            {onBack && <View className='aiv-back' onClick={onBack}>← 上一步</View>}
            <View className='aiv-skip' onClick={onSkip}>跳过</View>
            <View className='aiv-next' onClick={onNext}>{nextLabel}</View>
          </View>
        </>
      )}

      {(q.type === 'number' || q.type === 'free') && (
        <>
          {q.type === 'number' ? (
            <Input className='aiv-input' type='number' value={textBuf}
              placeholder={q.placeholder}
              {...kbProps}
              onInput={(e) => setTextBuf(e.detail.value)} />
          ) : (
            <Textarea className='aiv-textarea' value={textBuf}
              placeholder={q.placeholder}
              {...kbProps}
              onInput={(e) => setTextBuf(e.detail.value)} maxlength={500} autoHeight showConfirmBar={false} />
          )}
          <View className='aiv-foot'>
            {onBack && <View className='aiv-back' onClick={onBack}>← 上一步</View>}
            <View className='aiv-skip' onClick={onSkipFree}>跳过</View>
            <View className='aiv-next' onClick={() => {
              onTextSubmit({ ...answers, [q.id]: textBuf.trim() })
            }}>{nextLabel}</View>
          </View>
        </>
      )}
    </View>
  )
}
