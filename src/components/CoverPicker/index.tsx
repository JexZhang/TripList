import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { uploadCover } from '../../utils/cover'
import './index.scss'

interface Props {
  open: boolean
  openid: string
  /** 用户确认上传后，父组件接收新的 cloud fileID（或 null = 恢复默认） */
  onPicked: (fileIDOrNull: string | null) => void
  onClose: () => void
}

export default function CoverPicker({ open, openid, onPicked, onClose }: Props) {
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const choose = async (source: 'camera' | 'album') => {
    if (busy) return
    setBusy(true)
    try {
      // @ts-ignore Taro.chooseMedia
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: [source],
        sizeType: ['compressed'],
      })
      const file = res.tempFiles?.[0]
      if (!file?.tempFilePath) throw new Error('no file')
      Taro.showLoading({ title: '上传中…' })
      const fileID = await uploadCover(file.tempFilePath, openid)
      Taro.hideLoading()
      Taro.showToast({ title: '已更新封面', icon: 'success' })
      onPicked(fileID)
    } catch (e) {
      Taro.hideLoading()
      const msg = (e as { errMsg?: string })?.errMsg || ''
      if (!msg.includes('cancel')) {
        console.error('[CoverPicker]', e)
        Taro.showToast({ title: '上传失败', icon: 'none' })
      }
    } finally {
      setBusy(false)
    }
  }

  const restoreDefault = () => {
    onPicked(null)
    Taro.showToast({ title: '已恢复默认封面', icon: 'success' })
  }

  return (
    <View className='cp-mask theme-tokens' onClick={onClose}>
      <View className='cp-sheet' onClick={(e) => e.stopPropagation()}>
        <Text className='cp-title'>更换封面</Text>
        <Text className='cp-sub'>16:10 比例展示，建议横构图</Text>
        <View className='cp-actions'>
          <View className='cp-action' onClick={() => choose('camera')}>
            <Text className='cp-action-emoji'>📷</Text>
            <Text>拍照</Text>
          </View>
          <View className='cp-action' onClick={() => choose('album')}>
            <Text className='cp-action-emoji'>🖼️</Text>
            <Text>从相册选</Text>
          </View>
          <View className='cp-action cp-action--text' onClick={restoreDefault}>
            <Text className='cp-action-emoji'>↺</Text>
            <Text>恢复默认</Text>
          </View>
        </View>
        <View className='cp-cancel' onClick={onClose}>取消</View>
      </View>
    </View>
  )
}
