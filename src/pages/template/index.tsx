import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Map as TaroMap, Picker } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import dayjs from 'dayjs'
import type { Template } from '../../types/template'
import type { Trip, SpotType } from '../../types/trip'
import { getTemplate, cloneTemplate } from '../../utils/templates'
import { aggregateBudget, conicFromBuckets } from '../../views/BudgetView/helpers'
import { collectLocated, dayColor, encodeMarkerId } from '../../views/MapView/helpers'
import { PACKING_CATEGORIES } from '../../data/packing'
import { useThemeClass } from '../../utils/theme-class'
import Icon, { type IconName } from '../../components/Icon'
import './index.scss'

type Tab = 'itinerary' | 'map' | 'budget' | 'packing'
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'itinerary', label: '行程', icon: 'itinerary' },
  { key: 'map', label: '地图', icon: 'map' },
  { key: 'budget', label: '开销', icon: 'budget' },
  { key: 'packing', label: '清单', icon: 'packing' },
]
const SPOT_ICON: Record<SpotType, IconName> = { spot: 'spot', hotel: 'hotel', meal: 'meal', transport: 'transport' }

function nightsLabel(dayCount: number): string {
  const nights = Math.max(0, dayCount - 1)
  return `${dayCount}天${nights}晚`
}

export default function TemplatePage() {
  const themeCls = useThemeClass()
  const router = useRouter()
  const id = router.params.id || ''
  const [tpl, setTpl] = useState<Template | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [tab, setTab] = useState<Tab>('itinerary')
  const [copyOpen, setCopyOpen] = useState(false)
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'))
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

  const doCopy = async () => {
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

  return (
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

      <View className='tpl-tabs'>
        {TABS.map((tb) => (
          <View key={tb.key} className={`tpl-tab ${tab === tb.key ? 'on' : ''}`} onClick={() => setTab(tb.key)}>
            <Icon name={tb.icon} size={20} color={tab === tb.key ? 'var(--accent)' : 'var(--ink-3)'} />
            <Text className='tpl-tab-l'>{tb.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView scrollY className='tpl-body'>
        {tab === 'itinerary' && (
          <View className='tpl-itin'>
            {tpl.days.map((d, i) => (
              <View key={d.id} className='tpl-day'>
                <View className='tpl-day-head'><Text className='tpl-day-no'>第 {i + 1} 天</Text></View>
                {d.spots.length === 0 && <Text className='tpl-day-empty'>(空)</Text>}
                {d.spots.map((s) => (
                  <View key={s.id} className='tpl-spot'>
                    <Icon name={SPOT_ICON[s.type]} size={18} color='var(--ink-3)' />
                    {s.time && <Text className='tpl-spot-time'>{s.time}</Text>}
                    <Text className='tpl-spot-name'>{s.name}</Text>
                    {(s.price || 0) > 0 && <Text className='tpl-spot-price'>¥{s.price}</Text>}
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {tab === 'map' && <TemplateMap tpl={tpl} />}
        {tab === 'budget' && <TemplateBudget tpl={tpl} />}
        {tab === 'packing' && <TemplatePacking tpl={tpl} />}
        <View className='tpl-body-pad' />
      </ScrollView>

      <View className='tpl-cta'>
        <View className='tpl-cta-hint'><Icon name='lock' size={13} color='var(--ink-3)' /><Text>模板只读,复制后可自由编辑</Text></View>
        <View className='tpl-cta-btn' onClick={() => setCopyOpen(true)}>
          <Icon name='plus' size={18} color='#fff' /><Text>复制到我的行程</Text>
        </View>
      </View>

      {copyOpen && (
        <View className='tpl-sheet-mask' onClick={() => !copying && setCopyOpen(false)}>
          <View className='tpl-sheet' onClick={(e) => e.stopPropagation()}>
            <Text className='tpl-sheet-title'>选择出发日期</Text>
            <Picker mode='date' value={startDate} onChange={(e) => setStartDate(String(e.detail.value))}>
              <View className='tpl-sheet-date'>
                <Text className='tpl-sheet-date-l'>出发</Text>
                <Text className='tpl-sheet-date-v'>{startDate}</Text>
              </View>
            </Picker>
            <Text className='tpl-sheet-note'>共 {tpl.dayCount || tpl.days.length} 天,日期将自动顺延。</Text>
            <View className={`tpl-sheet-go ${copying ? 'busy' : ''}`} onClick={doCopy}>
              <Text>{copying ? '复制中…' : '确认复制'}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

function TemplateMap({ tpl }: { tpl: Template }) {
  const located = useMemo(() => collectLocated(tpl.days), [tpl.days])
  const markers = located.map((p) => ({
    id: encodeMarkerId(p.dayIdx, p.spotIdx),
    latitude: p.lat,
    longitude: p.lng,
    width: 1, height: 1, anchor: { x: 0.5, y: 1 },
    callout: {
      content: String(p.dayIdx + 1), color: '#FFFFFF', fontSize: 14,
      bgColor: dayColor(p.dayIdx), padding: 10, borderRadius: 999,
      borderWidth: 3, borderColor: '#FFFFFF', display: 'ALWAYS' as const,
      textAlign: 'center' as const,
    },
    iconPath: '',
  }))
  const center = located[0] || { lat: tpl.destinations?.[0]?.lat ?? 30.27, lng: tpl.destinations?.[0]?.lng ?? 120.15 }
  if (located.length === 0) {
    return <View className='tpl-map-empty'><Text>该模板暂无地点坐标</Text></View>
  }
  return (
    <View className='tpl-map-wrap'>
      <TaroMap className='tpl-map' latitude={center.lat} longitude={center.lng} scale={11}
        markers={markers as any} showLocation={false} enableTraffic={false} onError={() => {}} />
    </View>
  )
}

function TemplateBudget({ tpl }: { tpl: Template }) {
  const trip = tpl as unknown as Trip
  const { buckets, total, perPax } = aggregateBudget(trip)
  const conic = conicFromBuckets(buckets)
  return (
    <View className='tpl-bud'>
      <View className='tpl-bud-head'>
        <View>
          <Text className='tpl-bud-cap'>预计总开销</Text>
          <Text className='tpl-bud-total'>¥{total.toLocaleString()}</Text>
          <Text className='tpl-bud-perpax'>人均 ¥{perPax.toLocaleString()}</Text>
        </View>
        <View className='tpl-bud-donut' style={{ background: `conic-gradient(${conic})` }}>
          <View className='tpl-bud-donut-hole' />
        </View>
      </View>
      <View className='tpl-bud-legend'>
        {buckets.map((b) => (
          <View key={b.type} className='tpl-bud-row'>
            <View className='tpl-bud-sw' style={{ background: b.color }} />
            <Text className='tpl-bud-label'>{b.label}</Text>
            <Text className='tpl-bud-pct'>{Math.round(b.pct)}%</Text>
            <Text className='tpl-bud-v'>¥{b.total.toLocaleString()}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function TemplatePacking({ tpl }: { tpl: Template }) {
  const catLabel = (catId: string) => PACKING_CATEGORIES.find((c) => c.id === catId)?.label || catId
  const groups = useMemo(() => {
    const groupMap = new Map<string, typeof tpl.packing>()
    for (const item of tpl.packing) {
      const arr = groupMap.get(item.category) || []
      arr.push(item)
      groupMap.set(item.category, arr)
    }
    return Array.from(groupMap.entries())
  }, [tpl.packing])
  if (tpl.packing.length === 0) {
    return <View className='tpl-pack-empty'><Text>该模板暂无打包清单</Text></View>
  }
  return (
    <View className='tpl-pack'>
      {groups.map(([cat, items]) => (
        <View key={cat} className='tpl-pack-group'>
          <Text className='tpl-pack-cat'>{catLabel(cat)}</Text>
          {items.map((it) => (
            <View key={it.id} className='tpl-pack-row'>
              <Icon name='check' size={16} color={it.checked ? 'var(--accent)' : 'var(--line)'} />
              <Text className='tpl-pack-label'>{it.label}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}
