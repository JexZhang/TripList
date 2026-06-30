import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('src/components/TripDayOrganizerSheet/index.tsx', 'utf8')

test('organizer drag uses native movable components instead of View touchmove inside ScrollView', () => {
  assert.match(source, /import \{[^}]*MovableArea[^}]*MovableView[^}]*\} from '@tarojs\/components'/)
  assert.match(source, /<View\s+className='tdos-organizer-board'/)
  assert.match(source, /className='tdos-slot-column'/)
  assert.match(source, /<MovableArea\s+className='tdos-card-area'/)
  assert.match(source, /<MovableView[\s\S]*className=\{`tdos-movable-row/)
  assert.match(source, /direction='vertical'/)
  assert.doesNotMatch(source, /disabled=\{!dragging\}/)
  assert.match(source, /onChange=\{\(event\) => moveDrag\(day\.id, event\)\}/)
  assert.match(source, /onTouchEnd=\{endDrag\}/)
  assert.match(source, /className='tdos-drag-handle'[\s\S]*onTouchStart=\{\(\) => startDrag\(day\.id, index\)\}/)

  assert.doesNotMatch(source, /className='tdos-drag-handle'[\s\S]*onTouchMove=\{moveDrag\}/)
})

test('date slots stay outside movable cards and only the fixed slot is highlighted', () => {
  const movableArea = source.match(/<MovableArea[\s\S]*<\/MovableArea>/)?.[0] || ''
  assert.doesNotMatch(movableArea, /tdos-slot/)
  assert.doesNotMatch(movableArea, /is-highlighted/)
  assert.match(source, /buildOrganizerDateSlots\(/)
  assert.match(source, /className=\{`tdos-slot-row \$\{highlighted \? 'is-highlighted' : ''\}`\}/)
})

test('deleting the initially highlighted day clears the organizer highlight', () => {
  assert.match(source, /if \(day\.id === initialDayId\) setHighlightedSlotIndex\(null\)/)
})

test('only the right action rail is inside the native movable touch box', () => {
  const styles = fs.readFileSync('src/components/TripDayOrganizerSheet/index.scss', 'utf8')
  assert.match(styles, /\.tdos-movable-row\s*\{[\s\S]*width:\s*144rpx/)
  assert.match(styles, /\.tdos-movable-row\s*\{[\s\S]*left:\s*calc\(100% - 144rpx\)/)
  assert.match(styles, /\.tdos-card\s*\{[\s\S]*right:\s*0/)
  assert.match(styles, /\.tdos-card\s*\{[\s\S]*width:\s*calc\(100vw - 182rpx\)/)
  assert.doesNotMatch(styles, /\.tdos-movable-row,[\s\S]*pointer-events:\s*none/)
})

test('organizer cards keep a fixed row height and clamp long summaries', () => {
  const styles = fs.readFileSync('src/components/TripDayOrganizerSheet/index.scss', 'utf8')
  assert.match(styles, /\.tdos-slot-row\s*\{[\s\S]*height:\s*116rpx/)
  assert.match(styles, /\.tdos-card\s*\{[\s\S]*height:\s*116rpx/)
  assert.match(styles, /\.tdos-summary\s*\{[\s\S]*display:\s*-webkit-box/)
  assert.match(styles, /\.tdos-summary\s*\{[\s\S]*-webkit-line-clamp:\s*2/)
})

test('organizer list uses a vertical ScrollView so the sheet can scroll in mini programs', () => {
  assert.match(source, /import \{[^}]*ScrollView[^}]*\} from '@tarojs\/components'/)
  assert.match(source, /<ScrollView\s+className='tdos-list'\s+scrollY=\{!dragState\}/)
  assert.match(source, /<\/ScrollView>/)
})

test('organizer sheet follows EditSpotSheet modal structure without parent catchMove blocking scroll', () => {
  const maskOpenTag = source.match(/<View\s+className=\{`tdos-mask[\s\S]*?>/)?.[0] || ''
  const sheetOpenTag = source.match(/<View\s+className='tdos-sheet'[\s\S]*?>/)?.[0] || ''
  assert.doesNotMatch(maskOpenTag, /catchMove/)
  assert.doesNotMatch(sheetOpenTag, /catchMove/)
})

test('organizer scroll view gets its viewport from a fixed bottom sheet like EditSpotSheet', () => {
  const styles = fs.readFileSync('src/components/TripDayOrganizerSheet/index.scss', 'utf8')
  assert.match(styles, /\.tdos-sheet\s*\{[^}]*position:\s*fixed/)
  assert.match(styles, /\.tdos-sheet\s*\{[^}]*height:\s*50vh/)
  assert.match(styles, /\.tdos-list\s*\{[^}]*flex:\s*1/)
  assert.match(styles, /\.tdos-list\s*\{[^}]*min-height:\s*200rpx/)
  assert.doesNotMatch(styles, /height:\s*calc\(86vh - 106rpx\)/)
  assert.doesNotMatch(styles, /height:\s*86vh/)
})

test('organizer card does not show per-card drag instruction copy', () => {
  assert.equal(source.includes('可拖拽移动'), false)
  assert.equal(source.includes('按住右侧把手拖动'), false)
})

test('delete action is represented by a trash icon', () => {
  const deleteBlock = source.match(/className='tdos-delete'[\s\S]*?<\/View>/)?.[0] || ''
  assert.match(deleteBlock, /tdos-trash-icon/)
  assert.doesNotMatch(deleteBlock, />删除</)
})

test('organizer controls use local CSS-drawn icons instead of the shared SVG mask Icon component', () => {
  assert.equal(source.includes("import Icon from '../Icon'"), false)
  assert.equal(source.includes('<Icon '), false)
  assert.match(source, /tdos-grip-icon/)
  assert.match(source, /tdos-trash-lid/)
  assert.match(source, /tdos-trash-can/)
})
