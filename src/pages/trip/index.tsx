import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import { TripProvider, useTripStore } from '../../store/trip-store'
import ItineraryView from '../../views/ItineraryView'
import BudgetView from '../../views/BudgetView'
import PackingView from '../../views/PackingView'
import MapView from '../../views/MapView'
import CollaboratorsBar from '../../components/CollaboratorsBar'
import CollaboratorsSheet from '../../components/CollaboratorsSheet'
import TripActionSheet, { type TripAction } from '../../components/TripActionSheet'
import ShareTypeSheet from '../../components/ShareTypeSheet'
import { buildShareMessage, promptUserToShare } from '../../utils/share'
import { smartDeleteTrip, renameTrip, copyTripLocally } from '../../utils/db'
import type { ShareKind } from '../../utils/cloud'
import './index.scss'

type ViewKey = 'itinerary' | 'budget' | 'packing' | 'map'

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'itinerary', label: '攻略' },
  { key: 'budget', label: '开销' },
  { key: 'packing', label: '清单' },
  { key: 'map', label: '地图' },
]

function TripBody() {
  const { state } = useTripStore()
  const { openid } = useTripStore()
  const [view, setView] = useState<ViewKey>('itinerary')
  const [actionOpen, setActionOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [sharePayload, setSharePayload] = useState<{ title: string; path: string } | null>(null)
  const [collabSheetOpen, setCollabSheetOpen] = useState(false)

  const t = state.trip
  const isOwner = t ? t._openid === openid : false

  useShareAppMessage(() => {
    if (sharePayload) return sharePayload
    return { title: t ? `行册 · ${t.name}` : '行册', path: '/pages/home/index' }
  })

  if (state.loading) return <View className='trip-empty'>加载中...</View>
  if (state.error) return <View className='trip-empty'>{state.error}</View>
  if (!t) return <View className='trip-empty'>未找到攻略</View>

  const handleAction = async (action: TripAction) => {
    if (!t) return

    if (action === 'rename') {
      const res = await Taro.showModal({
        title: '重命名',
        content: t.name,
        editable: true,
        placeholderText: '攻略名',
      } as any)
      if (res.confirm && (res as any).content?.trim()) {
        await renameTrip(t._id, (res as any).content.trim(), openid)
      }
      return
    }
    if (action === 'copy') {
      const newId = await copyTripLocally(t._id, openid)
      Taro.showToast({ title: '已复制', icon: 'success', duration: 600 })
      setTimeout(() => {
        Taro.hideToast()
        Taro.redirectTo({ url: `/pages/trip/index?id=${newId}` })
      }, 650)
      return
    }
    if (action === 'delete') {
      const collabCount = (t.collaborators || []).length
      const title = isOwner ? '删除攻略？' : '退出协作？'
      const content = isOwner
        ? (collabCount > 0
            ? `还有 ${collabCount} 位协作者将失去访问，确认删除？`
            : `「${t.name}」将被永久删除`)
        : `退出后，「${t.name}」不再出现在你的攻略册中`
      const confirmText = isOwner ? '删除' : '退出'
      const res = await Taro.showModal({ title, content, confirmText, confirmColor: '#c43d3d' })
      if (res.confirm) {
        await smartDeleteTrip(t, openid)
        Taro.showToast({ title: isOwner ? '已删除' : '已退出', icon: 'success', duration: 500 })
        setTimeout(() => {
          Taro.hideToast()
          Taro.reLaunch({ url: '/pages/home/index' })
        }, 550)
      }
      return
    }
    if (action === 'share') {
      setShareOpen(true)
      return
    }
  }

  const onSelectShareKind = async (kind: ShareKind) => {
    if (!t) return
    if (!isOwner) {
      Taro.showToast({ title: '仅 owner 可分享', icon: 'none' })
      return
    }
    try {
      const payload = await buildShareMessage(t._id, t.name, kind)
      setSharePayload({ title: payload.title, path: payload.path })
      setShareOpen(false)
      promptUserToShare()
    } catch (e) {
      console.error(e)
      Taro.showToast({ title: '生成分享失败', icon: 'error' })
    }
  }

  return (
    <View className='trip theme-tegami'>
      <View className='trip-head'>
        <View className='th-row'>
          <Text className='th-name'>{t.name}</Text>
          <View className='th-menu' onClick={() => setActionOpen(true)}>⋯</View>
        </View>
        <Text className='th-meta'>
          {t.startDate} → {t.endDate} · {t.pax} 人
        </Text>
        <CollaboratorsBar
          collaborators={t.collaborators || []}
          ownerNickname={t.ownerNickname}
          isOwner={isOwner}
          onTap={() => setCollabSheetOpen(true)}
        />
      </View>

      <View className='trip-tabs'>
        {VIEWS.map(v => (
          <View
            key={v.key}
            className={`tt-item ${view === v.key ? 'on' : ''}`}
            onClick={() => setView(v.key)}
          >{v.label}</View>
        ))}
      </View>

      <View className='trip-content'>
        {view === 'itinerary' && <ItineraryView />}
        {view === 'budget' && <BudgetView />}
        {view === 'packing' && <PackingView />}
        {view === 'map' && <MapView />}
      </View>

      <TripActionSheet
        open={actionOpen}
        tripName={t.name}
        onSelect={handleAction}
        onClose={() => setActionOpen(false)}
      />

      <ShareTypeSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onSelect={onSelectShareKind}
      />

      <CollaboratorsSheet
        open={collabSheetOpen}
        collaborators={t.collaborators || []}
        ownerNickname={t.ownerNickname}
        ownerAvatarUrl={t.ownerAvatarUrl}
        onClose={() => setCollabSheetOpen(false)}
      />
    </View>
  )
}

export default function TripPage() {
  const router = useRouter()
  const tripId = router.params.id || ''
  const [openid, setOpenid] = useState('')

  useEffect(() => {
    // @ts-ignore Taro.cloud
    Taro.cloud.callFunction({
      name: 'ensure-user',
      data: { nickname: '行册旅人', avatarUrl: '' }
    }).then((r: any) => {
      if (r.result && r.result.openid) {
        setOpenid(r.result.openid)
      }
    })
  }, [])

  if (!tripId) return <View className='trip-empty'>缺少 trip id</View>
  if (!openid) return <View className='trip-empty'>登录中...</View>

  return (
    <TripProvider tripId={tripId} openid={openid}>
      <TripBody />
    </TripProvider>
  )
}
