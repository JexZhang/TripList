import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('src/components/TripDayOrganizerSheet/index.tsx', 'utf8')

test('dragging starts only from the explicit drag handle', () => {
  const handleBlock = source.match(/className='tdos-drag-handle'[\s\S]*?onTouchCancel=\{endDrag\}/)?.[0] || ''
  assert.match(handleBlock, /onTouchStart=\{\(e\) => startDrag\(e, index\)\}/)
  assert.match(handleBlock, /onTouchMove=\{moveDrag\}/)
  assert.match(handleBlock, /onTouchEnd=\{endDrag\}/)

  const cardOpenTag = source.match(/<View\s+className=\{`tdos-card[\s\S]*?>/)?.[0] || ''
  assert.equal(cardOpenTag.includes('onTouchStart'), false)
  assert.equal(cardOpenTag.includes('onTouchMove'), false)
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
