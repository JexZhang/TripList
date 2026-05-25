import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'

/**
 * 监听小程序键盘高度变化。
 * 比 Input 上的 onKeyboardHeightChange 更可靠 —— 不依赖 Input 的 focus 时序，
 * 即使 <Input focus /> 自动聚焦也能拿到首次的键盘高度。
 *
 * H5/RN 环境会返回 0,不做处理。
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (process.env.TARO_ENV !== 'weapp') return
    const handler = (res: { height: number }) => setHeight(res.height || 0)
    // @ts-ignore wx 在小程序端可用
    wx.onKeyboardHeightChange(handler)
    return () => {
      // @ts-ignore
      wx.offKeyboardHeightChange?.(handler)
    }
  }, [])

  return height
}
