import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
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
}

const MeContext = createContext<Ctx | null>(null)

const SKIP_KEY = 'profileSetupSkippedAt'
// 本次启动跳过标记（仅当次会话有效，重启后再判定一次）
let sessionSkipped = false

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)

  const refresh = async () => {
    try {
      // @ts-ignore Taro.cloud
      const r = await Taro.cloud.callFunction({
        name: 'ensure-user',
        data: {},
      })
      const result = (r as any).result || {}
      setMe({
        openid: result.openid,
        nickname: result.nickname || '行册旅人',
        avatarUrl: result.avatarUrl || '',
        theme: (result.theme as ThemeName) || null,
        plan: (result.plan as 'free' | 'pro') || 'free',
      })
    } catch (e) {
      console.error('[me-store] ensure-user failed', e)
    }
  }

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

  const openProfileSetup = () => setSetupOpen(true)

  return (
    <MeContext.Provider value={{ me, refresh, openProfileSetup }}>
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
