import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import ProfileSetupModal from '../components/ProfileSetupModal'
import PrivacyConsent from '../components/PrivacyConsent'

export type ThemeName = 'tegami' | 'magazine' | 'postcard' | 'minimal'

export interface Me {
  openid: string
  nickname: string
  avatarUrl: string
  theme: ThemeName | null
  plan: 'free' | 'pro'
}

interface Ctx {
  me: Me | null
  refresh: () => Promise<void>
  openProfileSetup: () => void
  quota: { flash: number; pro: number } | null
  refreshQuota: () => Promise<void>
  /** 是否已同意隐私政策 */
  consented: boolean
  /** 重新弹出隐私政策弹窗（用于受限页面引导） */
  reopenPrivacy: () => void
}

const MeContext = createContext<Ctx | null>(null)

const PRIVACY_KEY = 'privacyConsentedAt'
const SKIP_KEY = 'profileSetupSkippedAt'
// 本次启动跳过标记（仅当次会话有效，重启后再判定一次）
let sessionSkipped = false

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [quota, setQuota] = useState<{ flash: number; pro: number } | null>(null)
  const [consented, setConsented] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)

  // 懒加载：首次需要时才拉配额（不在启动时拉，避免不用 AI 的用户冷启动多一次云调用）
  const refreshQuota = useCallback(async () => {
    try {
      // @ts-ignore Taro.cloud
      const r = await Taro.cloud.callFunction({ name: 'ai-plan-trip', data: { _mode: 'quota' } })
      const res = (r as { result?: { ok: boolean; flash: { remaining: number }; pro: { remaining: number } } }).result
      if (res?.ok) setQuota({ flash: res.flash.remaining, pro: res.pro.remaining })
    } catch {
      /* 查询失败时不阻塞用户 */
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      // @ts-ignore Taro.cloud
      const r = await Taro.cloud.callFunction({
        name: 'ensure-user',
        data: {},
      })
      const result = (r as { result?: Record<string, unknown> }).result || {}
      setMe({
        openid: result.openid as string,
        nickname: (result.nickname as string) || '行迹旅人',
        avatarUrl: (result.avatarUrl as string) || '',
        theme: (result.theme as ThemeName) || null,
        plan: (result.plan as 'free' | 'pro') || 'free',
      })
    } catch (e) {
      console.error('[me-store] ensure-user failed', e)
    }
  }, [])

  useEffect(() => {
    // 检查隐私政策同意状态
    const agreed = Taro.getStorageSync(PRIVACY_KEY)
    if (agreed) {
      setConsented(true)
      refresh() // 已同意时才拉用户数据
    } else {
      setPrivacyOpen(true)
    }
  }, [])

  // 首次启动自动弹一次：用户还没设置过 nickname/avatar 且本次启动未跳过
  useEffect(() => {
    if (!me) return
    const needSetup = (!me.nickname || me.nickname === '行迹旅人') && !me.avatarUrl
    if (!needSetup) return
    if (sessionSkipped) return
    setSetupOpen(true)
  }, [me])

  const handleSubmit = async (data: { nickname: string; avatarUrl: string }) => {
    // @ts-ignore Taro.cloud
    await Taro.cloud.callFunction({
      name: 'ensure-user',
      data,
    })
    await refresh()
  }

  const handleClose = () => {
    setSetupOpen(false)
    sessionSkipped = true
    Taro.setStorage({ key: SKIP_KEY, data: Date.now() }).catch(() => {})
  }

  const openProfileSetup = useCallback(() => setSetupOpen(true), [])
  const reopenPrivacy = useCallback(() => setPrivacyOpen(true), [])

  const handleAgree = () => {
    Taro.setStorageSync(PRIVACY_KEY, Date.now())
    setConsented(true)
    setPrivacyOpen(false)
    refresh() // 同意后再拉用户数据
  }
  const handleDisagree = () => {
    setPrivacyOpen(false)
  }

  const value = useMemo(
    () => ({ me, refresh, openProfileSetup, quota, refreshQuota, consented, reopenPrivacy }),
    [me, refresh, openProfileSetup, quota, refreshQuota, consented],
  )

  return (
    <MeContext.Provider value={value}>
      {consented ? children : (
        <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', padding: '0 48rpx' }}>
          <Text style={{ fontSize: '28rpx', color: '#999', textAlign: 'center', lineHeight: '1.6' }}>需同意隐私政策后使用</Text>
          <View
            style={{ marginTop: '32rpx', padding: '20rpx 48rpx', background: '#2c2c2c', color: '#fff', borderRadius: '16rpx', fontSize: '28rpx' }}
            onClick={reopenPrivacy}
          >查看隐私政策</View>
        </View>
      )}
      <ProfileSetupModal
        open={setupOpen}
        initialNickname={me?.nickname}
        initialAvatarUrl={me?.avatarUrl}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
      <PrivacyConsent
        open={privacyOpen}
        onAgree={handleAgree}
        onDisagree={handleDisagree}
      />
    </MeContext.Provider>
  )
}

export function useMe(): Ctx {
  const ctx = useContext(MeContext)
  if (!ctx) throw new Error('useMe must be used within MeProvider')
  return ctx
}
