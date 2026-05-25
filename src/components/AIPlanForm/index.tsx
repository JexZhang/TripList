import { useState } from 'react'
import { View, Text, Input, Textarea } from '@tarojs/components'
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

export default function AIPlanForm({ open, onSubmit, onClose }: Props) {
  const [model, setModel] = useState<AIModelAlias>('MiMo-V2.5')
  const [pace, setPace] = useState<AIPace>('平衡')
  const [audience, setAudience] = useState<AIAudience[]>([])
  const [budgetCap, setBudgetCap] = useState<string>('')
  const [freeText, setFreeText] = useState<string>('')

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
            maxlength={200}
          />
        </View>

        <View className='aif-actions'>
          <View className='aif-btn-cancel' onClick={onClose}>取消</View>
          <View className='aif-btn-submit' onClick={submit}>开始生成</View>
        </View>
      </View>
    </View>
  )
}
