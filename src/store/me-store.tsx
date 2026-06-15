import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import Taro from '@tarojs/taro'
import ProfileSetupModal from '../components/ProfileSetupModal'

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
}

const MeContext = createContext<Ctx | null>(null)

const SKIP_KEY = 'profileSetupSkippedAt'
// 本次启动跳过标记（仅当次会话有效，重启后再判定一次）
let sessionSkipped = false

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [quota, setQuota] = useState<{ flash: number; pro: number } | null>(null)

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
        nickname: (result.nickname as string) || '行册旅人',
        avatarUrl: (result.avatarUrl as string) || '',
        theme: (result.theme as ThemeName) || null,
        plan: (result.plan as 'free' | 'pro') || 'free',
      })
    } catch (e) {
      console.error('[me-store] ensure-user failed', e)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [])

  // 首次启动自动弹一次：用户还没设置过 nickname/avatar 且本次启动未跳过
  useEffect(() => {
    if (!me) return
    const needSetup = (!me.nickname || me.nickname === '行册旅人') && !me.avatarUrl
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

  const value = useMemo(
    () => ({ me, refresh, openProfileSetup, quota, refreshQuota }),
    [me, refresh, openProfileSetup, quota, refreshQuota],
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
    </MeContext.Provider>
  )
}

export function useMe(): Ctx {
  const ctx = useContext(MeContext)
  if (!ctx) throw new Error('useMe must be used within MeProvider')
  return ctx
}
