#requires -Version 5.1
<#
.SYNOPSIS
  dsh-prompt-forge 离线包安装/卸载结果校验器
.DESCRIPTION
  -Mode install   校验 vendor 目录、profile 清单、node_modules 接线、文件哈希
  -Mode uninstall 校验 vendor 已清理、清单不再指向 vendor、接线已移除
  输出 PASS / WARN / FAIL 明细，FAIL 时退出码 1。末尾附手工 GUI 验证清单。
.PARAMETER Mode
  install 或 uninstall。
.PARAMETER Profile
  profile 名称，默认自动探测（优先 desktop）。
.PARAMETER DshHome
  DSH 用户目录，默认 %USERPROFILE%\.dsh（或 DSH_HOME）。
.PARAMETER DshRoot
  DSH 安装根目录，默认注册表/常见路径/探测。
.PARAMETER SkipHash
  跳过大体积文件哈希比对。
.PARAMETER NoPause
  结束时不等待回车。
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File verify.ps1 -Mode install
#>
[CmdletBinding()]
param(
  [ValidateSet('install', 'uninstall')][string]$Mode = 'install',
  [string]$Profile = '',
  [string]$DshHome = '',
  [string]$DshRoot = '',
  [switch]$SkipHash,
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$packageRoot = $PSScriptRoot
$manifestFile = Join-Path $packageRoot 'package-manifest.json'
$results = New-Object System.Collections.Generic.List[object]

function Add-Result([string]$name, [string]$status, [string]$detail) {
  $results.Add([pscustomobject]@{ Name = $name; Status = $status; Detail = $detail })
}
function Write-Section([string]$text) { Write-Host ''; Write-Host ('==> ' + $text) -ForegroundColor Cyan }
function Get-Processes { @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq 'DeepSeek Harness' }) }

function Get-RuntimeFile([string]$root, [string]$relative) {
  if (-not $root) { return $null }
  foreach ($base in @('resources\runtime\', 'resources\app\runtime\')) {
    $candidate = Join-Path $root ($base + $relative)
    if (Test-Path $candidate) { return $candidate }
  }
  return $null
}

function Get-DshRootFromRegistry {
  $keys = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
  )
  foreach ($key in $keys) {
    foreach ($item in (Get-ChildItem -Path $key -ErrorAction SilentlyContinue)) {
      $props = Get-ItemProperty -Path $item.PSPath -ErrorAction SilentlyContinue
      if (-not $props -or -not $props.DisplayName) { continue }
      if ($props.DisplayName -notlike '*DeepSeek Harness*') { continue }
      if ($props.InstallLocation -and (Test-Path $props.InstallLocation)) { return $props.InstallLocation }
    }
  }
  return $null
}

function Resolve-DshRoot {
  if ($DshRoot) { if (Test-Path (Join-Path $DshRoot 'resources')) { return $DshRoot } }
  $candidates = New-Object System.Collections.Generic.List[string]
  if ($env:DSH_INSTALL_ROOT) { $candidates.Add($env:DSH_INSTALL_ROOT) }
  $reg = Get-DshRootFromRegistry
  if ($reg) { $candidates.Add($reg) }
  $proc = Get-Processes | Select-Object -First 1
  if ($proc) { try { if ($proc.Path) { $candidates.Add((Split-Path -Parent $proc.Path)) } } catch { } }
  if ($env:LOCALAPPDATA) { $candidates.Add((Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness')) }
  if ($env:ProgramFiles) { $candidates.Add((Join-Path $env:ProgramFiles 'DeepSeek Harness')) }
  foreach ($candidate in $candidates) { if ($candidate -and (Test-Path (Join-Path $candidate 'resources'))) { return $candidate } }
  return $null
}

function Resolve-Profile {
  if (-not $DshHome) { if ($env:DSH_HOME) { $DshHome = $env:DSH_HOME } else { $DshHome = Join-Path $env:USERPROFILE '.dsh' } }
  $profilesRoot = Join-Path $DshHome 'profiles'
  if (-not (Test-Path $profilesRoot)) { return $null }
  if ($Profile) {
    $dir = Join-Path $profilesRoot $Profile
    if (Test-Path (Join-Path $dir 'package.json')) { return @{ Dir = $dir; Name = $Profile } }
    return $null
  }
  $dirs = @(Get-ChildItem $profilesRoot -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName 'package.json') })
  if ($dirs.Count -eq 0) { return $null }
  $desktop = $dirs | Where-Object { $_.Name -eq 'desktop' } | Select-Object -First 1
  if ($desktop) { return @{ Dir = $desktop.FullName; Name = $desktop.Name } }
  if ($dirs.Count -eq 1) { return @{ Dir = $dirs[0].FullName; Name = $dirs[0].Name } }
  return $null
}

function Get-BundleEntryCount([string]$text) {
  $match = [regex]::Match($text, '"bundles"\s*:\s*\[(?<inner>[\s\S]*?)\]')
  if (-not $match.Success) { return -1 }
  return ([regex]::Matches($match.Groups['inner'].Value, '"dsh-prompt-forge"')).Count
}

function Get-DependencySpec([string]$text) {
  $match = [regex]::Match($text, '"dsh-prompt-forge"\s*:\s*"(?<spec>[^"]*)"')
  if (-not $match.Success) { return $null }
  return $match.Groups['spec'].Value
}

Write-Host ''
Write-Host '=========================================' -ForegroundColor White
Write-Host (' dsh-prompt-forge 校验器 [' + $Mode + ']') -ForegroundColor White
Write-Host '=========================================' -ForegroundColor White

$manifest = $null
$expectedVersion = $null
if (Test-Path $manifestFile) {
  $manifest = Get-Content $manifestFile -Raw | ConvertFrom-Json
  $expectedVersion = [string]$manifest.version
}

$dshRoot = Resolve-DshRoot
$profileInfo = Resolve-Profile
if (-not $profileInfo) { Add-Result 'profile 定位' 'FAIL' '未找到已初始化的 profile（检查 DSH 用户目录与 -Profile）' }
$profileDir = $null
if ($profileInfo) {
  $profileDir = $profileInfo.Dir
  Add-Result 'profile 定位' 'PASS' ($profileInfo.Name + ' -> ' + $profileDir)
}

$nodeExe = $null
if ($dshRoot) { $nodeExe = Get-RuntimeFile $dshRoot 'primary-runtime\dependencies\node\bin\node.exe' }
if (-not $nodeExe) { $cmd = Get-Command node -ErrorAction SilentlyContinue; if ($cmd) { $nodeExe = $cmd.Source } }

$pkgPath = $null
$pkgText = $null
$depSpec = $null
$bundleCount = -1
if ($profileDir) {
  $pkgPath = Join-Path $profileDir 'package.json'
  try { $pkgText = Get-Content $pkgPath -Raw } catch { }
  if ($pkgText) {
    $depSpec = Get-DependencySpec $pkgText
    $bundleCount = Get-BundleEntryCount $pkgText
  }
}

$vendorDir = $null
$vendorPkg = $null
$vendorVersion = $null
$linkPath = $null
$linkPkg = $null
if ($profileDir) {
  $vendorDir = Join-Path $profileDir 'vendor\dsh-prompt-forge'
  $vendorPkg = Join-Path $vendorDir 'package.json'
  if (Test-Path $vendorPkg) { try { $vendorVersion = [string](Get-Content $vendorPkg -Raw | ConvertFrom-Json).version } catch { } }
  $linkPath = Join-Path $profileDir 'node_modules\dsh-prompt-forge\package.json'
  if (Test-Path $linkPath) { $linkPkg = $linkPath }
}

if ($Mode -eq 'install') {
  Write-Section 'A. profile 清单'
  if ($depSpec -eq 'file:./vendor/dsh-prompt-forge') { Add-Result '依赖写法' 'PASS' 'file:./vendor/dsh-prompt-forge' }
  elseif ($null -eq $depSpec) { Add-Result '依赖写法' 'FAIL' 'package.json 中没有 dsh-prompt-forge 依赖' }
  else { Add-Result '依赖写法' 'FAIL' ('期望 file:./vendor/dsh-prompt-forge，实际 ' + $depSpec) }

  if ($bundleCount -eq 1) { Add-Result 'bundle 注册' 'PASS' 'dsh.profile.bundles 中恰好 1 条' }
  elseif ($bundleCount -le 0) { Add-Result 'bundle 注册' 'FAIL' 'dsh.profile.bundles 中缺少 dsh-prompt-forge' }
  else { Add-Result 'bundle 注册' 'WARN' ('dsh.profile.bundles 中出现 ' + $bundleCount + ' 条重复条目') }

  Write-Section 'B. vendor 目录'
  $required = @('package.json', 'cordis.patch.yml', 'lib\index.js', 'lib\client.js')
  $missing = @()
  foreach ($rel in $required) { if (-not (Test-Path (Join-Path $vendorDir $rel))) { $missing += $rel } }
  if ($missing.Count -eq 0) { Add-Result '必要文件' 'PASS' '4 个关键文件齐全' } else { Add-Result '必要文件' 'FAIL' ('缺失: ' + ($missing -join ', ')) }
  if ($vendorVersion -and $expectedVersion -and $vendorVersion -eq $expectedVersion) { Add-Result 'vendor 版本' 'PASS' $vendorVersion }
  elseif (-not $vendorVersion) { Add-Result 'vendor 版本' 'FAIL' '读取不到 vendor/package.json 的版本' }
  else { Add-Result 'vendor 版本' 'WARN' ('vendor ' + $vendorVersion + ' vs 包 ' + $expectedVersion) }

  if (-not $SkipHash -and $manifest -and (Test-Path $vendorDir)) {
    $bad = @()
    foreach ($entry in $manifest.files) {
      $target = Join-Path $vendorDir $entry.path
      if (-not (Test-Path $target)) { $bad += $entry.path; continue }
      if ((Get-FileHash -Path $target -Algorithm SHA256).Hash.ToLower() -ne $entry.sha256) { $bad += $entry.path }
    }
    if ($bad.Count -eq 0) { Add-Result '文件哈希' 'PASS' ($manifest.fileCount.ToString() + ' 个文件与包一致') }
    else { Add-Result '文件哈希' 'FAIL' ('不一致 ' + $bad.Count + ' 个: ' + (($bad | Select-Object -First 5) -join ', ')) }
  }

  Write-Section 'C. node_modules 接线'
  if ($linkPkg) {
    $linkVer = $null
    try { $linkVer = [string](Get-Content $linkPkg -Raw | ConvertFrom-Json).version } catch { }
    $vendorHash = $null; $linkHash = $null
    if (Test-Path $vendorPkg) { $vendorHash = (Get-FileHash $vendorPkg -Algorithm SHA256).Hash }
    $linkHash = (Get-FileHash $linkPkg -Algorithm SHA256).Hash
    if ($vendorHash -and $linkHash -eq $vendorHash) { Add-Result 'node_modules 解析' 'PASS' ('package.json 与 vendor 完全一致（版本 ' + $linkVer + '），是同一份文件') }
    elseif ($expectedVersion -and $linkVer -eq $expectedVersion) { Add-Result 'node_modules 解析' 'WARN' ('版本一致但 package.json 非同一文件（可能是复制安装），版本 ' + $linkVer) }
    else { Add-Result 'node_modules 解析' 'FAIL' ('解析到版本 ' + $linkVer + '，包内为 ' + $expectedVersion) }
  } else { Add-Result 'node_modules 解析' 'FAIL' 'node_modules\dsh-prompt-forge\package.json 不存在' }

  $lock = Join-Path $profileDir 'pnpm-lock.yaml'
  if (Test-Path $lock) {
    $lockText = Get-Content $lock -Raw
    if ($lockText -like '*vendor/dsh-prompt-forge*') { Add-Result 'lockfile' 'PASS' 'pnpm-lock.yaml 已记录 vendor 依赖' }
    else { Add-Result 'lockfile' 'WARN' 'pnpm-lock.yaml 未记录 vendor（junction 模式可忽略；建议联网跑一次 pnpm install）' }
  } else { Add-Result 'lockfile' 'WARN' 'profile 下没有 pnpm-lock.yaml' }

  if ((Get-Processes).Count -gt 0) { Add-Result '进程状态' 'WARN' 'DSH 正在运行：改动要重启后才生效' }
  else { Add-Result '进程状态' 'PASS' 'DSH 未运行，重启后即加载新插件' }
}
else {
  Write-Section 'A. profile 清单'
  if ($null -eq $depSpec) { Add-Result '依赖清理' 'PASS' 'package.json 中已无 dsh-prompt-forge 依赖' }
  elseif ($depSpec -notlike 'file:./vendor/*') { Add-Result '依赖清理' 'PASS' ('已还原为安装前写法: ' + $depSpec) }
  else { Add-Result '依赖清理' 'FAIL' ('仍指向 vendor: ' + $depSpec) }

  if ((Test-Path $linkPath)) {
    if ($bundleCount -eq 1) { Add-Result 'bundle 注册' 'PASS' '保留 1 条（对应已还原的常规安装）' }
    elseif ($bundleCount -gt 1) { Add-Result 'bundle 注册' 'WARN' ('bundles 中出现 ' + $bundleCount + ' 条重复条目') }
    else { Add-Result 'bundle 注册' 'FAIL' 'node_modules 仍有插件但 bundles 条目被删除' }
  }
  else {
    if ($bundleCount -le 0) { Add-Result 'bundle 注册' 'PASS' 'bundle 条目已移除' }
    else { Add-Result 'bundle 注册' 'FAIL' ('node_modules 已无插件但 bundles 仍有 ' + $bundleCount + ' 条条目') }
  }

  Write-Section 'B. vendor 与接线清理'
  if (-not (Test-Path $vendorDir)) { Add-Result 'vendor 目录' 'PASS' '已删除' } else { Add-Result 'vendor 目录' 'FAIL' ('仍存在: ' + $vendorDir) }
  if (-not (Test-Path $linkPath)) { Add-Result 'node_modules 条目' 'PASS' '已无解析条目' }
  else { Add-Result 'node_modules 条目' 'PASS' '存在常规安装（允许，代表还原到安装前状态）' }

  $lock = Join-Path $profileDir 'pnpm-lock.yaml'
  if (Test-Path $lock) {
    $lockText = Get-Content $lock -Raw
    if ($lockText -like '*vendor/dsh-prompt-forge*') { Add-Result 'lockfile' 'WARN' 'pnpm-lock.yaml 仍含 vendor 记录（联网跑一次 pnpm install 即可清除）' }
    else { Add-Result 'lockfile' 'PASS' 'lockfile 无 vendor 记录' }
  }

  if ((Get-Processes).Count -gt 0) { Add-Result '进程状态' 'WARN' 'DSH 正在运行：重启后才能确认按钮消失' }
  else { Add-Result '进程状态' 'PASS' 'DSH 未运行' }
}

Write-Section '结果'
$fails = 0
$warns = 0
foreach ($r in $results) {
  $color = 'Green'
  if ($r.Status -eq 'FAIL') { $color = 'Red'; $fails++ }
  elseif ($r.Status -eq 'WARN') { $color = 'Yellow'; $warns++ }
  Write-Host ('  ' + $r.Status.PadRight(4) + ' | ' + $r.Name.PadRight(16) + ' | ' + $r.Detail) -ForegroundColor $color
}

Write-Section '手工 GUI 验证清单'
if ($Mode -eq 'install') {
  Write-Host '  1) 完全退出 DSH（含托盘）后重新启动，新开一个会话。'
  Write-Host '  2) 输入框右侧发送键旁应出现「增强」按钮；点击后应弹出原文/增强结果并排的预览面板。'
  Write-Host '  3) 点击「回填」后，输入框上方应出现撤销条，点「撤销」恢复原文。'
  Write-Host '  4) 光标在输入框内按 Ctrl+Alt+E（默认快捷键）应触发同样流程。'
  Write-Host '  5) 输入 /enhance 应出现在斜杠命令面板中。'
  Write-Host '  6) 设置 → 插件配置 应出现「提示词增强」相关设置项（模型覆盖/温度/预算/快捷键）。'
  Write-Host '  7) 若以上均无：查看 DSH 日志目录 logs 中最新日志是否报 dsh-prompt-forge 加载错误。'
} else {
  Write-Host '  1) 完全退出 DSH 后重新启动，新开一个会话。'
  Write-Host '  2) 输入框右侧不应再有「增强」按钮，Ctrl+Alt+E 不再触发，/enhance 不在命令面板中。'
  Write-Host '  3) 设置 → 插件配置 中「提示词增强」设置项应消失。'
  Write-Host '  4) 日志中不再出现 dsh-prompt-forge 的加载行。'
}

Write-Host ''
if ($fails -gt 0) { Write-Host ('结论: FAIL（' + $fails + ' 项失败, ' + $warns + ' 项警告）') -ForegroundColor Red }
else { Write-Host ('结论: PASS（' + $warns + ' 项警告）') -ForegroundColor Green }

if (-not $NoPause) { Read-Host '按回车键退出' | Out-Null }
if ($fails -gt 0) { exit 1 }
exit 0
