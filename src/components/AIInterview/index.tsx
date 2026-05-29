import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Textarea, Input, RootPortal, Picker } from '@tarojs/components'
import DatePicker from '../DatePicker'
import DestinationPicker from '../DestinationPicker'
import SparkleIcon from '../SparkleIcon'
import { useKeyboardLift } from '../../utils/use-keyboard-height'
import {
  AI_INTERVIEW,
  type InterviewAnswers,
  type InterviewQuestion,
  answersToPreferences,
} from '../../data/ai-interview'
import {
  CREATE_STEPS,
  STEP_TITLES,
  STEP_SKIP_HINT,
  emptyCreateAnswers,
  type CreateAnswers,
  type CreateStepId,
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
interface EnrichDraft { answers: InterviewAnswers }

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

// === Component ===
export default function AIInterview({ open, mode, tripId, onClose, onSubmit }: Props) {
  const isCreate = mode === 'create'
  const [answers, setAnswers] = useState<CreateAnswers>(emptyCreateAnswers)
  const [enrichAnswers, setEnrichAnswers] = useState<InterviewAnswers>({})
  const [stepIdx, setStepIdx] = useState(0)
  const [textBuf, setTextBuf] = useState('')
  const { height: keyboardHeight, bind: kbProps } = useKeyboardLift()

  // Mount: restore draft or reset
  useEffect(() => {
    if (!open) return
    if (isCreate) {
      const d = readDraft<CreateDraft>(DRAFT_KEY_CREATE)
      if (d) {
        setAnswers(d.answers)
        setStepIdx(Math.min(d.stepIdx, CREATE_STEPS.length - 1))
      } else {
        setAnswers(emptyCreateAnswers())
        setStepIdx(0)
      }
    } else {
      const key = tripId ? draftKeyEnrich(tripId) : ''
      const d = key ? readDraft<EnrichDraft>(key) : null
      setEnrichAnswers(d?.answers ?? {})
      setStepIdx(0)
    }
    setTextBuf('')
  }, [open, isCreate, tripId])

  // Persist draft on every change
  useEffect(() => {
    if (!open) return
    if (isCreate) {
      writeDraft(DRAFT_KEY_CREATE, { stepIdx, answers } satisfies CreateDraft)
    } else if (tripId) {
      writeDraft(draftKeyEnrich(tripId), { answers: enrichAnswers } satisfies EnrichDraft)
    }
  }, [open, isCreate, tripId, stepIdx, answers, enrichAnswers])

  if (!open) return null

  const createStep = CREATE_STEPS[stepIdx]
  const createDone = stepIdx >= CREATE_STEPS.length

  const goNext = () => setStepIdx((s) => s + 1)

  const updateAnswer = <K extends keyof CreateAnswers>(k: K, v: CreateAnswers[K]) => {
    setAnswers((a) => ({ ...a, [k]: v }))
  }

  const submitCreate = () => {
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

  const renderCreateStep = () => {
    if (createStep === 'dest') {
      return (
        <View className='aiv-step'>
          <Text className='aiv-q'>{STEP_TITLES.dest}</Text>
          <DestinationPicker value={answers.destinations} onChange={(v) => updateAnswer('destinations', v)} />
          <View className='aiv-foot'>
            <View className='aiv-skip' onClick={goNext}>{STEP_SKIP_HINT.dest}</View>
            <View className='aiv-next' onClick={goNext}>下一步 →</View>
          </View>
        </View>
      )
    }
    if (createStep === 'dates') {
      return (
        <View className='aiv-step'>
          <Text className='aiv-q'>{STEP_TITLES.dates}</Text>
          <DatePicker
            value={{ start: answers.startDate, end: answers.endDate }}
            onChange={(v) => setAnswers((a) => ({ ...a, startDate: v.start, endDate: v.end }))}
          />
          <View className='aiv-foot'>
            <View className='aiv-next' onClick={goNext}>下一步 →</View>
          </View>
        </View>
      )
    }
    if (createStep === 'pax') {
      const PAX_OPTIONS = Array.from({ length: 99 }, (_, i) => `${i + 1} 人`)
      return (
        <View className='aiv-step'>
          <Text className='aiv-q'>{STEP_TITLES.pax}</Text>
          <Picker
            mode='selector'
            range={PAX_OPTIONS}
            value={Math.max(0, Math.min(98, answers.pax - 1))}
            onChange={(e) => updateAnswer('pax', Number(e.detail.value) + 1)}
          >
            <View className='aiv-pax-picker'>
              <Text>{answers.pax} 人</Text>
              <Text>▾</Text>
            </View>
          </Picker>
          <View className='aiv-foot'>
            <View className='aiv-next' onClick={goNext}>下一步 →</View>
          </View>
        </View>
      )
    }
    if (createStep === 'prefs') {
      return renderPrefsStep(false)
    }
    if (createStep === 'name') {
      return (
        <View className='aiv-step'>
          <Text className='aiv-q'>{STEP_TITLES.name}</Text>
          <Input
            className='aiv-input'
            value={answers.name}
            placeholder='例：京都 · 晚秋四日'
            {...kbProps}
            onInput={(e) => updateAnswer('name', e.detail.value)}
          />
          <View className='aiv-foot'>
            <View className='aiv-skip' onClick={submitCreate}>{STEP_SKIP_HINT.name}</View>
            <View className='aiv-next' onClick={submitCreate}>开始生成</View>
          </View>
        </View>
      )
    }
    return null
  }

  const renderPrefsStep = (isEnrich: boolean) => {
    return (
      <View className='aiv-step aiv-prefs-host'>
        <PrefsSubflow
          answers={isEnrich ? enrichAnswers : (answers.preferences as unknown as InterviewAnswers)}
          onAnswers={(a) => {
            if (isEnrich) setEnrichAnswers(a)
            else updateAnswer('preferences', answersToPreferences(a))
          }}
          onDone={() => {
            if (isEnrich) {
              onSubmit({ mode: 'enrich', preferences: answersToPreferences(enrichAnswers) })
            } else {
              goNext()
            }
          }}
          onSkip={() => {
            if (isEnrich) {
              onSubmit({ mode: 'enrich', preferences: answersToPreferences({}) })
            } else {
              goNext()
            }
          }}
          kbProps={kbProps}
        />
      </View>
    )
  }

  return (
    <RootPortal>
      <View className='aiv-mask theme-tokens' onClick={onClose}>
        <View
          className='aiv-sheet'
          catchMove
          style={{
            transform: `translateY(-${keyboardHeight}px)`,
            transition: 'transform 0.25s ease',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <View className='aiv-head'>
            <View className='aiv-progress'>
              {(isCreate ? CREATE_STEPS : AI_INTERVIEW).map((_, i) => (
                <View key={i}
                  className={`aiv-dot ${i < stepIdx ? 'done' : ''} ${i === stepIdx ? 'now' : ''}`}
                />
              ))}
            </View>
            <View className='aiv-close' onClick={onClose}>×</View>
          </View>

          {isCreate ? (
            createDone ? null : renderCreateStep()
          ) : (
            <PrefsSubflow
              answers={enrichAnswers}
              onAnswers={setEnrichAnswers}
              onDone={() => onSubmit({ mode: 'enrich', preferences: answersToPreferences(enrichAnswers) })}
              onSkip={() => onSubmit({ mode: 'enrich', preferences: answersToPreferences({}) })}
              kbProps={kbProps}
            />
          )}
        </View>
      </View>
    </RootPortal>
  )
}

// === PrefsSubflow: shared between create prefs step and enrich mode ===
interface KbBind {
  adjustPosition: false
  onKeyboardHeightChange: (e: { detail: { height: number } }) => void
}

interface PrefsSubflowProps {
  answers: InterviewAnswers
  onAnswers: (a: InterviewAnswers) => void
  onDone: () => void
  onSkip: () => void
  kbProps: KbBind
}

function PrefsSubflow({ answers, onAnswers, onDone, onSkip, kbProps }: PrefsSubflowProps) {
  const [subStep, setSubStep] = useState(0)
  const [textBuf, setTextBuf] = useState('')
  const q: InterviewQuestion | undefined = AI_INTERVIEW[subStep]
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  // 完成后在 effect 中触发 onDone，避免 render 中 setState
  useEffect(() => {
    if (subStep >= AI_INTERVIEW.length) {
      doneRef.current()
    }
  }, [subStep])

  // 切步时从 draft 恢复 textBuf（number/free 类型字段）
  useEffect(() => {
    if (q && (q.type === 'number' || q.type === 'free')) {
      const saved = answers[q.id as keyof InterviewAnswers] as string | undefined
      setTextBuf(saved || '')
    }
  }, [subStep])

  if (subStep >= AI_INTERVIEW.length) return null
  if (!q) return null

  const pickSingle = (opt: string) => {
    onAnswers({ ...answers, [q.id]: opt })
    setTimeout(() => setSubStep((s) => s + 1), 280)
  }
  const toggleMulti = (opt: string) => {
    const prev = (answers[q.id as keyof InterviewAnswers] as string[] | undefined) || []
    const next = prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
    onAnswers({ ...answers, [q.id]: next })
  }
  const submitTextOrNumber = () => {
    onAnswers({ ...answers, [q.id]: textBuf.trim() })
    setTextBuf('')
    setSubStep((s) => s + 1)
  }
  const skipFree = () => {
    onAnswers({ ...answers, [q.id]: '' })
    setTextBuf('')
    setSubStep((s) => s + 1)
  }

  return (
    <View className='aiv-current'>
      <View className='aiv-bubble'>
        <View className='aiv-bubble-avatar'><SparkleIcon size={28} /></View>
        <Text className='aiv-bubble-text'>{q.q}</Text>
      </View>
      {q.type === 'single' && q.options && (
        <View className='aiv-chips'>
          {q.options.map((opt) => (
            <View key={opt}
              className={`aiv-chip ${answers[q.id as keyof InterviewAnswers] === opt ? 'on' : ''}`}
              onClick={() => pickSingle(opt)}
            >{opt}</View>
          ))}
        </View>
      )}
      {q.type === 'multi' && q.options && (
        <>
          <View className='aiv-chips'>
            {q.options.map((opt) => {
              const arr = (answers[q.id as keyof InterviewAnswers] as string[] | undefined) || []
              return (
                <View key={opt}
                  className={`aiv-chip ${arr.includes(opt) ? 'on' : ''}`}
                  onClick={() => toggleMulti(opt)}
                >{opt}</View>
              )
            })}
          </View>
          <View className='aiv-foot'>
            <View className='aiv-skip' onClick={onSkip}>跳过</View>
            <View className='aiv-next' onClick={() => setSubStep((s) => s + 1)}>下一题 →</View>
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
            <View className='aiv-skip' onClick={skipFree}>跳过</View>
            <View className='aiv-next' onClick={submitTextOrNumber}>下一步 →</View>
          </View>
        </>
      )}
    </View>
  )
}
