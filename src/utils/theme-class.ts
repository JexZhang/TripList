import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { useTheme, type ThemeName } from '../store/theme-store'

/** 各主题的窗口底色（同 tokens.scss 的 --bg），用于原生回弹/下拉区域，消除白底 */
const THEME_BG: Record<ThemeName, string> = {
  tegami: '#FFF4E6',
  magazine: '#F4F0E8',
  postcard: '#EFE6D5',
  minimal: '#FAFAF8',
}

/**
 * 返回当前主题对应的根 className 字符串，并在主题变化时
 * 把原生窗口背景刷成主题底色（解决上下回弹露白底问题）。
 * 用法：<View className={`home ${useThemeClass()}`}>...
 */
export function useThemeClass(extra?: string): string {
  const { theme } = useTheme()

  useEffect(() => {
    const bg = THEME_BG[theme] || THEME_BG.tegami
    // 原生窗口背景 + 上下回弹区背景
    Taro.setBackgroundColor({
      backgroundColor: bg,
      backgroundColorTop: bg,
      backgroundColorBottom: bg,
    }).catch(() => { /* H5 等端无此 API，忽略 */ })
    // 四个主题底色都偏浅，下拉 loading 用深色
    Taro.setBackgroundTextStyle({ textStyle: 'dark' }).catch(() => { /* ignore */ })
  }, [theme])

  const base = `theme-tokens theme-${theme}`
  return extra ? `${base} ${extra}` : base
}
