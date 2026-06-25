#!/usr/bin/env node
/**
 * 把唯一真源 cloudfunctions/_shared/ 同步复制到每个引用它的云函数目录下，
 * 供微信开发者工具 / CloudBase CLI 单独上传时打包（副本已在 .gitignore 忽略）。
 *
 * 用法：node cloudfunctions/sync-shared.js  （或 npm run cf:sync）
 *
 * 规则：遍历 cloudfunctions/ 下每个子目录，若其 index.js 出现 require('./_shared，
 * 则用真源覆盖该目录的 _shared/（先清空再复制，保证删除真源里已移除的文件）。
 */
const fs = require('fs')
const path = require('path')

const ROOT = __dirname
const SRC = path.join(ROOT, '_shared')

if (!fs.existsSync(SRC)) {
  console.error(`✗ 真源不存在: ${SRC}`)
  process.exit(1)
}

/** 递归复制目录 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

/** 该函数目录是否引用了 ./_shared */
function usesShared(fnDir) {
  const indexFile = path.join(fnDir, 'index.js')
  if (!fs.existsSync(indexFile)) return false
  return /require\(['"]\.\/_shared/.test(fs.readFileSync(indexFile, 'utf8'))
}

const dirs = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== '_shared')
  .map((e) => path.join(ROOT, e.name))

let count = 0
for (const fnDir of dirs) {
  if (!usesShared(fnDir)) continue
  const dest = path.join(fnDir, '_shared')
  fs.rmSync(dest, { recursive: true, force: true }) // 清空旧副本，删除真源中已移除的文件
  copyDir(SRC, dest)
  console.log(`✓ ${path.relative(ROOT, dest)}`)
  count++
}

console.log(`\n已同步 _shared 到 ${count} 个云函数目录。`)
