import { useEffect, useState } from 'react'
import { View, Text, Textarea, Input } from '@tarojs/components'
import SparkleIcon from '../SparkleIcon'
import {
  AI_INTERVIEW,
  type InterviewAnswers,
  type InterviewQuestion,
  answersToPreferences,
} from '../../data/ai-interview'
import type { AIPreferences } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (prefs: AIPreferences) => void
}

export default function AIInterview({ open, onClose, onSubmit }: Props) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<InterviewAnswers>({})
  const [textBuf, setTextBuf] = useState('')

  useEffect(() => {
    if (open) {
      setStep(0)
      setAnswers({})
      setTextBuf('')
    }
  }, [open])

  if (!open) return null

  const total = AI_INTERVIEW.length
  const done = step >= total
  const q: InterviewQuestion | undefined = AI_INTERVIEW[step]

  const pickSingle = (opt: string) => {
    if (!q) return
    setAnswers((a) => ({ ...a, [q.id]: opt }))
    setTimeout(() => setStep((s) => s + 1), 280)
  }

  const toggleMulti = (opt: string) => {
    if (!q) return
    setAnswers((a) => {
      const prev = (a[q.id as keyof InterviewAnswers] as string[] | undefined) || []
      const next = prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
      return { ...a, [q.id]: next }
    })
  }

  const submitTextOrNumber = () => {
    if (!q) return
    const v = textBuf.trim()
    setAnswers((a) => ({ ...a, [q.id]: v }))
    setTextBuf('')
    setStep((s) => s + 1)
  }

  const skipFree = () => {
    if (!q) return
    setAnswers((a) => ({ ...a, [q.id]: '' }))
    setTextBuf('')
    setStep((s) => s + 1)
  }

  const finish = () => {
    onSubmit(answersToPreferences(answers))
  }

  return (
    <View className='aiv-mask theme-tokens' onClick={onClose}>
      <View className='aiv-sheet' catchMove onClick={(e) => e.stopPropagation()}>
        <View className='aiv-head'>
          <View className='aiv-progress'>
            {AI_INTERVIEW.map((_, i) => (
              <View
                key={i}
                className={`aiv-dot ${i < step ? 'done' : ''} ${i === step ? 'now' : ''}`}
              />
            ))}
          </View>
          <View className='aiv-close' onClick={onClose}>×</View>
        </View>

        <View className='aiv-history'>
          {AI_INTERVIEW.slice(0, step).map((qq) => {
            const v = answers[qq.id as keyof InterviewAnswers]
            const display = Array.isArray(v)
              ? (v.length ? v.join('、') : '随意')
              : (v || '随意')
            return (
              <View key={qq.id} className='aiv-history-row'>
                <Text className='aiv-history-q'>{qq.q}</Text>
                <Text className='aiv-history-a'>{display}</Text>
              </View>
            )
          })}
        </View>

        {!done && q && (
          <View className='aiv-current' key={step}>
            <View className='aiv-bubble'>
              <View className='aiv-bubble-avatar'>
                <SparkleIcon size={28} />
              </View>
              <Text className='aiv-bubble-text'>{q.q}</Text>
            </View>

            {q.type === 'single' && q.options && (
              <View className='aiv-chips'>
                {q.options.map((opt) => (
                  <View
                    key={opt}
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
                      <View
                        key={opt}
                        className={`aiv-chip ${arr.includes(opt) ? 'on' : ''}`}
                        onClick={() => toggleMulti(opt)}
                      >{opt}</View>
                    )
                  })}
                </View>
                <View className='aiv-next' onClick={() => setStep((s) => s + 1)}>
                  下一题 →
                </View>
              </>
            )}

            {q.type === 'number' && (
              <>
                <Input
                  className='aiv-input'
                  type='number'
                  value={textBuf}
                  placeholder={q.placeholder}
                  onInput={(e) => setTextBuf(e.detail.value)}
                />
                <View className='aiv-foot'>
                  <View className='aiv-skip' onClick={skipFree}>跳过</View>
                  <View className='aiv-next' onClick={submitTextOrNumber}>下一步 →</View>
                </View>
              </>
            )}

            {q.type === 'free' && (
              <>
                <Textarea
                  className='aiv-textarea'
                  value={textBuf}
                  placeholder={q.placeholder}
                  onInput={(e) => setTextBuf(e.detail.value)}
                  maxlength={500}
                  autoHeight
                  showConfirmBar={false}
                />
                <View className='aiv-foot'>
                  <View className='aiv-skip' onClick={skipFree}>跳过</View>
                  <View className='aiv-next' onClick={submitTextOrNumber}>下一步 →</View>
                </View>
              </>
            )}
          </View>
        )}

        {done && (
          <View className='aiv-confirm'>
            <Text className='aiv-confirm-title'>我听明白了</Text>
            <Text className='aiv-confirm-sub'>将基于你的偏好为你生成行程草稿</Text>
            <View className='aiv-go' onClick={finish}>
              <SparkleIcon size={32} />
              <Text>开始生成</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  )
}
