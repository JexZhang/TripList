import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const component = fs.readFileSync('src/views/ItineraryView/SpotCard.tsx', 'utf8')
const styles = fs.readFileSync('src/views/ItineraryView/index.scss', 'utf8')

function blockAfter(source, marker) {
  const start = source.indexOf(marker)
  if (start < 0) return ''
  return source.slice(start, start + 500)
}

test('spot price is rendered in the card header after the spot name', () => {
  const headBlock = blockAfter(component, "className='sc-head'")
  assert.match(headBlock, /className='sc-title-line'/)
  assert.match(headBlock, /className='sc-name'/)
  assert.match(headBlock, /className='sc-price'/)
  assert.ok(headBlock.indexOf("className='sc-name'") < headBlock.indexOf("className='sc-price'"))
})

test('spot foot only renders notes and does not control price placement', () => {
  const footBlock = blockAfter(component, "className='sc-foot'")
  assert.match(footBlock, /className='sc-note'/)
  assert.doesNotMatch(footBlock, /className='sc-price'/)
})

test('spot price stays at the right edge of the header', () => {
  assert.match(styles, /\.sc-title-line\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/)
  assert.match(styles, /\.sc-name\s*\{[^}]*min-width:\s*0/)
  assert.match(styles, /\.sc-price\s*\{[^}]*justify-self:\s*end/)
})

test('long spot names can wrap without overlapping the price', () => {
  assert.match(styles, /\.sc-name\s*\{[^}]*white-space:\s*normal/)
  assert.match(styles, /\.sc-name\s*\{[^}]*word-break:\s*break-all/)
  assert.match(styles, /\.sc-price\s*\{[^}]*white-space:\s*nowrap/)
})

test('spot title and price align with the icon and time on the first row', () => {
  assert.match(styles, /\.sc-title-line\s*\{[^}]*min-height:\s*56rpx/)
  assert.match(styles, /\.sc-title-line\s*\{[^}]*align-items:\s*center/)
  assert.match(styles, /\.sc-price\s*\{[^}]*align-self:\s*center/)
})
