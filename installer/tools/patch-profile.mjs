#!/usr/bin/env node
/**
 * dsh-prompt-forge 离线包 —— profile 清单修补器
 *
 * 用法:
 *   node patch-profile.mjs status --profile <profile 目录>
 *   node patch-profile.mjs add    --profile <profile 目录>
 *   node patch-profile.mjs remove --profile <profile 目录>
 *
 * add    : 备份 package.json / pnpm-lock.yaml，写入 "file:./vendor/dsh-prompt-forge" 依赖 + bundles 条目
 * remove : 有备份则整体还原安装前清单，无备份则剥离依赖与 bundles 条目
 * status : 输出当前依赖写法、bundle 条目数与备份是否存在
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const NAME = 'dsh-prompt-forge'
const SPEC = 'file:./vendor/dsh-prompt-forge'
const BAK_PKG = 'package.json.pre-prompt-forge-pack'
const BAK_LOCK = 'pnpm-lock.yaml.pre-prompt-forge-pack'

const argv = process.argv.slice(2)
const action = String(argv[0] || '')
const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined }
const profile = flag('--profile')

const emit = (obj) => console.log(JSON.stringify(obj, null, 2))
const fail = (msg) => { emit({ ok: false, error: msg }); process.exit(2) }

if (!['add', 'remove', 'status'].includes(action)) fail('action must be one of: add | remove | status')
if (!profile) fail('--profile <profile directory> is required')

const pkgPath = join(profile, 'package.json')
if (!existsSync(pkgPath)) fail('package.json not found in profile: ' + pkgPath)

let pkg
try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) } catch (e) { fail('profile package.json is not valid JSON: ' + e.message) }

const bundles = pkg && pkg.dsh && pkg.dsh.profile && pkg.dsh.profile.bundles
const hasBundles = Array.isArray(bundles)

const dedupe = (arr) => { const out = []; for (const v of arr) { if (typeof v === 'string' && !out.includes(v)) out.push(v) } return out }

if (action === 'status') {
  emit({
    ok: true,
    profile,
    dependency: (pkg.dependencies && pkg.dependencies[NAME]) || null,
    bundleEntries: hasBundles ? bundles.filter((b) => b === NAME).length : null,
    backup: existsSync(join(profile, BAK_PKG)),
  })
  process.exit(0)
}

if (!hasBundles) fail('profile manifest has no dsh.profile.bundles — DSH profile not initialized')

if (action === 'add') {
  const bakPkg = join(profile, BAK_PKG)
  let backupCreated = false
  if (!existsSync(bakPkg)) { copyFileSync(pkgPath, bakPkg); backupCreated = true }
  const lockPath = join(profile, 'pnpm-lock.yaml')
  const bakLock = join(profile, BAK_LOCK)
  if (existsSync(lockPath) && !existsSync(bakLock)) copyFileSync(lockPath, bakLock)

  if (!pkg.dependencies) pkg.dependencies = {}
  pkg.dependencies[NAME] = SPEC
  pkg.dsh.profile.bundles = dedupe(bundles)
  if (!pkg.dsh.profile.bundles.includes(NAME)) pkg.dsh.profile.bundles.push(NAME)

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  emit({ ok: true, action: 'add', profile, dependency: SPEC, bundleEntries: pkg.dsh.profile.bundles.filter((b) => b === NAME).length, backup: backupCreated ? BAK_PKG : 'kept-existing' })
  process.exit(0)
}

// remove
const bakPkg = join(profile, BAK_PKG)
const bakLock = join(profile, BAK_LOCK)
if (existsSync(bakPkg)) {
  copyFileSync(bakPkg, pkgPath)
  if (existsSync(bakLock)) copyFileSync(bakLock, join(profile, 'pnpm-lock.yaml'))
  unlinkSync(bakPkg)
  if (existsSync(bakLock)) unlinkSync(bakLock)
  const restored = JSON.parse(readFileSync(pkgPath, 'utf8'))
  emit({ ok: true, action: 'remove', mode: 'restored', profile, dependency: (restored.dependencies && restored.dependencies[NAME]) || null, bundleEntries: restored.dsh.profile.bundles.filter((b) => b === NAME).length })
  process.exit(0)
}

if (pkg.dependencies && Object.prototype.hasOwnProperty.call(pkg.dependencies, NAME)) delete pkg.dependencies[NAME]
pkg.dsh.profile.bundles = dedupe(pkg.dsh.profile.bundles).filter((b) => b !== NAME)
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
emit({ ok: true, action: 'remove', mode: 'stripped', profile, dependency: null, bundleEntries: 0 })
process.exit(0)
