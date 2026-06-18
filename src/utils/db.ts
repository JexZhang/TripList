import Taro from '@tarojs/taro'
import type { Trip, NewTripInput } from '../types/trip'
import { cloud } from './cloud'

// @ts-ignore Taro.cloud 在 weapp 端可用
const db = () => Taro.cloud.database()

const TRIPS = 'trips'

export interface ListTripsResult {
  trips: Trip[]
}

/**
 * 获取当前用户拥有的所有 trips(owner ∪ collaborator)。
 * 走 list-my-trips 云函数以绕过 client 端权限规则限制。
 */
export async function listMyTrips(_openid: string): Promise<Trip[]> {
  const r = await (Taro as any).cloud.callFunction({ name: 'list-my-trips' })
  const trips = ((r && r.result && r.result.trips) || []) as Trip[]
  return trips
}

/**
 * 获取一条 trip。返回 null 仅代表文档不存在；其它错误(网络/权限)抛出。
 * owner 走客户端 doc().get() 直读；协作者被安全规则拒绝后自动回退到云函数。
 */
export async function getTrip(tripId: string): Promise<Trip | null> {
  try {
    const res = await db().collection(TRIPS).doc(tripId).get({})
    if (!res || !res.data) return null
    return res.data as Trip
  } catch (e: any) {
    // 文档不存在
    if (e && (e.errCode === -502005 || /not.*exist|not.*found/i.test(e.errMsg || ''))) {
      return null
    }
    // 权限被拒 → 可能是协作者，走云函数回退
    if (e && (e.errCode === -502003 || /permission|SecurityRule/i.test(e.errMsg || ''))) {
      try {
        const r = await (Taro as any).cloud.callFunction({
          name: 'update-trip',
          data: { tripId, action: 'get' },
        })
        const trip = r?.result?.trip
        return trip || null
      } catch {
        return null
      }
    }
    console.error('[getTrip]', tripId, e)
    throw e
  }
}

/**
 * 新建 trip
 */
export async function createTrip(input: NewTripInput): Promise<string> {
  const now = Date.now()
  const res = await db().collection(TRIPS).add({
    data: {
      ...input,
      collaboratorOpenids: [],
      createdAt: now,
      updatedAt: now,
      updatedBy: input.ownerOpenid,
    }
  })
  return res._id as string
}

/**
 * 全量替换更新一条 trip(走 update-trip 云函数,绕开客户端规则,owner + collaborator 都可写)
 */
export async function updateTrip(tripId: string, patch: Partial<Trip>, _openid: string): Promise<void> {
  await cloud.updateTrip({ tripId, patch: patch as Record<string, unknown> })
}

/**
 * 重命名（薄封装）
 */
export async function renameTrip(tripId: string, newName: string, openid: string): Promise<void> {
  return updateTrip(tripId, { name: newName }, openid)
}

/**
 * 删除一条 trip（仅 owner 调用）
 * 使用 where 替代 doc，查询条件包含 _openid 以满足安全规则子集检查
 */
export async function deleteTrip(tripId: string): Promise<void> {
  const res = await (db().collection(TRIPS) as any).where({
    _id: tripId,
    _openid: '{openid}',
  }).remove()
  if (res?.stats?.removed === 0) {
    throw new Error('删除失败（无权限或记录不存在）')
  }
}

/**
 * 客户端复制：取源 trip，剥离身份/时间戳，作为新 doc 写入
 * 注意：此方法用于"用户在自己攻略册里复制一份"（不是分享接收）。
 *      分享接收复制由云函数 clone-trip 处理。
 */
export async function copyTripLocally(
  sourceTripId: string,
  openid: string,
  me?: { nickname?: string; avatarUrl?: string },
): Promise<string> {
  const src = await getTrip(sourceTripId)
  if (!src) throw new Error('source trip not found')

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    _id, _openid, ownerOpenid, ownerNickname, ownerAvatarUrl,
    collaborators, createdAt, updatedAt, updatedBy, name,
    aiTaskId, aiStatus, aiDraft, aiError,
    ...rest
  } = src
  const cloned: NewTripInput = {
    ...rest,
    name: `${name} · 副本`,
    ownerOpenid: openid,
    ownerNickname: me?.nickname || '行迹旅人',
    ownerAvatarUrl: me?.avatarUrl || '',
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
    // 使用 where 替代 doc，查询条件包含 _openid 以满足安全规则子集检查
    const res = await (db().collection(TRIPS) as any).where({
      _id: trip._id,
      _openid: '{openid}',
    }).remove()
    if (res?.stats?.removed === 0) {
      throw new Error('删除失败（无权限或记录不存在）')
    }
    return 'delete'
  }
  // 非 owner：通过云函数退出协作（云函数不受客户端安全规则限制）
  await cloud.updateTrip({ tripId: trip._id, patch: { __leaveCollab: true } })
  return 'leave'
}
