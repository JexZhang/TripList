import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { View, Text, Input, ScrollView, RootPortal } from '@tarojs/components'
import { cloud, type PoiResult } from '../../utils/cloud'
import { useKeyboardLift } from '../../utils/use-keyboard-height'
import './index.scss'

export interface SelectedSpotInfo {
  name: string
  city?: string
  adcode?: string
  lat?: number
  lng?: number
}

interface Props {
  open: boolean
  defaultCity?: string
  onClose: () => void
  onSelect: (info: SelectedSpotInfo) => void
}

export default function SpotSearch({ open, defaultCity, onClose, onSelect }: Props) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<PoiResult[]>([])
  const [loading, setLoading] = useState(false)
  const [debouncedKw, setDebouncedKw] = useState('')
  const { height: keyboardHeight, bind: kbProps } = useKeyboardLift()

  // debounce 输入
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => setDebouncedKw(keyword), 300)
    return () => clearTimeout(t)
  }, [keyword, open])

  // 触发搜索
  useEffect(() => {
    if (!debouncedKw.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    cloud.searchPoi({ keyword: debouncedKw, city: defaultCity })
      .then(r => setResults(r.results))
      .catch(e => {
        console.error('[poi search]', e)
        setResults([])
        Taro.showToast({ title: '搜索失败，请重试', icon: 'none' })
      })
      .finally(() => setLoading(false))
  }, [debouncedKw, defaultCity])

  // 关闭时清状态
  useEffect(() => {
    if (!open) {
      setKeyword('')
      setResults([])
    }
  }, [open])

  if (!open) return null

  const useManual = () => {
    if (!keyword.trim()) return
    onSelect({ name: keyword.trim() })
    onClose()
  }

  const useResult = (r: PoiResult) => {
    onSelect({
      name: r.name,
      city: r.city || undefined,
      adcode: r.adcode || undefined,
      lat: r.lat || undefined,
      lng: r.lng || undefined,
    })
    onClose()
  }

  return (
    <RootPortal>
    <View className='spot-search-mask theme-tokens' onClick={onClose}>
      <View
        className='spot-search-sheet'
        style={{
          bottom: `${keyboardHeight}px`,
          maxHeight: `calc(100vh - ${keyboardHeight}px - 80rpx)`,
          transition: 'bottom 0.25s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        <View className='ss-head'>
          <Text className='ss-title'>添加地点</Text>
          <Text className='ss-close' onClick={onClose}>×</Text>
        </View>
        <Input
          className='ss-input'
          placeholder='搜索地点,例:德基广场 / 玄武湖'
          value={keyword}
          onInput={e => setKeyword(e.detail.value)}
          focus
          {...kbProps}
        />
        <ScrollView className='ss-results' scrollY>
          {loading && <View className='ss-hint'>搜索中...</View>}
          {!loading && results.map((r) => (
            <View key={`${r.name}-${r.lat}-${r.lng}`} className='ss-result' onClick={() => useResult(r)}>
              <Text className='ss-result-name'>{r.name}</Text>
              <Text className='ss-result-addr'>{r.city ? `${r.city} · ` : ''}{r.address || ''}</Text>
            </View>
          ))}
          {!loading && results.length === 0 && keyword.trim() && (
            <View className='ss-hint'>未搜到。点下面"手动添加"用"{keyword}"作为名字。</View>
          )}
        </ScrollView>
        {keyword.trim() && (
          <View className='ss-manual' onClick={useManual}>
            <Text>+ 手动添加 "{keyword.trim()}"</Text>
          </View>
        )}
      </View>
    </View>
    </RootPortal>
  )
}
