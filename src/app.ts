import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'

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
  useLaunch(async () => {
    console.log('App launched.')
    
    if (process.env.TARO_ENV !== 'weapp') return
    try {
      // 拉取微信资料；用户首次进入时也写入 users 表
      const profile = await Taro.getStorage({ key: 'userProfile' }).catch(() => ({ data: null }))
      if (profile.data) {
        await wx.cloud.callFunction({
          name: 'ensure-user',
          data: {
            nickname: profile.data.nickName || '行册旅人',
            avatarUrl: profile.data.avatarUrl || '',
          }
        })
      }
    } catch (e) {
      console.warn('ensure-user failed at launch (will retry on next login)', e)
    }
  })

  // children 是将要会渲染的页面
  return children
}
  


export default App
