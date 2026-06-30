import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const read = (file) => fs.readFileSync(file, 'utf8')

test('spot editing sheet carries the active theme into its root portal mask', () => {
  const source = read('src/components/EditSpotSheet/index.tsx')

  assert.match(source, /import \{ useTheme \} from '\.\.\/\.\.\/store\/theme-store'/)
  assert.match(source, /const \{ theme \} = useTheme\(\)/)
  assert.match(source, /className=\{`edit-spot-mask theme-tokens theme-\$\{theme\}`\}/)
})

test('spot search sheet carries the active theme into its root portal mask', () => {
  const source = read('src/components/SpotSearch/index.tsx')

  assert.match(source, /import \{ useTheme \} from '\.\.\/\.\.\/store\/theme-store'/)
  assert.match(source, /const \{ theme \} = useTheme\(\)/)
  assert.match(source, /className=\{`spot-search-mask theme-tokens theme-\$\{theme\}`\}/)
})
