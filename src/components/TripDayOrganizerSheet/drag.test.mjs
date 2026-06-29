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
  const tmp = path.join(os.tmpdir(), `trip-day-drag-${Date.now()}-${Math.random().toString(16).slice(2)}.cjs`)
  fs.writeFileSync(tmp, compiled, 'utf8')
  const mod = new Module(tmp)
  mod.filename = tmp
  mod.paths = Module._nodeModulePaths(path.dirname(abs))
  mod._compile(compiled, tmp)
  fs.rmSync(tmp, { force: true })
  return mod.exports
}

const {
  ORGANIZER_ROW_STEP_RPX,
  clampDragOffset,
  dragTargetIndex,
  organizerRowStepPx,
} = loadTsModule('./src/components/TripDayOrganizerSheet/drag.ts')

test('organizerRowStepPx converts the visual row plus gap from rpx to touch-event px', () => {
  assert.equal(ORGANIZER_ROW_STEP_RPX, 134)
  assert.equal(organizerRowStepPx(375), 67)
})

test('clampDragOffset keeps the dragged card inside the visible list bounds', () => {
  const rowStep = organizerRowStepPx(375)

  assert.equal(clampDragOffset(-200, rowStep, 1, 4), -67)
  assert.equal(clampDragOffset(260, rowStep, 1, 4), 134)
  assert.equal(clampDragOffset(24, rowStep, 1, 4), 24)
})

test('dragTargetIndex computes the destination slot from the current finger offset', () => {
  const rowStep = organizerRowStepPx(375)

  assert.equal(dragTargetIndex(2, 20, rowStep, 5), 2)
  assert.equal(dragTargetIndex(2, 70, rowStep, 5), 3)
  assert.equal(dragTargetIndex(2, -70, rowStep, 5), 1)
  assert.equal(dragTargetIndex(4, 200, rowStep, 5), 4)
})
