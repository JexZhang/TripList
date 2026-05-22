import { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import dayjs from 'dayjs'
import DatePicker from '../../components/DatePicker'
import DestinationPicker from '../../components/DestinationPicker'
import type { Destination } from '../../types/trip'
import { buildNewTrip } from '../../utils/trip-helpers'
import { createTrip } from '../../utils/db'
import { useMe } from '../../store/me-store'
import './index.scss'

export default function NewTrip() {
  const [name, setName] = useState('')
  const [pax, setPax] = useState(2)
  const [dates, setDates] = useState({
    start: dayjs().format('YYYY-MM-DD'),
    end: dayjs().add(2, 'day').format('YYYY-MM-DD'),
  })
  const [destinations, setDestinations] = useState<Destination[]>([])
  const { me } = useMe()
  const openid = me?.openid || ''
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = !!name.trim() && !!openid && pax >= 1 && !dayjs(dates.end).isBefore(dates.start)

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      const input = buildNewTrip({
        name,
        pax,
        startDate: dates.start,
        endDate: dates.end,
        destinations,
      })
      input.ownerOpenid = openid
      input.ownerNickname = me?.nickname || '行册旅人'
      input.ownerAvatarUrl = me?.avatarUrl || ''
      const tripId = await createTrip(input)
      Taro.showToast({ title: '已创建', icon: 'success' })
      setTimeout(() => Taro.redirectTo({ url: `/pages/trip/index?id=${tripId}` }), 600)
    } catch (e) {
      console.error('createTrip failed', e)
      Taro.showToast({ title: '创建失败', icon: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='new-trip theme-tegami'>
      <View className='nt-field'>
        <Text className='nt-label'>攻略名</Text>
        <Input
          className='nt-input'
          placeholder='例：南京 · 金陵四日'
          value={name}
          onInput={e => setName(e.detail.value)}
        />
      </View>

      <View className='nt-field'>
        <Text className='nt-label'>日期</Text>
        <DatePicker value={dates} onChange={setDates} />
      </View>

      <View className='nt-field'>
        <Text className='nt-label'>目的地</Text>
        <DestinationPicker value={destinations} onChange={setDestinations} />
      </View>

      <View className='nt-field'>
        <Text className='nt-label'>人数</Text>
        <View className='nt-pax'>
          <View
            className='nt-pax-btn'
            onClick={() => setPax(Math.max(1, pax - 1))}
          >−</View>
          <Text className='nt-pax-value'>{pax}</Text>
          <View
            className='nt-pax-btn'
            onClick={() => setPax(pax + 1)}
          >+</View>
        </View>
      </View>

      <View className='nt-foot'>
        <Button
          className='nt-cancel'
          onClick={() => Taro.navigateBack()}
        >取消</Button>
        <Button
          className='nt-submit'
          disabled={!canSubmit || submitting}
          onClick={submit}
        >{submitting ? '创建中...' : '创建'}</Button>
      </View>
    </View>
  )
}
