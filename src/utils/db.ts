import Taro from '@tarojs/taro'
import type { Trip, NewTripInput, Collaborator } from '../types/trip'

// @ts-ignore Taro.cloud 在 weapp 端可用
const db = () => Taro.cloud.database()

const TRIPS = 'trips'

export interface ListTripsResult {
  trips: Trip[]
}

/**
 * 获取当前用户拥有的所有 trips（按 updatedAt 倒序）
 * Phase 5 起扩展为 owner ∪ collaborator
 */
export async function listMyTrips(openid: string): Promise<Trip[]> {
  const _ = (Taro as any).cloud.database().command
  const res = await db()
    .collection(TRIPS)
    .where(_.or([
      { _openid: openid },
      { 'collaborators.openid': openid },
    ]))
    .orderBy('updatedAt', 'desc')
    .get()
  return (res.data || []) as Trip[]
}

/**
 * 获取一条 trip
 */
export async function getTrip(tripId: string): Promise<Trip | null> {
  const res = await db().collection(TRIPS).doc(tripId).get({}).catch(() => null)
  if (!res || !res.data) return null
  return res.data as Trip
}

/**
 * 新建 trip
 */
export async function createTrip(input: NewTripInput): Promise<string> {
  const now = Date.now()
  const res = await db().collection(TRIPS).add({
    data: {
      ...input,
      createdAt: now,
      updatedAt: now,
      updatedBy: input.ownerOpenid,
    }
  })
  return res._id as string
}

/**
 * 全量替换更新一条 trip（用于编辑保存）
 */
export async function updateTrip(tripId: string, patch: Partial<Trip>, openid: string): Promise<void> {
  await db().collection(TRIPS).doc(tripId).update({
    data: {
      ...patch,
      updatedAt: Date.now(),
      updatedBy: openid,
    }
  })
}

/**
 * 重命名（薄封装）
 */
export async function renameTrip(tripId: string, newName: string, openid: string): Promise<void> {
  return updateTrip(tripId, { name: newName }, openid)
}

/**
 * 删除一条 trip（仅 owner 调用，权限规则会兜底）
 */
export async function deleteTrip(tripId: string): Promise<void> {
  await db().collection(TRIPS).doc(tripId).remove({})
}

/**
 * 客户端复制：取源 trip，剥离身份/时间戳，作为新 doc 写入
 * 注意：此方法用于"用户在自己攻略册里复制一份"（不是分享接收）。
 *      分享接收复制由云函数 clone-trip 处理。
 */
export async function copyTripLocally(sourceTripId: string, openid: string): Promise<string> {
  const src = await getTrip(sourceTripId)
  if (!src) throw new Error('source trip not found')

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, _openid, ownerOpenid, collaborators, createdAt, updatedAt, updatedBy, name, ...rest } = src
  const cloned: NewTripInput = {
    ...rest,
    name: `${name} · 副本`,
    ownerOpenid: openid,
    collaborators: [],
  }
  return createTrip(cloned)
}

/**
 * 删除一条 trip，按身份分支：
 * - 非 owner：从 collaborators 数组移除自己（退出协作）
 * - owner：真删（前提：已确认）
 */
export async function smartDeleteTrip(trip: Trip, openid: string): Promise<'leave' | 'delete'> {
  if (trip._openid === openid) {
    await db().collection(TRIPS).doc(trip._id).remove({})
    return 'delete'
  }
  // 非 owner：退出协作
  const _ = (Taro as any).cloud.database().command
  await db().collection(TRIPS).doc(trip._id).update({
    data: {
      collaborators: _.pull({ openid }),
      updatedAt: Date.now(),
      updatedBy: openid,
    }
  })
  return 'leave'
}

/**
 * 监听当前用户的 trips 列表实时变化
 * 返回一个 watcher，调用 .close() 取消监听
 * Phase 5 起扩展为 owner ∪ collaborator
 */
export function watchMyTrips(openid: string, onChange: (trips: Trip[]) => void) {
  const _ = (Taro as any).cloud.database().command
  // @ts-ignore
  return db()
    .collection(TRIPS)
    .where(_.or([
      { _openid: openid },
      { 'collaborators.openid': openid },
    ]))
    .orderBy('updatedAt', 'desc')
    .watch({
      onChange: (snapshot: any) => {
        onChange(snapshot.docs || [])
      },
      onError: (err: unknown) => {
        console.error('[watchMyTrips]', err)
      }
    })
}
