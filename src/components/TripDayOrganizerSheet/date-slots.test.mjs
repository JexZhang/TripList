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
    },
  }).outputText
  const tmp = path.join(os.tmpdir(), `trip-day-slots-${Date.now()}-${Math.random().toString(16).slice(2)}.cjs`)
  fs.writeFileSync(tmp, compiled, 'utf8')
  const mod = new Module(tmp)
  mod.filename = tmp
  mod.paths = Module._nodeModulePaths(path.dirname(abs))
  mod._compile(compiled, tmp)
  fs.rmSync(tmp, { force: true })
  return mod.exports
}

const { buildOrganizerDateSlots } = loadTsModule('./src/components/TripDayOrganizerSheet/date-slots.ts')

test('buildOrganizerDateSlots derives continuous fixed date slots from the start date and remaining count', () => {
  assert.deepEqual(
    buildOrganizerDateSlots('2026-07-24', 3),
    [
      { key: 'slot-0', date: '2026-07-24' },
      { key: 'slot-1', date: '2026-07-25' },
      { key: 'slot-2', date: '2026-07-26' },
    ],
  )
})

test('buildOrganizerDateSlots returns no slots when every day would be removed', () => {
  assert.deepEqual(buildOrganizerDateSlots('2026-07-24', 0), [])
})
