import Taro from '@tarojs/taro'

/** 默认封面：所有 trip 未自定义时使用 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const DEFAULT_COVER = require('../assets/cover/default-cover.jpg')

/** Taro require 返回的是 string（H5）或经过编译的 ./assets/... 路径（weapp） */

interface ResolveOptions {
  /** 缺省时返回 DEFAULT_COVER */
  fallback?: string
}

/**
 * 把 trip.coverUrl 解析为可在 <Image src=> 直接消费的字符串：
 * - null / undefined / '' → fallback（默认图）
 * - 以 'cloud://' 开头 → 在小程序端，<Image> 直接支持 cloud:// 协议；H5 端需要 getTempFileURL
 *   本项目仅小程序，直接返回即可
 * - 其他 https:// 链接 → 原样返回
 */
export function resolveCoverUrl(
  coverUrl: string | null | undefined,
  opts: ResolveOptions = {},
): string {
  const fallback = opts.fallback || DEFAULT_COVER
  if (!coverUrl) return fallback
  return coverUrl
}

/** 上传本地图到云存储，返回 fileID */
export async function uploadCover(localPath: string, openid: string): Promise<string> {
  const ts = Date.now()
  const cloudPath = `covers/${openid}/${ts}.jpg`
  // @ts-ignore Taro.cloud.uploadFile
  const r = await Taro.cloud.uploadFile({
    cloudPath,
    filePath: localPath,
  })
  return (r as { fileID: string }).fileID
}

/**
 * 上传头像到云存储，返回 cloud:// fileID。
 * chooseAvatar 返回的是本地临时路径（仅本机可用），必须上传到云存储
 * 才能让其他设备（协作者/owner）正常显示。
 */
export async function uploadAvatar(localPath: string): Promise<string> {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const cloudPath = `avatars/${ts}_${rand}.jpg`
  // @ts-ignore Taro.cloud.uploadFile
  const r = await Taro.cloud.uploadFile({
    cloudPath,
    filePath: localPath,
  })
  return (r as { fileID: string }).fileID
}

/** 判断 URL 是否为云存储 fileID（cloud:// 协议） */
export function isCloudUrl(url: string): boolean {
  return url.startsWith('cloud://')
}
