import { useEffect, useState } from 'react'

interface KbChangeEvent {
  detail: { height: number; duration?: number }
}

export interface KeyboardLift {
  /** 当前键盘高度（px） */
  height: number
  /** 直接 spread 到 Input / Textarea 上：禁用系统位移 + 监听键盘高度变化 */
  bind: {
    adjustPosition: false
    onKeyboardHeightChange: (e: KbChangeEvent) => void
  }
}

/**
 * 监听小程序键盘高度，用于 position:fixed 弹层手动抬升。
 *
 * 双保险：
 * 1) 全局 wx.onKeyboardHeightChange（覆盖整页输入）
 * 2) 每个 Input/Textarea 自带的 onKeyboardHeightChange（更可靠，确保聚焦时一定能拿到）
 *
 * H5/RN 环境下两路都是 no-op，height 始终为 0。
 */
export function useKeyboardLift(): KeyboardLift {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (process.env.TARO_ENV !== 'weapp') return
    const handler = (res: { height: number }) => setHeight(res.height || 0)
    // @ts-ignore wx 在小程序端为全局对象
    const g: any = typeof wx !== 'undefined' ? wx : undefined
    g?.onKeyboardHeightChange?.(handler)
    return () => g?.offKeyboardHeightChange?.(handler)
  }, [])

  return {
    height,
    bind: {
      adjustPosition: false,
      onKeyboardHeightChange: (e) => setHeight(e?.detail?.height || 0),
    },
  }
}

/** 旧接口：只返回 number，保持向后兼容。 */
export function useKeyboardHeight(): number {
  return useKeyboardLift().height
}
