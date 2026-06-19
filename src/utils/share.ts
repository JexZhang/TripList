import { cloud, type ShareKind } from './cloud'

export interface SharePayload {
  title: string
  path: string
  imageUrl?: string
  kind: ShareKind
}

/**
 * 调云函数生成 token,构造分享卡片参数。
 * title 由调用方通过 buildShareTitle 生成后传入。
 */
export async function buildShareMessage(
  tripId: string,
  title: string,
  kind: ShareKind,
  imageUrl?: string,
): Promise<SharePayload> {
  const { token } = await cloud.createShareToken({ tripId, kind })
  return {
    title,
    path: `/pages/share/index?token=${token}&kind=${kind}&tripId=${tripId}`,
    imageUrl,
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
  byKind: { readonly: SharePayload | null; collab: SharePayload | null }
  tripName: string
  lastKind: ShareKind | null
  imageUrl?: string
} = {
  byKind: { readonly: null, collab: null },
  tripName: '',
  lastKind: null,
  imageUrl: undefined,
}

export function resetShareRef(tripName = '') {
  shareRef.byKind.readonly = null
  shareRef.byKind.collab = null
  shareRef.tripName = tripName
  shareRef.imageUrl = undefined
}
