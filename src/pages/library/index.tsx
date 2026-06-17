import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { TemplateCard, TemplateQuery } from '../../types/template'
import { listTemplates } from '../../utils/templates'
import { filterTemplates } from '../../utils/template-filter'
import { DAY_CHIPS, TAG_OPTIONS, AUDIENCE_OPTIONS, SEASON_OPTIONS, CITY_OPTIONS } from '../../data/template-filters'
import type { AIAudience } from '../../types/trip'
import { useThemeClass } from '../../utils/theme-class'
import Icon from '../../components/Icon'
import './index.scss'

type Status = 'loading' | 'ready' | 'error'

function nightsLabel(dayCount: number): string {
  return `${dayCount}天${Math.max(0, dayCount - 1)}晚`
}

const CARD_GRADS: ReadonlyArray<[string, string]> = [
  ['#FF7A2E', '#FF9A4D'],
  ['#6B46C1', '#FF5B5B'],
  ['#4FB286', '#FFC247'],
]

export default function LibraryPage() {
  const themeCls = useThemeClass()
  const [status, setStatus] = useState<Status>('loading')
  const [raw, setRaw] = useState<TemplateCard[]>([])   // 服务端按天数/城市拉回的切片
  const [keyword, setKeyword] = useState('')
  const [dayIdx, setDayIdx] = useState<number>(-1)     // DAY_CHIPS 下标,-1 = 不限
  const [tags, setTags] = useState<string[]>([])
  const [audience, setAudience] = useState<AIAudience[]>([])
  const [seasons, setSeasons] = useState<string[]>([])
  const [showMore, setShowMore] = useState(true)  // 默认展开次级筛选，提升可见性

  // 服务端只按「天数」收敛(主筛选),其余维度客户端精筛
  const serverQuery: TemplateQuery = useMemo(() => {
    const chip = dayIdx >= 0 ? DAY_CHIPS[dayIdx] : undefined
    return { dayCount: chip?.dayCount, dayCountGte: chip?.dayCountGte, limit: 60 }
  }, [dayIdx])

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const cards = await listTemplates(serverQuery)
      setRaw(cards)
      setStatus('ready')
    } catch (e) {
      console.error('[library] load failed', e)
      setStatus('error')
    }
  }, [serverQuery])

  useEffect(() => { void load() }, [load])

  const clientQuery: TemplateQuery = { tags, audience, seasons, keyword }
  const list = useMemo(() => filterTemplates(raw, clientQuery), [raw, tags, audience, seasons, keyword])

  const toggle = <T,>(arr: T[], v: T, set: (n: T[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const clearAll = () => { setDayIdx(-1); setTags([]); setAudience([]); setSeasons([]); setKeyword('') }
  const hasFilter = dayIdx >= 0 || tags.length || audience.length || seasons.length || keyword.trim()

  return (
    <View className={`${themeCls} lib`}>
      {/* 搜索 */}
      <View className='lib-search'>
        <Icon name='search' size={20} color='var(--ink-3)' />
        <Input className='lib-search-input' value={keyword} placeholder='搜目的地 / 攻略名'
          confirmType='search' onInput={(e) => setKeyword(e.detail.value)} />
        {keyword.length > 0 && <View onClick={() => setKeyword('')}><Icon name='close' size={18} color='var(--ink-3)' /></View>}
      </View>

      {/* 筛选控制区 */}
      <View className='lib-filter-bar'>
        <ScrollView scrollX className='lib-days' showScrollbar={false}>
          <View className={`lib-day-chip ${dayIdx < 0 ? 'on' : ''}`} onClick={() => setDayIdx(-1)}>不限</View>
          {DAY_CHIPS.map((c, i) => (
            <View key={c.label} className={`lib-day-chip ${dayIdx === i ? 'on' : ''}`} onClick={() => setDayIdx(i)}>{c.label}</View>
          ))}
        </ScrollView>
        <View className='lib-filter-toggle' onClick={() => setShowMore((v) => !v)}>
          <Icon name='sliders' size={20} color={hasFilter ? 'var(--accent)' : 'var(--ink-3)'} />
          <Text className='lib-filter-toggle-text'>{showMore ? '收起' : '更多'}</Text>
        </View>
      </View>

      {/* 次级筛选(玩法/人群/季节) */}
      {showMore && (
        <View className='lib-more'>
          <FilterRow icon='tag' title='玩法' options={TAG_OPTIONS} selected={tags} onToggle={(v) => toggle(tags, v, setTags)} />
          <FilterRow icon='people' title='人群' options={AUDIENCE_OPTIONS} selected={audience} onToggle={(v) => toggle(audience, v as AIAudience, setAudience as (n: string[]) => void)} />
          <FilterRow icon='season' title='季节' options={SEASON_OPTIONS} selected={seasons} onToggle={(v) => toggle(seasons, v, setSeasons)} />
          {CITY_OPTIONS.length > 0 && (
            <FilterRow icon='pin' title='城市' options={CITY_OPTIONS} selected={[]} onToggle={() => {}} />
          )}
          {hasFilter && <View className='lib-clear' onClick={clearAll}>清空筛选</View>}
        </View>
      )}

      {/* 列表 / 三态 */}
      {status === 'loading' && (
        <View className='lib-grid'>
          {[0, 1, 2, 3].map((i) => <View key={i} className='lib-card lib-card-skel' />)}
        </View>
      )}
      {status === 'error' && (
        <View className='lib-empty'>
          <Text className='lib-empty-t'>加载失败,请检查网络</Text>
          <View className='lib-empty-btn' onClick={() => void load()}>重试</View>
        </View>
      )}
      {status === 'ready' && list.length === 0 && (
        <View className='lib-empty'>
          <Text className='lib-empty-t'>没有符合条件的攻略</Text>
          <Text className='lib-empty-sub'>试着放宽天数或清空筛选</Text>
          {hasFilter && <View className='lib-empty-btn' onClick={clearAll}>清空筛选</View>}
        </View>
      )}
      {status === 'ready' && list.length > 0 && (
        <ScrollView scrollY className='lib-scroll'>
          <View className='lib-grid'>
            {list.map((c, i) => {
              const g = CARD_GRADS[i % 3]
              return (
                <View key={c._id} className='lib-card'
                  style={{ '--c1': g[0], '--c2': g[1], animationDelay: `${i * 60}ms` } as React.CSSProperties}
                  onClick={() => Taro.navigateTo({ url: `/pages/template/index?id=${c._id}` })}>
                  <View className='lib-card-ink' />
                  <View className='lib-card-body'>
                    <View className='lib-card-top'>
                      <Text className='lib-card-name'>{c.name}</Text>
                      <Text className='lib-card-days'>{nightsLabel(c.dayCount)}</Text>
                    </View>
                    <View className='lib-card-info'>
                      <Text>{c.city}</Text>
                      <View className='lib-card-dot' />
                      <Text>{c.spotCount} 个精选地点</Text>
                    </View>
                    {c.tags?.length > 0 && (
                      <View className='lib-card-tags'>
                        {c.tags.slice(0, 3).map((t) => <Text key={t} className='lib-card-tag'>{t}</Text>)}
                      </View>
                    )}
                  </View>
                </View>
              )
            })}
          </View>
          <View className='lib-grid-pad' />
        </ScrollView>
      )}
    </View>
  )
}

function FilterRow({ icon, title, options, selected, onToggle }: {
  icon: 'tag' | 'people' | 'season' | 'pin'
  title: string
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <View className='lib-frow'>
      <View className='lib-frow-h'><Icon name={icon} size={16} color='var(--ink-3)' /><Text className='lib-frow-t'>{title}</Text></View>
      <View className='lib-frow-chips'>
        {options.map((o) => (
          <View key={o} className={`lib-chip ${selected.includes(o) ? 'on' : ''}`} onClick={() => onToggle(o)}>{o}</View>
        ))}
      </View>
    </View>
  )
}
