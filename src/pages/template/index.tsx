import { useEffect, useMemo, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import type { Template } from '../../types/template'
import type { Trip } from '../../types/trip'
import { getTemplate, cloneTemplate } from '../../utils/templates'
import { TripProvider } from '../../store/trip-store'
import { useMe } from '../../store/me-store'
import { useThemeClass } from '../../utils/theme-class'
import ItineraryView from '../../views/ItineraryView'
import BudgetView from '../../views/BudgetView'
import PackingView from '../../views/PackingView'
import MapView from '../../views/MapView'
import CopySheet from '../../components/CopySheet'
import Icon, { type IconName } from '../../components/Icon'
import './index.scss'

type Tab = 'itinerary' | 'map' | 'budget' | 'packing'
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'itinerary', label: '行程', icon: 'itinerary' },
  { key: 'map', label: '地图', icon: 'map' },
  { key: 'budget', label: '开销', icon: 'budget' },
  { key: 'packing', label: '清单', icon: 'packing' },
]
function nightsLabel(dayCount: number): string {
  const nights = Math.max(0, dayCount - 1)
  return `${dayCount}天${nights}晚`
}

function templateAsTrip(tpl: Template): Trip {
  return {
    ...tpl,
    _openid: '',
    ownerOpenid: '',
    collaborators: [],
    updatedBy: '',
    aiTaskId: null,
    aiStatus: null,
    aiDraft: null,
    aiError: null,
  }
}

export default function TemplatePage() {
  const themeCls = useThemeClass()
  const router = useRouter()
  const id = router.params.id || ''
  const { me } = useMe()
  const openid = me?.openid || ''
  const [tpl, setTpl] = useState<Template | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [tab, setTab] = useState<Tab>('itinerary')
  const [copyOpen, setCopyOpen] = useState(false)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    if (!id) { setStatus('error'); return }
    getTemplate(id)
      .then((t) => { if (t) { setTpl(t); setStatus('ready') } else setStatus('error') })
      .catch(() => setStatus('error'))
  }, [id])

  const spotCount = useMemo(
    () => (tpl ? tpl.days.reduce((n, d) => n + d.spots.length, 0) : 0),
    [tpl],
  )

  const doCopy = async (startDate: string) => {
    if (!tpl || copying) return
    setCopying(true)
    Taro.showLoading({ title: '复制中…' })
    try {
      const newId = await cloneTemplate(tpl._id, startDate)
      Taro.hideLoading()
      setCopyOpen(false)
      Taro.showToast({ title: '已复制到我的行程', icon: 'success', duration: 700 })
      setTimeout(() => Taro.redirectTo({ url: `/pages/trip/index?id=${newId}` }), 720)
    } catch (e) {
      Taro.hideLoading()
      console.error('[cloneTemplate]', e)
      Taro.showToast({ title: '复制失败,请重试', icon: 'none' })
    } finally {
      setCopying(false)
    }
  }

  if (!openid) {
    return <View className={`${themeCls} tpl-state`}><Text>登录中…</Text></View>
  }
  if (status === 'loading') {
    return <View className={`${themeCls} tpl-state`}><Text>加载中…</Text></View>
  }
  if (status === 'error' || !tpl) {
    return (
      <View className={`${themeCls} tpl-state`}>
        <Text className='tpl-state-title'>模板不存在或加载失败</Text>
        <View className='tpl-state-btn' onClick={() => Taro.navigateBack().catch(() => Taro.reLaunch({ url: '/pages/library/index' }))}>返回</View>
      </View>
    )
  }

  const tripData = templateAsTrip(tpl)

  return (
    <TripProvider initialTrip={tripData} readonly openid={openid}>
      <View className={`${themeCls} tpl`}>
        <View className='tpl-top'>
          <View className='tpl-back' onClick={() => Taro.navigateBack().catch(() => Taro.reLaunch({ url: '/pages/library/index' }))}>
            <Icon name='arrow-left' size={22} />
          </View>
          <View className='tpl-readonly'>
            <Icon name='lock' size={14} color='var(--accent)' />
            <Text className='tpl-readonly-t'>样板 · 只读</Text>
          </View>
        </View>

        <View className='tpl-hero'>
          <Text className='tpl-name'>{tpl.name}</Text>
          <View className='tpl-meta'>
            <View className='tpl-meta-i'><Icon name='pin' size={14} color='var(--ink-3)' /><Text>{tpl.city}</Text></View>
            <Text className='tpl-meta-dot'>·</Text>
            <Text>{nightsLabel(tpl.dayCount || tpl.days.length)}</Text>
            <Text className='tpl-meta-dot'>·</Text>
            <Text>{spotCount} 个地点</Text>
          </View>
          {tpl.tags?.length > 0 && (
            <View className='tpl-tags'>
              {tpl.tags.map((t) => <Text key={t} className='tpl-tag'>{t}</Text>)}
            </View>
          )}
        </View>

        {tpl.guideMapUrl && (
          <View className='tpl-guide-cover' onClick={() => Taro.previewImage({ urls: [tpl.guideMapUrl as string], current: tpl.guideMapUrl as string })}>
            <Image className='tpl-guide-img' src={tpl.guideMapUrl} mode='aspectFill' />
            <Text className='tpl-guide-badge'>精选导览图</Text>
          </View>
        )}

        <View className='tpl-tabs'>
          {TABS.map((tb) => (
            <View key={tb.key} className={`tpl-tab ${tab === tb.key ? 'on' : ''}`} onClick={() => setTab(tb.key)}>
              <Icon name={tb.icon} size={20} color={tab === tb.key ? 'var(--accent)' : 'var(--ink-3)'} />
              <Text className='tpl-tab-l'>{tb.label}</Text>
            </View>
          ))}
        </View>

        <View className='tpl-body'>
          {tab === 'itinerary' && <ItineraryView />}
          {tab === 'map' && <MapView />}
          {tab === 'budget' && <BudgetView />}
          {tab === 'packing' && <PackingView />}
        </View>

        <View className='tpl-cta'>
          <View className='tpl-cta-hint'><Icon name='lock' size={13} color='var(--ink-3)' /><Text>模板只读,复制后可自由编辑</Text></View>
          <View className='tpl-cta-btn' onClick={() => setCopyOpen(true)}>
            <Icon name='plus' size={18} color='#fff' /><Text>复制到我的行程</Text>
          </View>
        </View>
      </View>

      <CopySheet
        open={copyOpen}
        dayCount={tpl.dayCount || tpl.days.length}
        onClose={() => setCopyOpen(false)}
        onCopy={doCopy}
        copying={copying}
      />
    </TripProvider>
  )
}

