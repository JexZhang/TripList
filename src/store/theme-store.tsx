import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import Taro from '@tarojs/taro'
import { useMe, type ThemeName } from './me-store'

export type { ThemeName }
export const VALID_THEMES: ThemeName[] = ['tegami', 'magazine', 'postcard', 'minimal']
export const DEFAULT_THEME: ThemeName = 'tegami'

const STORAGE_KEY = 'theme:selected'

interface ThemeCtx {
  theme: ThemeName
  setTheme: (next: ThemeName) => void
}

const ThemeContext = createContext<ThemeCtx | null>(null)

function readStorageTheme(): ThemeName | null {
  try {
    const v = Taro.getStorageSync(STORAGE_KEY)
    if (typeof v === 'string' && (VALID_THEMES as string[]).includes(v)) {
      return v as ThemeName
    }
  } catch {
    /* ignore */
  }
  return null
}

function writeStorageTheme(theme: ThemeName): void {
  try {
    Taro.setStorageSync(STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}

async function writeCloudTheme(theme: ThemeName): Promise<void> {
  try {
    // @ts-ignore Taro.cloud
    await Taro.cloud.callFunction({
      name: 'ensure-user',
      data: { theme },
    })
  } catch (e) {
    console.error('[theme-store] writeCloudTheme failed', e)
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { me } = useMe()
  const [theme, setThemeState] = useState<ThemeName>(() => readStorageTheme() || DEFAULT_THEME)
  const [mergedFromCloud, setMergedFromCloud] = useState(false)

  // 登录回调：me 第一次 ready 时合并云端值
  useEffect(() => {
    if (!me || mergedFromCloud) return
    setMergedFromCloud(true)
    if (me.theme) {
      // 云端优先
      setThemeState(me.theme)
      writeStorageTheme(me.theme)
    } else {
      // 云端无值：把本地选择上传一次
      const local = readStorageTheme()
      if (local) {
        writeCloudTheme(local)
      }
    }
  }, [me, mergedFromCloud])

  const setTheme = useCallback((next: ThemeName) => {
    if (!VALID_THEMES.includes(next)) return
    setThemeState(next)
    writeStorageTheme(next)
    void writeCloudTheme(next)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
