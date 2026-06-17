import { View, Text, ScrollView } from '@tarojs/components'
import type { TemplateCard } from '../../types/template'
import './styles/home-featured.scss'

interface HomeFeaturedRowProps {
  templates: TemplateCard[]
  onOpenTemplate: (id: string) => void
  onOpenLibrary: () => void
}

function nightsLabel(dayCount: number): string {
  return `${dayCount}天${Math.max(0, dayCount - 1)}晚`
}

/** 首页精选攻略横滑区（四主题共用，随 CSS 变量变色） */
export default function HomeFeaturedRow({ templates, onOpenTemplate, onOpenLibrary }: HomeFeaturedRowProps) {
  if (templates.length === 0) return null
  return (
    <View className='home-featured'>
      <View className='home-featured-h'>
        <Text className='home-featured-t'>精选攻略</Text>
        <Text className='home-featured-more' onClick={onOpenLibrary}>查看全部 ›</Text>
      </View>
      <ScrollView scrollX className='home-featured-row' showScrollbar={false}>
        {templates.map((c) => (
          <View key={c._id} className='home-featured-card' onClick={() => onOpenTemplate(c._id)}>
            <Text className='home-featured-name'>{c.name}</Text>
            <Text className='home-featured-meta'>{c.city} · {nightsLabel(c.dayCount)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}
