import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const textFiles = [
  'src/components/TripDateAdjustSheet/index.tsx',
  'src/components/TripDayOrganizerSheet/index.tsx',
]

const headerFiles = [
  'src/pages/trip/TripHeaderTegami.tsx',
  'src/pages/trip/TripHeaderMagazine.tsx',
  'src/pages/trip/TripHeaderPostcard.tsx',
  'src/pages/trip/TripHeaderMinimal.tsx',
]

function read(file) {
  return fs.readFileSync(file, 'utf8')
}

test('date adjustment sheets do not ship mojibake placeholder text', () => {
  for (const file of textFiles) {
    assert.equal(read(file).includes('????'), false, `${file} contains question-mark mojibake`)
  }
})

test('every trip header theme exposes the date adjustment action', () => {
  const sharedHeader = read('src/pages/trip/shared-header.ts')
  assert.match(sharedHeader, /onDateAdjustTap:\s*\(\)\s*=>\s*void/)

  for (const file of headerFiles) {
    const source = read(file)
    assert.match(source, /onClick=\{onDateAdjustTap\}/, `${file} does not render the date action`)
  }
})
