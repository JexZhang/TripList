import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDaysISO, isValidISODate, rebaseTemplateDates } from './rebase.js'

test('addDaysISO 顺延并跨月', () => {
  assert.equal(addDaysISO('2026-06-16', 0), '2026-06-16')
  assert.equal(addDaysISO('2026-06-16', 2), '2026-06-18')
  assert.equal(addDaysISO('2026-06-30', 1), '2026-07-01')
})

test('isValidISODate 校验格式与合法性', () => {
  assert.equal(isValidISODate('2026-06-16'), true)
  assert.equal(isValidISODate('2026-6-16'), false)
  assert.equal(isValidISODate('2026-13-01'), false)
  assert.equal(isValidISODate('abc'), false)
  assert.equal(isValidISODate(''), false)
})

test('rebaseTemplateDates 按序号顺延 + 清空天气 + 顺延 endDate', () => {
  const days = [
    { id: 'a', date: '2000-01-01', weather: { desc: '晴' }, spots: [] },
    { id: 'b', date: '2000-01-02', weather: { desc: '雨' }, spots: [] },
    { id: 'c', date: '2000-01-03', weather: null, spots: [] },
  ]
  const r = rebaseTemplateDates(days, '2026-06-16')
  assert.deepEqual(r.days.map((d) => d.date), ['2026-06-16', '2026-06-17', '2026-06-18'])
  assert.deepEqual(r.days.map((d) => d.weather), [null, null, null])
  assert.equal(r.startDate, '2026-06-16')
  assert.equal(r.endDate, '2026-06-18')
  assert.equal(days[0].date, '2000-01-01')
})

test('rebaseTemplateDates 空 days 时 endDate 回落 startDate', () => {
  const r = rebaseTemplateDates([], '2026-06-16')
  assert.deepEqual(r.days, [])
  assert.equal(r.startDate, '2026-06-16')
  assert.equal(r.endDate, '2026-06-16')
})
