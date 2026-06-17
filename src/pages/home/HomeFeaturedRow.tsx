import { View, Text, ScrollView } from '@tarojs/components'
import type { TemplateCard } from '../../types/template'
import { templateCoverColors } from '../../utils/template-cover'
import './styles/home-featured.scss'

interface HomeFeaturedRowProps {
  templates: TemplateCard[]
  onOpenTemplate: (id: string) => void
  onOpenLibrary: () => void
}

function nightsLabel(dayCount: number): string {
  return `${dayCount}天${Math.max(0, dayCount - 1)}晚`
}

/** 首页旅人精选横滑区：生成色封面卡 + 大字目的地（四主题共用骨架，CSS 变量换皮） */
export default function HomeFeaturedRow({ templates, onOpenTemplate, onOpenLibrary }: HomeFeaturedRowProps) {
  if (templates.length === 0) return null
  return (
    <View className='home-featured'>
      <View className='home-featured-h'>
        <View className='home-featured-title'>
          <View className='home-featured-bar' />
          <Text className='home-featured-t'>旅人精选</Text>
          <Text className='home-featured-sub'>EDITORS&apos; PICKS</Text>
        </View>
        <Text className='home-featured-more' onClick={onOpenLibrary}>更多 ›</Text>
      </View>
      <ScrollView scrollX className='home-featured-row' showScrollbar={false}>
        {templates.map((c) => {
          const [c1, c2] = templateCoverColors(c)
          const seasonTag = c.seasons?.[0]
          const regionLabel = [c.region, seasonTag].filter(Boolean).join(' · ')
          return (
            <View key={c._id} className='home-featured-card' onClick={() => onOpenTemplate(c._id)}>
              <View className='hf-cover' style={{ background: `linear-gradient(140deg, ${c1}, ${c2})` }}>
                <View className='hf-cover-pat' />
                <Text className='hf-cover-region'>{regionLabel}</Text>
                <Text className='hf-cover-city'>{c.city}</Text>
              </View>
              <View className='hf-meta'>
                <Text className='hf-meta-name'>{c.name}</Text>
                <Text className='hf-meta-info'>{nightsLabel(c.dayCount)} · {c.spotCount} 个地点</Text>
              </View>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}
