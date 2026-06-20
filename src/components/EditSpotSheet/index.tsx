import { useState, useEffect } from 'react'
import { View, Text, Input, Textarea, Picker, ScrollView, RootPortal } from '@tarojs/components'
import type { Spot, SpotType } from '../../types/trip'
import SpotSearch, { type SelectedSpotInfo } from '../SpotSearch'
import { useKeyboardLift } from '../../utils/use-keyboard-height'
import './index.scss'

const TYPES: { key: SpotType; label: string }[] = [
  { key: 'spot', label: '其他' },
  { key: 'hotel', label: '住宿' },
  { key: 'meal', label: '餐饮' },
  { key: 'transport', label: '交通' },
]

interface Props {
  open: boolean
  spot: Spot | null
  defaultCity?: string
  onClose: () => void
  onSave: (patch: Partial<Spot>) => void
  onDelete: () => void
}

export default function EditSpotSheet({ open, spot, defaultCity, onClose, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<Partial<Spot>>({})
  const [searchOpen, setSearchOpen] = useState(false)
  const { height: keyboardHeight, bind: kbProps } = useKeyboardLift()

  useEffect(() => {
    if (open && spot) {
      setDraft({ ...spot })
    }
  }, [open, spot])

  if (!open || !spot) return null

  const set = <K extends keyof Spot>(k: K, v: Spot[K]) => setDraft(d => ({ ...d, [k]: v }))

  const replaceLocation = (info: SelectedSpotInfo) => {
    setDraft(d => ({
      ...d,
      name: info.name,
      city: info.city,
      adcode: info.adcode,
      lat: info.lat,
      lng: info.lng,
    }))
  }

  const save = () => {
    onSave(draft)
    onClose()
  }

  const type = draft.type || 'spot'

  return (
    <>
    <RootPortal>
    <View className='edit-spot-mask theme-tokens' onClick={onClose}>
      <View
        className='edit-spot-sheet'
        style={{
          bottom: `${keyboardHeight}px`,
          transition: 'bottom 0.25s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        <View className='es-head'>
          <Text className='es-title'>编辑地点</Text>
          <Text className='es-close' onClick={onClose}>×</Text>
        </View>

        <ScrollView className='es-body' scrollY>
          {/* 名字(点击重开搜索) */}
          <View className='es-field'>
            <Text className='es-label'>地点</Text>
            <View className='es-name-row' onClick={() => setSearchOpen(true)}>
              <Text className='es-name'>{draft.name || '(未填)'}</Text>
            </View>
            {draft.city && <Text className='es-name-city'>{draft.city}</Text>}
          </View>

          {/* 时间 */}
          <View className='es-field'>
            <Text className='es-label'>时间</Text>
            <Picker
              mode='time'
              value={draft.time || '12:00'}
              onChange={e => set('time', String(e.detail.value))}
            >
              <View className='es-picker'>{draft.time || '点此选时间'}</View>
            </Picker>
          </View>

          {/* 类型 */}
          <View className='es-field'>
            <Text className='es-label'>类型</Text>
            <View className='es-types'>
              {TYPES.map(t => (
                <View
                  key={t.key}
                  className={`es-type ${type === t.key ? 'on' : ''}`}
                  onClick={() => set('type', t.key)}
                >{t.label}</View>
              ))}
            </View>
          </View>

          {/* 价格 */}
          <View className='es-field'>
            <Text className='es-label'>价格</Text>
            <Input
              className='es-input'
              type='digit'
              placeholder='0'
              value={draft.price != null ? String(draft.price) : ''}
              onInput={e => {
                const v = e.detail.value
                const n = v ? parseInt(v, 10) || 0 : undefined
                set('price', n != null ? Math.max(0, Math.min(n, 999999)) : undefined)
              }}
              {...kbProps}
            />
          </View>

          {/* 备注 */}
          <View className='es-field'>
            <Text className='es-label'>备注</Text>
            <Textarea
              className='es-textarea'
              placeholder='交通方式 / 注意事项 / 等等...'
              value={draft.note || ''}
              onInput={e => set('note', e.detail.value)}
              maxlength={200}
              autoHeight
              showConfirmBar={false}
              {...kbProps}
            />
          </View>

          {/* type=hotel 专属 */}
          {type === 'hotel' && (
            <View className='es-field'>
              <Text className='es-label'>住几晚</Text>
              <Input
                className='es-input'
                type='number'
                placeholder='1'
                value={draft.nights != null ? String(draft.nights) : ''}
                onInput={e => {
                  const n = parseInt(e.detail.value, 10) || undefined
                  set('nights', n != null ? Math.max(1, Math.min(n, 30)) : undefined)
                }}
                {...kbProps}
              />
            </View>
          )}

          {/* type=transport 专属 */}
          {type === 'transport' && (
            <>
              <View className='es-field'>
                <Text className='es-label'>方式</Text>
                <Input
                  className='es-input'
                  placeholder='高铁 / 飞机 / 自驾...'
                  value={draft.mode || ''}
                  maxlength={30}
                  onInput={e => set('mode', e.detail.value)}
                  {...kbProps}
                />
              </View>
              <View className='es-field'>
                <Text className='es-label'>从</Text>
                <Input
                  className='es-input'
                  placeholder='起点'
                  value={draft.from || ''}
                  maxlength={50}
                  onInput={e => set('from', e.detail.value)}
                  {...kbProps}
                />
              </View>
              <View className='es-field'>
                <Text className='es-label'>到</Text>
                <Input
                  className='es-input'
                  placeholder='终点'
                  value={draft.to || ''}
                  maxlength={50}
                  onInput={e => set('to', e.detail.value)}
                  {...kbProps}
                />
              </View>
            </>
          )}

          <View
            className='es-delete'
            onClick={() => { onDelete(); onClose() }}
          >删除地点</View>
        </ScrollView>

        <View className='es-foot'>
          <View className='es-cancel' onClick={onClose}>取消</View>
          <View className='es-save' onClick={save}>保存</View>
        </View>

      </View>
    </View>
    </RootPortal>
    <SpotSearch
      open={searchOpen}
      defaultCity={defaultCity}
      onClose={() => setSearchOpen(false)}
      onSelect={replaceLocation}
    />
    </>
  )
}
