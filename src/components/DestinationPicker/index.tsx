import { useRef, useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import { cloud, type PoiResult } from '../../utils/cloud'
import type { Destination } from '../../types/trip'
import './index.scss'

interface Props {
  value: Destination[]
  onChange: (v: Destination[]) => void
}

export default function DestinationPicker({ value, onChange }: Props) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<PoiResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const reqIdRef = useRef(0)

  const search = async (kw: string) => {
    const myId = ++reqIdRef.current
    if (!kw.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await cloud.searchPoi({ keyword: kw })
      if (myId !== reqIdRef.current) return  // 已有更新的请求,丢弃过期响应
      const cities = res.results.filter(r => r.adcode && r.adcode.endsWith('00'))
      setResults(cities.length > 0 ? cities.slice(0, 10) : res.results.slice(0, 10))
    } catch (e) {
      if (myId !== reqIdRef.current) return
      console.error('searchPoi failed', e)
      setResults([])
    } finally {
      if (myId === reqIdRef.current) setLoading(false)
    }
  }

  const add = (poi: PoiResult) => {
    if (value.find(v => v.adcode === poi.adcode)) return  // 去重
    onChange([
      ...value,
      { name: poi.name, adcode: poi.adcode, lat: poi.lat, lng: poi.lng }
    ])
    setKeyword('')
    setResults([])
    setOpen(false)
    setKeyboardHeight(0)
  }

  const closeModal = () => {
    setOpen(false)
    setKeyboardHeight(0)
  }

  const remove = (adcode: string) => {
    onChange(value.filter(v => v.adcode !== adcode))
  }

  return (
    <View className='dest-picker'>
      <View className='dp-chips'>
        {value.map(d => (
          <View key={d.adcode} className='dp-chip' onClick={() => remove(d.adcode)}>
            <Text className='dp-chip-text'>{d.name}</Text>
            <Text className='dp-chip-x'>×</Text>
          </View>
        ))}
        <View className='dp-add' onClick={() => setOpen(true)}>+ 添加</View>
      </View>

      {open && (
        <View
          className='dp-modal-mask'
          style={{ paddingBottom: `${keyboardHeight}px`, transition: 'padding-bottom 0.25s ease' }}
          onClick={closeModal}
        >
          <View className='dp-modal' onClick={e => e.stopPropagation()}>
            <View className='dp-modal-head'>
              <Text className='dp-modal-title'>添加目的地</Text>
              <Text className='dp-modal-close' onClick={closeModal}>×</Text>
            </View>
            <Input
              className='dp-search'
              placeholder='搜索城市，例：南京 / 苏州'
              value={keyword}
              onInput={e => {
                setKeyword(e.detail.value)
                search(e.detail.value)
              }}
              focus
              adjustPosition={false}
              // @ts-ignore
              onKeyboardHeightChange={(e: any) => setKeyboardHeight(e.detail.height)}
            />
            <ScrollView className='dp-results' scrollY>
              {loading && <View className='dp-hint'>搜索中...</View>}
              {!loading && results.length === 0 && keyword && (
                <View className='dp-hint'>未找到，换个关键词</View>
              )}
              {results.map((r, idx) => (
                <View key={`${r.adcode || 'na'}-${r.name}-${idx}`} className='dp-result' onClick={() => add(r)}>
                  <Text className='dp-result-name'>{r.name}</Text>
                  <Text className='dp-result-addr'>{r.city || r.address}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  )
}
