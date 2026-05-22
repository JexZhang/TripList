import { cloud, type ShareKind } from './cloud'

interface SharePayload {
  title: string
  path: string
  kind: ShareKind
}

/**
 * 调云函数生成 token,构造分享卡片参数
 */
export async function buildShareMessage(
  tripId: string,
  tripName: string,
  kind: ShareKind,
): Promise<SharePayload> {
  const { token } = await cloud.createShareToken({ tripId, kind })
  const prefix = kind === 'readonly' ? '只读分享' : '邀请协作'
  return {
    title: `${prefix} · ${tripName}`,
    path: `/pages/share/index?token=${token}&kind=${kind}&tripId=${tripId}`,
    kind,
  }
}

/**
 * 模块级 share state,用于 useShareAppMessage 回调读取。
 * 流程: ShareTypeSheet 打开时为两个 kind 各预生成 token, 写入 byKind;
 * 用户点 <Button open-type="share" data-kind=...> 时, WeChat 触发 onShareAppMessage,
 * 页面用 options.target.dataset.kind 从 byKind 取对应 payload 返回.
 */
export const shareRef: {
  byKind: { readonly: { title: string; path: string } | null; collab: { title: string; path: string } | null }
  tripName: string
} = {
  byKind: { readonly: null, collab: null },
  tripName: '',
}

export function resetShareRef(tripName = '') {
  shareRef.byKind.readonly = null
  shareRef.byKind.collab = null
  shareRef.tripName = tripName
}
