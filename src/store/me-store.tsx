import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import Taro from '@tarojs/taro'

export interface Me {
  openid: string
  nickname: string
  avatarUrl: string
}

interface Ctx {
  me: Me | null
  refresh: () => Promise<void>
}

const MeContext = createContext<Ctx | null>(null)

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)

  const refresh = async () => {
    try {
      // @ts-ignore Taro.cloud
      const r = await Taro.cloud.callFunction({
        name: 'ensure-user',
        data: { nickname: '行册旅人', avatarUrl: '' },
      })
      const result = (r as any).result || {}
      setMe({
        openid: result.openid,
        nickname: result.nickname || '行册旅人',
        avatarUrl: result.avatarUrl || '',
      })
    } catch (e) {
      console.error('[me-store] ensure-user failed', e)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <MeContext.Provider value={{ me, refresh }}>{children}</MeContext.Provider>
  )
}

export function useMe(): Ctx {
  const ctx = useContext(MeContext)
  if (!ctx) throw new Error('useMe must be used within MeProvider')
  return ctx
}
