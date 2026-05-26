import { useEffect, useRef, useState } from 'react'
import { View, Text, Input, Textarea, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { AIPace, AIAudience, AIPreferences, AIModelAlias } from '../../types/trip'
import { AI_MODEL_ALIASES } from '../../types/trip'
import './index.scss'

interface Props {
  open: boolean
  onSubmit: (prefs: AIPreferences) => void
  onClose: () => void
}

const PACES: AIPace[] = ['悠闲', '平衡', '紧凑']
const AUDIENCES: AIAudience[] = ['独行', '情侣', '亲子', '老人', '朋友']
const DRAFT_KEY = 'ai_plan_form_draft_v1'

interface Draft {
  model: AIModelAlias
  pace: AIPace
  audience: AIAudience[]
  budgetCap: string
  freeText: string
}

const DEFAULT_DRAFT: Draft = {
  model: 'MiMo-V2.5',
  pace: '平衡',
  audience: [],
  budgetCap: '',
  freeText: '',
}

function readDraft(): Draft {
  try {
    const raw = Taro.getStorageSync(DRAFT_KEY)
    if (!raw) return DEFAULT_DRAFT
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return { ...DEFAULT_DRAFT, ...parsed }
  } catch {
    return DEFAULT_DRAFT
  }
}

function writeDraftAsync(d: Draft) {
  // 异步, 不阻塞输入. 失败也不需要 toast (草稿丢一次问题不大).
  ;(Taro.setStorage as (opts: { key: string; data: string; success?: () => void; fail?: (e: unknown) => void }) => void)({
    key: DRAFT_KEY,
    data: JSON.stringify(d),
    fail: () => {},
  })
}

export function clearAIPlanFormDraft() {
  try {
    Taro.removeStorageSync(DRAFT_KEY)
  } catch {}
}

export default function AIPlanForm({ open, onSubmit, onClose }: Props) {
  const [model, setModel] = useState<AIModelAlias>(DEFAULT_DRAFT.model)
  const [pace, setPace] = useState<AIPace>(DEFAULT_DRAFT.pace)
  const [audience, setAudience] = useState<AIAudience[]>(DEFAULT_DRAFT.audience)
  const [budgetCap, setBudgetCap] = useState<string>(DEFAULT_DRAFT.budgetCap)
  const [freeText, setFreeText] = useState<string>(DEFAULT_DRAFT.freeText)

  // 打开时回填草稿
  useEffect(() => {
    if (!open) return
    const d = readDraft()
    setModel(d.model)
    setPace(d.pace)
    setAudience(d.audience)
    setBudgetCap(d.budgetCap)
    setFreeText(d.freeText)
  }, [open])

  // 任一字段变化 → 300ms debounce 异步写入草稿. 避免每键阻塞输入
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!open) return
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current)
    writeTimerRef.current = setTimeout(() => {
      writeDraftAsync({ model, pace, audience, budgetCap, freeText })
    }, 300)
    return () => {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current)
    }
  }, [open, model, pace, audience, budgetCap, freeText])

  if (!open) return null

  const toggleAudience = (a: AIAudience) => {
    setAudience(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }

  const submit = () => {
    const budgetNum = Number(budgetCap)
    onSubmit({
      modelAlias: model,
      pace,
      audience,
      budgetCap: budgetCap && budgetNum > 0 ? budgetNum : undefined,
      freeText: freeText.trim() || undefined,
    })
  }

  return (
    <View className='aif-mask' onClick={onClose}>
      <View className='aif-sheet' catchMove onClick={(e) => e.stopPropagation()}>
        <View className='aif-title'>告诉 AI 你的偏好</View>

        <ScrollView className='aif-scroll' scrollY enhanced showScrollbar={false}>
          <View className='aif-field'>
            <Text className='aif-label'>模型</Text>
            <View className='aif-chips'>
              {AI_MODEL_ALIASES.map(m => (
                <View
                  key={m}
                  className={`aif-chip ${model === m ? 'on' : ''}`}
                  onClick={() => setModel(m)}
                >{m}</View>
              ))}
            </View>
          </View>

          <View className='aif-field'>
            <Text className='aif-label'>节奏</Text>
            <View className='aif-chips'>
              {PACES.map(p => (
                <View
                  key={p}
                  className={`aif-chip ${pace === p ? 'on' : ''}`}
                  onClick={() => setPace(p)}
                >{p}</View>
              ))}
            </View>
          </View>

          <View className='aif-field'>
            <Text className='aif-label'>出行人群(可多选)</Text>
            <View className='aif-chips'>
              {AUDIENCES.map(a => (
                <View
                  key={a}
                  className={`aif-chip ${audience.includes(a) ? 'on' : ''}`}
                  onClick={() => toggleAudience(a)}
                >{a}</View>
              ))}
            </View>
          </View>

          <View className='aif-field'>
            <Text className='aif-label'>预算上限(人均/天 ¥, 可选)</Text>
            <Input
              className='aif-input'
              type='number'
              value={budgetCap}
              onInput={(e) => setBudgetCap(e.detail.value)}
              placeholder='例如 500'
            />
          </View>

          <View className='aif-field'>
            <Text className='aif-label'>其他偏好(可选)</Text>
            <Textarea
              className='aif-textarea'
              value={freeText}
              onInput={(e) => setFreeText(e.detail.value)}
              placeholder='例如: 喜欢拍照、不爱热门景点、想找当地特色餐厅'
              maxlength={500}
              autoHeight
              showConfirmBar={false}
            />
          </View>
        </ScrollView>

        <View className='aif-actions'>
          <View className='aif-btn-cancel' onClick={onClose}>取消</View>
          <View className='aif-btn-submit' onClick={submit}>开始生成</View>
        </View>
      </View>
    </View>
  )
}
