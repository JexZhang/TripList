import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
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
  /** 隐私弹窗是否打开 */
  privacyOpen: boolean
  /** 同意隐私政策 */
  agreePrivacy: () => void
  /** 不同意（关闭弹窗） */
  dismissPrivacy: () => void
  /** 重新弹出隐私政策弹窗 */
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

  const agreePrivacy = useCallback(() => {
    Taro.setStorageSync(PRIVACY_KEY, Date.now())
    setConsented(true)
    setPrivacyOpen(false)
    refresh() // 同意后再拉用户数据
  }, [refresh])

  const dismissPrivacy = useCallback(() => {
    setPrivacyOpen(false)
  }, [])

  const value = useMemo(
    () => ({ me, refresh, openProfileSetup, quota, refreshQuota, consented, privacyOpen, agreePrivacy, dismissPrivacy, reopenPrivacy }),
    [me, refresh, openProfileSetup, quota, refreshQuota, consented, privacyOpen, agreePrivacy, dismissPrivacy, reopenPrivacy],
  )

  return (
    <MeContext.Provider value={value}>
      {children}
      <ProfileSetupModal
        open={setupOpen}
        initialNickname={me?.nickname}
        initialAvatarUrl={me?.avatarUrl}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
      {/* 隐私政策门：全局渲染，覆盖分享卡 / 深链等所有入口（不再只挂首页） */}
      <PrivacyConsent
        open={privacyOpen}
        onAgree={agreePrivacy}
        onDisagree={dismissPrivacy}
      />
      {!consented && !privacyOpen && (
        <View style={{ position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <Text style={{ fontSize: '28rpx', color: '#fff', textAlign: 'center', lineHeight: '1.6' }}>需同意隐私政策后使用</Text>
          <View
            style={{ marginTop: '32rpx', padding: '20rpx 48rpx', background: '#2c2c2c', color: '#fff', borderRadius: '16rpx', fontSize: '28rpx' }}
            onClick={reopenPrivacy}
          >查看隐私政策</View>
        </View>
      )}
    </MeContext.Provider>
  )
}

export function useMe(): Ctx {
  const ctx = useContext(MeContext)
  if (!ctx) throw new Error('useMe must be used within MeProvider')
  return ctx
}
