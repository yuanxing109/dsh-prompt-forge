#!/usr/bin/env node
/**
 * 生成 package-manifest.json：记录包内插件的全部文件、大小与 SHA-256。
 * 用法: node tools/build-manifest.mjs [--root <包根目录>]
 * verify.ps1 / install.ps1 用它做完整性校验。
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const rootFlag = argv.indexOf('--root')
const root = rootFlag >= 0 ? resolve(argv[rootFlag + 1]) : resolve(here, '..')
const pluginDir = join(root, 'plugin', 'dsh-prompt-forge')

if (!existsSync(join(pluginDir, 'package.json'))) {
  console.error('plugin/dsh-prompt-forge/package.json not found under ' + root)
  process.exit(2)
}

const pkg = JSON.parse(readFileSync(join(pluginDir, 'package.json'), 'utf8'))
const skipDirs = new Set(['node_modules', '.git'])
const files = []
let totalBytes = 0

const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) { if (!skipDirs.has(entry.name)) walk(full); continue }
    if (!entry.isFile()) continue
    const buf = readFileSync(full)
    const rel = relative(pluginDir, full).split('\\').join('/')
    files.push({ path: rel, size: buf.length, sha256: createHash('sha256').update(buf).digest('hex') })
    totalBytes += buf.length
  }
}
walk(pluginDir)
files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

const manifest = {
  name: pkg.name,
  version: pkg.version,
  generatedAt: new Date().toISOString(),
  engines: pkg.engines || null,
  dshEngines: (pkg.dsh && pkg.dsh.engines) || null,
  bundlePatch: (pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch) || null,
  fileCount: files.length,
  totalBytes,
  files,
}
writeFileSync(join(root, 'package-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log('package-manifest.json written: ' + files.length + ' files, ' + totalBytes + ' bytes, version ' + pkg.version)
