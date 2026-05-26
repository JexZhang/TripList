import { useTheme } from '../store/theme-store'

/**
 * 返回当前主题对应的根 className 字符串。
 * 用法：<View className={`home ${useThemeClass()}`}>...
 */
export function useThemeClass(extra?: string): string {
  const { theme } = useTheme()
  const base = `theme-tokens theme-${theme}`
  return extra ? `${base} ${extra}` : base
}
