import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import tripStore from '../../data/trips.json'
import { PACKING_CATEGORIES, DEFAULT_PACKING, PACKING_TEMPLATES } from '../../data/packing'
import type { PackingTemplate } from '../../data/packing'
import { loadOverride, saveOverride, uid } from '../../utils/override'
import type { TripOverride, PackingItem, DayOverride } from '../../utils/override'
import type { TripStore, Trip, Day, Spot, TransportSegment } from '../../types/trip'
import './index.scss'

type Theme = 'tegami' | 'magazine' | 'postcard' | 'minimal'
type ViewKey = 'trip' | 'budget' | 'packing'

const THEMES: { key: Theme; label: string }[] = [
  { key: 'tegami', label: '手紙' },
  { key: 'magazine', label: '杂志' },
  { key: 'postcard', label: '明信片' },
  { key: 'minimal', label: '极简' },
]

const VIEWS: { key: ViewKey; label: string; mono: string }[] = [
  { key: 'trip', label: '攻略', mono: '攻' },
  { key: 'budget', label: '行程开销', mono: '算' },
  { key: 'packing', label: '清单', mono: '册' },
]

const THEME_KEY = 'trip-theme-v1'
const TRIP_KEY = 'trip-current-id-v1'
const VIEW_KEY = 'trip-view-v1'

const SPOT_ICON: Record<string, string> = {
  arrive: '→',
  hotel: '宿',
  spot: '◆',
  meal: '食',
}

function buildInitialPacking(): PackingItem[] {
  return DEFAULT_PACKING.map(([cat, label]) => ({
    id: uid(), category: cat, label, checked: false,
  }))
}

export default function Index() {
  const data = tripStore as TripStore
  const trips = data.store.trips

  const [theme, setTheme] = useState<Theme>(() => (Taro.getStorageSync(THEME_KEY) as Theme) || 'tegami')
  const [view, setView] = useState<ViewKey>(() => (Taro.getStorageSync(VIEW_KEY) as ViewKey) || 'trip')

  const [tripId, setTripId] = useState<string>(() => {
    const saved = Taro.getStorageSync(TRIP_KEY) as string
    return saved && trips.some(t => t.id === saved) ? saved : data.store.currentId
  })

  const trip = useMemo<Trip>(() => trips.find(t => t.id === tripId) || trips[0], [trips, tripId])

  const [override, setOverride] = useState<TripOverride>(() => {
    const ov = loadOverride(tripId)
    if (ov.packing.length === 0) ov.packing = buildInitialPacking()
    return ov
  })

  useEffect(() => {
    const ov = loadOverride(tripId)
    if (ov.packing.length === 0) ov.packing = buildInitialPacking()
    setOverride(ov)
  }, [tripId])

  useEffect(() => { saveOverride(tripId, override) }, [tripId, override])

  const [activeDayId, setActiveDayId] = useState<number>(trip.data.days[0] ? trip.data.days[0].id : 1)
  const activeDay = trip.data.days.find(d => d.id === activeDayId) || trip.data.days[0]

  const switchTheme = (t: Theme) => { setTheme(t); Taro.setStorageSync(THEME_KEY, t) }
  const switchView = (v: ViewKey) => { setView(v); Taro.setStorageSync(VIEW_KEY, v) }
  const switchTrip = (id: string) => {
    setTripId(id); Taro.setStorageSync(TRIP_KEY, id)
    const t = trips.find(x => x.id === id)
    if (t) setActiveDayId(t.data.days[0] ? t.data.days[0].id : 1)
  }

  const mergedDay = (d: Day): Day => {
    const o = override.days[d.id] || {}
    const basePrice = d.hotel ? d.hotel.price : 0
    const overridePrice = typeof o.hotelPrice === 'number' ? o.hotelPrice : basePrice
    const mergedHotel = d.hotel
      ? { ...d.hotel, price: overridePrice }
      : (typeof o.hotelPrice === 'number'
          ? { name: '（无住宿）', price: overridePrice, nights: 0, note: '' }
          : null)
    return {
      ...d,
      hotel: mergedHotel,
      meals: typeof o.meals === 'number' ? o.meals : d.meals,
      tickets: typeof o.tickets === 'number' ? o.tickets : d.tickets,
    }
  }

  const updateDayOverride = (dayId: number, patch: DayOverride) => {
    setOverride(prev => ({
      ...prev,
      days: { ...prev.days, [dayId]: { ...prev.days[dayId], ...patch } },
    }))
  }

  const togglePack = (id: string) => {
    setOverride(prev => ({
      ...prev,
      packing: prev.packing.map(p => p.id === id ? { ...p, checked: !p.checked } : p),
    }))
  }

  const addPack = (cat: string, label: string) => {
    if (!label.trim()) return
    setOverride(prev => ({
      ...prev,
      packing: [...prev.packing, { id: uid(), category: cat, label: label.trim(), checked: false }],
    }))
  }

  const removePack = (id: string) => {
    setOverride(prev => ({ ...prev, packing: prev.packing.filter(p => p.id !== id) }))
  }

  const applyTemplate = (tpl: PackingTemplate, mode: 'replace' | 'merge') => {
    setOverride(prev => {
      const fresh: PackingItem[] = tpl.items.map(([cat, label]) => ({
        id: uid(), category: cat, label, checked: false,
      }))
      if (mode === 'replace') return { ...prev, packing: fresh }
      const existing = new Set(prev.packing.map(p => `${p.category}::${p.label}`))
      const merged = [...prev.packing, ...fresh.filter(p => !existing.has(`${p.category}::${p.label}`))]
      return { ...prev, packing: merged }
    })
  }

  const updateTransport = (segId: string, price: number) => {
    setOverride(prev => ({
      ...prev,
      transport: { ...prev.transport, [segId]: price },
    }))
  }

  const transportPrice = (seg: TransportSegment): number => {
    const o = override.transport[seg.id]
    return typeof o === 'number' ? o : seg.price
  }

  return (
    <View className={`page theme-${theme}`}>
      <View className='topbar'>
        <View className='brand-row'>
          <Text className='brand-title'>行册</Text>
          <View className='theme-btns'>
            {THEMES.map(t => (
              <View
                key={t.key}
                className={`theme-btn ${theme === t.key ? 'active' : ''}`}
                onClick={() => switchTheme(t.key)}
              >
                {t.label}
              </View>
            ))}
          </View>
        </View>
        <ScrollView scrollX className='trip-switcher' enableFlex>
          {trips.map(t => (
            <View
              key={t.id}
              className={`trip-chip ${tripId === t.id ? 'active' : ''}`}
              onClick={() => switchTrip(t.id)}
            >
              {t.name}
            </View>
          ))}
        </ScrollView>
        <Text className='trip-title'>{trip.data.meta.title}</Text>
        <Text className='trip-meta'>
          {trip.data.meta.dateRange} · {trip.data.pax}人 · {trip.data.meta.edition}
        </Text>
      </View>

      <View className='main'>
        {view === 'trip' && (
          <TripView
            trip={trip}
            mergedDay={mergedDay}
            activeDayId={activeDayId}
            setActiveDayId={setActiveDayId}
            activeDay={activeDay}
            updateDayOverride={updateDayOverride}
          />
        )}
        {view === 'budget' && (
          <BudgetView
            trip={trip}
            mergedDay={mergedDay}
            transportPrice={transportPrice}
            updateTransport={updateTransport}
          />
        )}
        {view === 'packing' && (
          <PackingView
            items={override.packing}
            onToggle={togglePack}
            onAdd={addPack}
            onRemove={removePack}
            onApplyTemplate={applyTemplate}
          />
        )}
      </View>

      <View className='bottom-nav'>
        {VIEWS.map(v => (
          <View
            key={v.key}
            className={`nav-item ${view === v.key ? 'active' : ''}`}
            onClick={() => switchView(v.key)}
          >
            <Text className='nav-mono'>{v.mono}</Text>
            <Text className='nav-label'>{v.label}</Text>
            <View className='nav-underline' />
          </View>
        ))}
      </View>
    </View>
  )
}

/* ---------------- 攻略 view ---------------- */
function TripView({
  trip, mergedDay, activeDayId, setActiveDayId, activeDay, updateDayOverride,
}: {
  trip: Trip
  mergedDay: (d: Day) => Day
  activeDayId: number
  setActiveDayId: (id: number) => void
  activeDay: Day
  updateDayOverride: (dayId: number, patch: DayOverride) => void
}) {
  const day = mergedDay(activeDay)
  const currency = trip.data.currency
  return (
    <View>
      <ScrollView scrollX className='trip-tabs' enableFlex>
        {trip.data.days.map(d => (
          <View
            key={d.id}
            className={`trip-tab ${activeDayId === d.id ? 'active' : ''}`}
            onClick={() => setActiveDayId(d.id)}
          >
            <Text className='trip-tab-day'>Day {d.id}</Text>
            <Text className='trip-tab-date'>{d.date}</Text>
          </View>
        ))}
      </ScrollView>

      <View className='day-header'>
        <Text className='day-title'>{day.title}</Text>
        <Text className='day-city'>{day.cityLabel}</Text>
        <Text className='day-weather'>
          {day.weather.desc} {day.weather.low}°–{day.weather.temp}°
        </Text>
      </View>

      <View className='day-budget-edit'>
        <Text className='day-budget-edit-label'>EXPENSE · 当日开销</Text>
        <View className='ledger-amounts'>
          <LedgerAmount
            label='住宿' currency={currency}
            value={day.hotel ? day.hotel.price : 0}
            onChange={v => updateDayOverride(day.id, { hotelPrice: v })}
          />
          <LedgerAmount
            label='餐饮' currency={currency}
            value={day.meals}
            onChange={v => updateDayOverride(day.id, { meals: v })}
          />
          <LedgerAmount
            label='门票' currency={currency}
            value={day.tickets}
            onChange={v => updateDayOverride(day.id, { tickets: v })}
          />
        </View>
      </View>

      <View className='spot-list'>
        {day.spots.map(s => <SpotCard key={s.id} spot={s} />)}
      </View>
    </View>
  )
}

function SpotCard({ spot }: { spot: Spot }) {
  return (
    <View className='spot-card'>
      <View className='spot-head'>
        <Text className='spot-icon'>{SPOT_ICON[spot.type] || '◉'}</Text>
        <Text className='spot-time'>{spot.time}</Text>
        <Text className='spot-name'>{spot.name}</Text>
      </View>
      {spot.note ? <Text className='spot-note'>{spot.note}</Text> : null}
    </View>
  )
}

/* ---------------- 开销 view ---------------- */
function fmt(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function BudgetView({
  trip, mergedDay, transportPrice, updateTransport,
}: {
  trip: Trip
  mergedDay: (d: Day) => Day
  transportPrice: (seg: TransportSegment) => number
  updateTransport: (segId: string, price: number) => void
}) {
  const currency = trip.data.currency
  const transportSegs = trip.data.transport || []
  const transportTotal = transportSegs.reduce((s, seg) => s + transportPrice(seg), 0)
  const totals = trip.data.days.reduce(
    (acc, d) => {
      const md = mergedDay(d)
      const h = md.hotel ? md.hotel.price : 0
      return { hotel: acc.hotel + h, meals: acc.meals + md.meals, tickets: acc.tickets + md.tickets }
    },
    { hotel: 0, meals: 0, tickets: 0 }
  )
  const total = totals.hotel + totals.meals + totals.tickets + transportTotal
  const perPax = trip.data.pax > 0 ? Math.round(total / trip.data.pax) : total
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)
  const widthOf = (n: number) => (total > 0 ? `${(n / total) * 100}%` : '25%')

  return (
    <View className='ledger'>
      <View className='ledger-hero-compact'>
        <View className='hero-line'>
          <Text className='ledger-eyebrow'>TOTAL · 总开销</Text>
          <View className='ledger-stamp ledger-stamp-sm'>
            <Text className='ledger-stamp-text'>算</Text>
          </View>
        </View>
        <View className='hero-total-line'>
          <Text className='ledger-currency-big ledger-currency-sm'>{currency}</Text>
          <Text className='ledger-total-compact'>{fmt(total)}</Text>
        </View>
        <Text className='hero-perpax-inline'>
          {trip.data.pax} 人  ·  人均 {currency}{fmt(perPax)}
        </Text>
      </View>

      <View className='ledger-dist'>
        <Text className='ledger-section-label'>DISTRIBUTION · 分布</Text>
        <View className='ledger-dist-bar'>
          <View className='dist-seg seg-hotel' style={{ width: widthOf(totals.hotel) }} />
          <View className='dist-seg seg-meals' style={{ width: widthOf(totals.meals) }} />
          <View className='dist-seg seg-tickets' style={{ width: widthOf(totals.tickets) }} />
          <View className='dist-seg seg-transport' style={{ width: widthOf(transportTotal) }} />
        </View>

        <View className='ledger-legend'>
          <DistLegend label='住宿' seg='seg-hotel' value={totals.hotel} pct={pct(totals.hotel)} currency={currency} />
          <DistLegend label='餐饮' seg='seg-meals' value={totals.meals} pct={pct(totals.meals)} currency={currency} />
          <DistLegend label='门票' seg='seg-tickets' value={totals.tickets} pct={pct(totals.tickets)} currency={currency} />
          <DistLegend label='交通' seg='seg-transport' value={transportTotal} pct={pct(transportTotal)} currency={currency} />
        </View>
      </View>

      {transportSegs.length > 0 && (
        <View className='ledger-transit'>
          <Text className='ledger-section-label'>TRANSIT · 交通</Text>
          {transportSegs.map(seg => (
            <View key={seg.id} className='transit-row'>
              <View className='transit-route'>
                <Text className='transit-from'>{seg.from}</Text>
                <Text className='transit-arrow'>→</Text>
                <Text className='transit-to'>{seg.to}</Text>
              </View>
              <Text className='transit-mode'>{seg.mode}</Text>
              <View className='transit-meta'>
                <Text className='transit-duration'>{seg.duration}</Text>
                <View className='transit-amount-field'>
                  <Text className='ledger-amount-currency'>{currency}</Text>
                  <Input
                    className='ledger-amount-input transit-input'
                    type='digit'
                    value={String(transportPrice(seg))}
                    onInput={e => {
                      const n = parseInt(e.detail.value || '0', 10)
                      updateTransport(seg.id, Number.isFinite(n) ? n : 0)
                    }}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

    </View>
  )
}

function DistLegend({
  label, seg, value, pct, currency,
}: { label: string; seg: string; value: number; pct: number; currency: string }) {
  return (
    <View className='legend-item'>
      <View className={`legend-dot ${seg}`} />
      <Text className='legend-label'>{label}</Text>
      <Text className='legend-value'>{currency}{fmt(value)}</Text>
      <Text className='legend-pct'>{pct}%</Text>
    </View>
  )
}

function LedgerAmount({
  label, currency, value, onChange,
}: { label: string; currency: string; value: number; onChange: (v: number) => void }) {
  return (
    <View className='ledger-amount'>
      <Text className='ledger-amount-label'>{label}</Text>
      <View className='ledger-amount-field'>
        <Text className='ledger-amount-currency'>{currency}</Text>
        <Input
          className='ledger-amount-input'
          type='digit'
          value={String(value)}
          onInput={e => {
            const n = parseInt(e.detail.value || '0', 10)
            onChange(Number.isFinite(n) ? n : 0)
          }}
        />
      </View>
    </View>
  )
}

/* ---------------- 清单 view ---------------- */
function PackingView({
  items, onToggle, onAdd, onRemove, onApplyTemplate,
}: {
  items: PackingItem[]
  onToggle: (id: string) => void
  onAdd: (cat: string, label: string) => void
  onRemove: (id: string) => void
  onApplyTemplate: (tpl: PackingTemplate, mode: 'replace' | 'merge') => void
}) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [tplOpen, setTplOpen] = useState(false)
  const [pendingTpl, setPendingTpl] = useState<PackingTemplate | null>(null)
  const checked = items.filter(i => i.checked).length

  const handlePick = (tpl: PackingTemplate) => {
    if (items.length === 0) {
      onApplyTemplate(tpl, 'replace')
      setTplOpen(false)
    } else {
      setPendingTpl(tpl)
    }
  }

  return (
    <View className='packing-view'>
      <View className='packing-head'>
        <View className='packing-head-text'>
          <Text className='packing-eyebrow'>CHECKLIST · 行装</Text>
          <Text className='packing-summary'>
            <Text className='packing-summary-num'>{checked}</Text>
            <Text className='packing-summary-slash'>  /  </Text>
            <Text className='packing-summary-total'>{items.length}</Text>
            <Text className='packing-summary-tail'>  已收拾</Text>
          </Text>
        </View>
        <View className='packing-tpl-btn' onClick={() => setTplOpen(o => !o)}>
          <Text className='packing-tpl-btn-text'>模板</Text>
          <Text className='packing-tpl-btn-glyph'>{tplOpen ? '−' : '+'}</Text>
        </View>
      </View>

      {tplOpen && (
        <View className='packing-tpl-panel'>
          <Text className='packing-tpl-hint'>导入预设模板：</Text>
          {PACKING_TEMPLATES.map(tpl => (
            <View key={tpl.name} className='packing-tpl-row' onClick={() => handlePick(tpl)}>
              <Text className='packing-tpl-name'>{tpl.name}</Text>
              <Text className='packing-tpl-count'>{tpl.items.length} 项</Text>
            </View>
          ))}
        </View>
      )}

      {pendingTpl && (
        <View className='packing-confirm'>
          <Text className='packing-confirm-text'>
            导入「{pendingTpl.name}」？当前清单非空。
          </Text>
          <View className='packing-confirm-actions'>
            <View
              className='packing-confirm-btn'
              onClick={() => {
                onApplyTemplate(pendingTpl, 'merge')
                setPendingTpl(null); setTplOpen(false)
              }}
            >
              <Text>合并</Text>
            </View>
            <View
              className='packing-confirm-btn primary'
              onClick={() => {
                onApplyTemplate(pendingTpl, 'replace')
                setPendingTpl(null); setTplOpen(false)
              }}
            >
              <Text>替换</Text>
            </View>
            <View className='packing-confirm-btn' onClick={() => setPendingTpl(null)}>
              <Text>取消</Text>
            </View>
          </View>
        </View>
      )}

      {PACKING_CATEGORIES.map(cat => {
        const list = items.filter(i => i.category === cat.id)
        return (
          <View key={cat.id} className='packing-group'>
            <Text className='packing-group-title'>{cat.icon} {cat.label}</Text>
            {list.map(it => (
              <View key={it.id} className='packing-item'>
                <View
                  className={`pack-checkbox ${it.checked ? 'checked' : ''}`}
                  onClick={() => onToggle(it.id)}
                >
                  {it.checked ? '✓' : ''}
                </View>
                <Text
                  className={`pack-label ${it.checked ? 'done' : ''}`}
                  onClick={() => onToggle(it.id)}
                >
                  {it.label}
                </Text>
                <Text className='pack-remove' onClick={() => onRemove(it.id)}>×</Text>
              </View>
            ))}
            <View className='packing-add'>
              <Input
                className='packing-add-input'
                placeholder={`+ 添加${cat.label}`}
                value={draft[cat.id] || ''}
                onInput={e => setDraft(prev => ({ ...prev, [cat.id]: e.detail.value }))}
                onConfirm={e => {
                  onAdd(cat.id, e.detail.value)
                  setDraft(prev => ({ ...prev, [cat.id]: '' }))
                }}
              />
            </View>
          </View>
        )
      })}
    </View>
  )
}
