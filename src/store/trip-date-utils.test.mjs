import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Module from 'node:module'
import ts from 'typescript'

function loadTsModule(file) {
  const abs = path.resolve(file)
  const source = fs.readFileSync(abs, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText
  const tmp = path.join(os.tmpdir(), `trip-date-utils-${Date.now()}-${Math.random().toString(16).slice(2)}.cjs`)
  fs.writeFileSync(tmp, compiled, 'utf8')
  const mod = new Module(tmp)
  mod.filename = tmp
  mod.paths = Module._nodeModulePaths(path.dirname(abs))
  mod._compile(compiled, tmp)
  fs.rmSync(tmp, { force: true })
  return mod.exports
}

const {
  rebaseTripDates,
  reorderTripDays,
  deleteTripDay,
  applyOrganizedTripDays,
  syncContinuousDays,
} = loadTsModule('./src/store/trip-date-utils.ts')

function makeTrip() {
  return {
    _id: 'trip-1',
    _openid: 'owner',
    ownerOpenid: 'owner',
    name: '京都',
    pax: 2,
    startDate: '2026-06-30',
    endDate: '2026-07-02',
    destinations: [],
    collaborators: [],
    packing: [],
    createdAt: 1,
    updatedAt: 1,
    updatedBy: 'owner',
    days: [
      { id: 'd1', date: '2026-06-30', spots: [{ id: 's1', type: 'spot', name: '伏见稻荷' }], weather: { city: '京都', cityAdcode: '1', high: 30, low: 20, desc: '晴', icon: 'sun', fetchedAt: 1 } },
      { id: 'd2', date: '2026-07-01', spots: [{ id: 's2', type: 'spot', name: '清水寺' }], weather: { city: '京都', cityAdcode: '1', high: 31, low: 21, desc: '阴', icon: 'cloud', fetchedAt: 2 } },
      { id: 'd3', date: '2026-07-02', spots: [], weather: null },
    ],
  }
}

test('rebaseTripDates keeps day content and count while shifting continuous dates and clearing weather', () => {
  const trip = makeTrip()

  const next = rebaseTripDates(trip, '2026-07-10')

  assert.deepEqual(next.days.map((d) => d.date), ['2026-07-10', '2026-07-11', '2026-07-12'])
  assert.equal(next.startDate, '2026-07-10')
  assert.equal(next.endDate, '2026-07-12')
  assert.deepEqual(next.days.map((d) => d.id), ['d1', 'd2', 'd3'])
  assert.deepEqual(next.days.map((d) => d.spots.map((s) => s.name)), [['伏见稻荷'], ['清水寺'], []])
  assert.deepEqual(next.days.map((d) => d.weather), [null, null, null])
})

test('reorderTripDays moves content into fixed date slots and keeps start date unchanged', () => {
  const trip = makeTrip()

  const next = reorderTripDays(trip, ['d3', 'd1', 'd2'])

  assert.deepEqual(next.days.map((d) => d.id), ['d3', 'd1', 'd2'])
  assert.deepEqual(next.days.map((d) => d.date), ['2026-06-30', '2026-07-01', '2026-07-02'])
  assert.equal(next.startDate, '2026-06-30')
  assert.equal(next.endDate, '2026-07-02')
  assert.deepEqual(next.days.map((d) => d.weather), [null, null, null])
})

test('deleteTripDay removes a day, preserves a continuous range, and refuses to delete the last day', () => {
  const trip = makeTrip()

  const next = deleteTripDay(trip, 'd2')

  assert.deepEqual(next.days.map((d) => d.id), ['d1', 'd3'])
  assert.deepEqual(next.days.map((d) => d.date), ['2026-06-30', '2026-07-01'])
  assert.equal(next.startDate, '2026-06-30')
  assert.equal(next.endDate, '2026-07-01')
  assert.throws(() => deleteTripDay({ ...trip, days: [trip.days[0]] }, 'd1'), /at least one day/i)
})


test('applyOrganizedTripDays commits the organized remaining day ids without restoring deleted days', () => {
  const trip = makeTrip()

  const next = applyOrganizedTripDays(trip, ['d3', 'd1'])

  assert.deepEqual(next.days.map((d) => d.id), ['d3', 'd1'])
  assert.deepEqual(next.days.map((d) => d.date), ['2026-06-30', '2026-07-01'])
  assert.equal(next.startDate, '2026-06-30')
  assert.equal(next.endDate, '2026-07-01')
  assert.throws(() => applyOrganizedTripDays(trip, []), /at least one day/i)
})


test('syncContinuousDays can preserve existing weather for non-date-adjustment edits', () => {
  const trip = makeTrip()
  const next = syncContinuousDays(trip, [...trip.days, { id: 'd4', date: '2026-07-03', spots: [], weather: null }], undefined, { clearWeather: false })

  assert.ok(next.days[0].weather)
  assert.ok(next.days[1].weather)
  assert.equal(next.days[3].date, '2026-07-03')
})
