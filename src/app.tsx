import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'

import { MeProvider } from './store/me-store'
import { ThemeProvider } from './store/theme-store'
import './app.scss'

// 初始化微信云开发（小程序端）
if (process.env.TARO_ENV === 'weapp') {
  if (!wx.cloud) {
    console.error('请使用 2.2.3 及以上的基础库以使用云能力')
  } else {
    wx.cloud.init({
      env: 'cloud1-d3gb6mt7red446466',
      traceUser: true,
    })
  }
}

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
    // ensure-user 由 MeProvider 负责调用,不要在这里传 nickname/avatarUrl,
    // 否则会覆盖用户已保存的昵称
  })

  // children 是将要会渲染的页面
  return (
    <MeProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </MeProvider>
  )
}
  


export default App
