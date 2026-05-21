import Taro from '@tarojs/taro'
import { cloud, type ShareKind } from './cloud'

interface SharePayload {
  title: string
  path: string
  kind: ShareKind
}

/**
 * 调云函数生成 token,构造分享卡片参数
 */
export async function buildShareMessage(tripId: string, tripName: string, kind: ShareKind): Promise<SharePayload> {
  const { token } = await cloud.createShareToken({ tripId, kind })
  const prefix = kind === 'readonly' ? '只读分享' : '邀请协作'
  return {
    title: `${prefix} · ${tripName}`,
    path: `/pages/share/index?token=${token}&kind=${kind}&tripId=${tripId}`,
    kind,
  }
}

/**
 * 让用户唤起原生分享(实际由 onShareAppMessage 返回 payload)。
 * 调用方先用 buildShareMessage 拿到 payload,再 setSharePayload 给页面,
 * 然后调用 wx.showShareMenu 引导用户点右上角"..."分享。
 *
 * 由于微信不允许从代码主动弹分享菜单,这里 toast 提示用户操作。
 */
export function promptUserToShare() {
  Taro.showModal({
    title: '点击右上角 "..." → 转发',
    content: '将分享卡片发送给微信好友',
    confirmText: '我知道了',
    showCancel: false,
  })
}
