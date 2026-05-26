import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useTheme, VALID_THEMES, type ThemeName } from '../../store/theme-store'
import { useThemeClass } from '../../utils/theme-class'
import BrandLogo from '../../components/BrandLogo'
import AIBadge from '../../components/AIBadge'
import AIInterview from '../../components/AIInterview'
import AILoadingTheater, { type TheaterStatus } from '../../components/AILoadingTheater'
import TripAIStatusBar from '../../components/TripAIStatusBar'
import HomeCardAIRow from '../../components/HomeCardAIRow'
import './index.scss'

export default function Preview() {
  const cls = useThemeClass('preview')
  const { theme, setTheme } = useTheme()
  const [aiOpen, setAiOpen] = useState(false)
  const [theaterStatus, setTheaterStatus] = useState<TheaterStatus | null>(null)
  const [statusBarOpen, setStatusBarOpen] = useState(false)

  return (
    <View className={cls}>
      <View className='preview-theme-bar'>
        {VALID_THEMES.map((t: ThemeName) => (
          <View
            key={t}
            className={`preview-theme-chip ${theme === t ? 'on' : ''}`}
            onClick={() => setTheme(t)}
          >{t}</View>
        ))}
      </View>

      <View className='preview-section'>
        <Text className='preview-section-title'>BrandLogo · 钤印</Text>
        <View className='preview-row'>
          <Text className='preview-row-label'>lg</Text>
          <BrandLogo size='lg' />
        </View>
        <View className='preview-row'>
          <Text className='preview-row-label'>md</Text>
          <BrandLogo size='md' />
        </View>
        <View className='preview-row'>
          <Text className='preview-row-label'>sm</Text>
          <BrandLogo size='sm' />
        </View>
      </View>

      <View className='preview-section'>
        <Text className='preview-section-title'>AIBadge · 4 status × 2 size</Text>
        <View className='preview-row'>
          <Text className='preview-row-label'>compact</Text>
          <AIBadge status='idle' size='compact' />
          <AIBadge status='thinking' size='compact' />
          <AIBadge status='ready' size='compact' />
          <AIBadge status='error' size='compact' />
        </View>
        <View className='preview-row preview-row--stack'>
          <Text className='preview-row-label'>lg (idle)</Text>
          <AIBadge status='idle' size='lg' label='让 AI 帮你规划' />
        </View>
        <View className='preview-row preview-row--stack'>
          <Text className='preview-row-label'>lg (thinking)</Text>
          <AIBadge status='thinking' size='lg' />
        </View>
      </View>

      <View className='preview-section'>
        <Text className='preview-section-title'>AIInterview · 采访式 sheet</Text>
        <View className='preview-row preview-row--stack'>
          <AIBadge status='idle' size='lg' label='让 AI 帮你规划' onClick={() => setAiOpen(true)} />
        </View>
      </View>
      <AIInterview
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onSubmit={(prefs) => {
          console.log('[preview] interview submit', prefs)
          setAiOpen(false)
        }}
      />

      <View className='preview-section'>
        <Text className='preview-section-title'>AILoadingTheater · 全屏</Text>
        <View className='preview-row'>
          <View className='preview-theme-chip' onClick={() => setTheaterStatus('thinking')}>thinking</View>
          <View className='preview-theme-chip' onClick={() => setTheaterStatus('ready')}>ready</View>
          <View className='preview-theme-chip' onClick={() => setTheaterStatus('error')}>error</View>
        </View>
      </View>
      <AILoadingTheater
        open={theaterStatus !== null}
        status={theaterStatus || 'thinking'}
        onCancel={() => setTheaterStatus(null)}
        onMinimize={() => setTheaterStatus(null)}
      />

      <View className='preview-section'>
        <Text className='preview-section-title'>TripAIStatusBar · 最小化态</Text>
        <TripAIStatusBar open={statusBarOpen} onTap={() => setStatusBarOpen(false)} />
        <View className='preview-row'>
          <View className='preview-theme-chip' onClick={() => setStatusBarOpen((v) => !v)}>
            {statusBarOpen ? '隐藏' : '显示'}
          </View>
        </View>
      </View>

      <View className='preview-section'>
        <Text className='preview-section-title'>HomeCardAIRow · 卡内行</Text>
        <View className='preview-row preview-row--stack'>
          <HomeCardAIRow status='thinking' hint='预计 30s' />
          <HomeCardAIRow status='ready' />
          <HomeCardAIRow status='error' />
        </View>
      </View>
    </View>
  )
}
