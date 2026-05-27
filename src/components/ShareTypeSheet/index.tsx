import { useEffect, useState } from 'react'
import { View, Text, Button, RootPortal } from '@tarojs/components'
import type { ShareKind } from '../../utils/cloud'
import './index.scss'

interface Props {
  open: boolean
  onClose: () => void
  // 父组件预生成两个 kind 的 share payload(写入模块级 ref),
  // 我们渲染 <Button open-type="share"> 让 WeChat 直接拉起转发,
  // 不再依赖右上角菜单 onShareAppMessage 注册
  prepare: (kind: ShareKind) => Promise<void> | void
  ready: { readonly: boolean; collab: boolean }
}

export default function ShareTypeSheet({ open, onClose, prepare, ready }: Props) {
  const [preparing, setPreparing] = useState<ShareKind | null>(null)

  useEffect(() => {
    if (!open) return
    ;(async () => {
      setPreparing('readonly')
      await prepare('readonly')
      setPreparing('collab')
      await prepare('collab')
      setPreparing(null)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const renderItem = (kind: ShareKind, title: string, desc: string) => {
    const isReady = ready[kind]
    return (
      <Button
        className='sts-item'
        openType={isReady ? 'share' : undefined}
        data-kind={kind}
        disabled={!isReady}
        onClick={isReady ? onClose : undefined}
      >
        <Text className='sts-item-title'>{title}</Text>
        <Text className='sts-item-desc'>{desc}</Text>
        {!isReady && (
          <Text className='sts-item-loading'>{preparing === kind ? '准备中...' : '等待中'}</Text>
        )}
      </Button>
    )
  }

  return (
    <RootPortal>
      <View className='sts-mask' onClick={onClose}>
        <View className='sts-sheet' onClick={e => e.stopPropagation()}>
          {renderItem('readonly', '🔒 只读分享', '对方收到一份独立副本,可自由编辑、删除,不影响你这边')}
          {renderItem('collab', '👥 邀请协作', '对方加入后能编辑同一份攻略,改动实时同步')}
          <View className='sts-cancel' onClick={onClose}>
            <Text>取消</Text>
          </View>
        </View>
      </View>
    </RootPortal>
  )
}
