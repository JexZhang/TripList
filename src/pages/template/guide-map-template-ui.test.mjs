import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const types = fs.readFileSync('src/types/template.ts', 'utf8')
const templatesUtil = fs.readFileSync('src/utils/templates.ts', 'utf8')
const featured = fs.readFileSync('src/pages/home/HomeFeaturedRow.tsx', 'utf8')
const templatePage = fs.readFileSync('src/pages/template/index.tsx', 'utf8')
const cloneTemplate = fs.readFileSync('cloudfunctions/clone-template/index.js', 'utf8')

test('template data exposes guideMapUrl to card and detail views', () => {
  assert.match(types, /guideMapUrl\?:\s*string\s*\|\s*null/)
  assert.match(templatesUtil, /guideMapUrl:\s*true/)
})

test('featured template card uses the guide map as cover when available', () => {
  assert.match(featured, /import \{[^}]*Image[^}]*\} from '@tarojs\/components'/)
  assert.match(featured, /c\.guideMapUrl\s*\?/)
  assert.match(featured, /className='hf-cover hf-cover--has-guide'/)
  assert.match(featured, /<Image[\s\S]*src=\{c\.guideMapUrl\}/)
  assert.match(featured, /hf-guide-badge/)
})

test('template detail shows guide map as a template asset before tabs', () => {
  assert.match(templatePage, /import \{[^}]*Image[^}]*\} from '@tarojs\/components'/)
  assert.match(templatePage, /tpl\.guideMapUrl\s*&&/)
  assert.match(templatePage, /className='tpl-guide-cover'/)
  assert.match(templatePage, /<Image[\s\S]*src=\{tpl\.guideMapUrl\}/)
  assert.match(templatePage, /精选导览图/)
})

test('clone-template treats guideMapUrl as template metadata', () => {
  assert.match(cloneTemplate, /guideMapUrl:\s*_guideMapUrl/)
})
