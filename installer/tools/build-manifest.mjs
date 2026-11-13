#!/usr/bin/env node
/**
 * 生成 installer/package-manifest.json：记录插件包（仓库根）的全部文件、大小与 SHA-256。
 * 用法: node installer/tools/build-manifest.mjs [--root <仓库根目录>]
 * installer/verify.ps1 / install.ps1 用它做完整性校验。
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const rootFlag = argv.indexOf('--root')
// installer/tools/ -> installer/ -> 仓库根
const root = rootFlag >= 0 ? resolve(argv[rootFlag + 1]) : resolve(here, '..', '..')

if (!existsSync(join(root, 'package.json'))) {
  console.error('package.json not found under ' + root)
  process.exit(2)
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
// 安装器本身、版本库元数据与依赖目录都不属于插件载荷
const skipDirs = new Set(['node_modules', '.git', '.github', 'installer', 'dist'])

const files = []
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue
      walk(full)
      continue
    }
    if (!entry.isFile()) continue
    const rel = relative(root, full).split('\\').join('/')
    const buf = readFileSync(full)
    files.push({ path: rel, size: buf.length, sha256: createHash('sha256').update(buf).digest('hex') })
  }
}
walk(root)
files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

const manifest = {
  name: pkg.name,
  version: pkg.version,
  generatedAt: new Date().toISOString(),
  engines: pkg.engines ?? null,
  dshEngines: pkg.dsh?.engines ?? null,
  bundlePatch: pkg.dsh?.bundle?.patch ?? null,
  fileCount: files.length,
  totalBytes: files.reduce((sum, f) => sum + f.size, 0),
  files,
}
const out = join(here, '..', 'package-manifest.json')
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
console.log('wrote ' + out + ' (' + manifest.fileCount + ' files, ' + manifest.totalBytes + ' bytes, v' + manifest.version + ')')
