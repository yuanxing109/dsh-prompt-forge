#requires -Version 5.1
<#
.SYNOPSIS
  dsh-prompt-forge 离线包安装器（Windows 10/11 + PowerShell 5.1+）
.DESCRIPTION
  把包内 plugin\dsh-prompt-forge 安装进 DeepSeek Harness 的 profile：
    1) 校验包完整性（package-manifest.json 的 SHA-256）
    2) 探测 DSH 安装目录、Node 运行时、pnpm
    3) 复制插件到 <profile>\vendor\dsh-prompt-forge
    4) 在 profile package.json 写入 file:./vendor/dsh-prompt-forge 并注册 dsh.profile.bundles（先备份）
    5) pnpm install 接线；无 pnpm 时退回 node_modules junction
    6) 自动调用 verify.ps1 校验
.PARAMETER Profile
  profile 名称，默认自动探测（优先 desktop）。
.PARAMETER DshHome
  DSH 用户目录，默认 %USERPROFILE%\.dsh（或环境变量 DSH_HOME）。
.PARAMETER DshRoot
  DSH 安装根目录（含 DeepSeek Harness.exe），默认注册表/常见路径/运行进程探测。
.PARAMETER Force
  检测到 DeepSeek Harness 进程时强制结束。
.PARAMETER NoPnpm
  跳过 pnpm install，直接建立 junction。
.PARAMETER SkipProcessCheck
  跳过运行进程检测（仅自动化测试）。
.PARAMETER SkipIntegrityCheck
  跳过源文件哈希校验。
.PARAMETER SkipVerify
  安装后不自动运行 verify.ps1。
.PARAMETER Launch
  安装完成后启动 DSH。
.PARAMETER NoPause
  结束时不等待回车。
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Profile desktop -Force -Launch
#>
[CmdletBinding()]
param(
  [string]$Profile = '',
  [string]$DshHome = '',
  [string]$DshRoot = '',
  [switch]$Force,
  [switch]$NoPnpm,
  [switch]$SkipProcessCheck,
  [switch]$SkipIntegrityCheck,
  [switch]$SkipVerify,
  [switch]$Launch,
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$packageRoot = $PSScriptRoot
$pluginSrc = Join-Path $packageRoot 'plugin\dsh-prompt-forge'
$patchTool = Join-Path $packageRoot 'tools\patch-profile.mjs'
$manifestFile = Join-Path $packageRoot 'package-manifest.json'
$verifyScript = Join-Path $packageRoot 'verify.ps1'

function Write-Section([string]$text) { Write-Host ''; Write-Host ('==> ' + $text) -ForegroundColor Cyan }
function Write-Ok([string]$text) { Write-Host ('  [ok]   ' + $text) -ForegroundColor Green }
function Write-Step([string]$text) { Write-Host ('  [...] ' + $text) -ForegroundColor Gray }
function Write-Warn([string]$text) { Write-Host ('  [warn] ' + $text) -ForegroundColor Yellow }
function Finish([string]$text) {
  Write-Host ''
  Write-Host ('安装失败: ' + $text) -ForegroundColor Red
  if (-not $NoPause) { Read-Host '按回车键退出' | Out-Null }
  exit 1
}

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
      if ($props.DisplayIcon) {
        $icon = ([string]$props.DisplayIcon) -replace ',\s*\d+$', ''
        $icon = $icon.Trim().Trim('"')
        $exe = $null
        if (Test-Path $icon) { $exe = $icon } elseif (Test-Path ($icon + '.exe')) { $exe = $icon + '.exe' }
        if ($exe) { return (Split-Path -Parent $exe) }
      }
    }
  }
  return $null
}

function Get-DshRootFromProcess {
  $proc = Get-Processes | Select-Object -First 1
  if (-not $proc) { return $null }
  try { if ($proc.Path) { return (Split-Path -Parent $proc.Path) } } catch { }
  return $null
}

function Resolve-DshRoot {
  if ($DshRoot) {
    if (Test-Path (Join-Path $DshRoot 'resources')) { return $DshRoot }
    Finish ('-DshRoot 指定的目录不含 resources: ' + $DshRoot)
  }
  $candidates = New-Object System.Collections.Generic.List[string]
  if ($env:DSH_INSTALL_ROOT) { $candidates.Add($env:DSH_INSTALL_ROOT) }
  $reg = Get-DshRootFromRegistry
  if ($reg) { $candidates.Add($reg) }
  $procRoot = Get-DshRootFromProcess
  if ($procRoot) { $candidates.Add($procRoot) }
  if ($env:LOCALAPPDATA) { $candidates.Add((Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness')) }
  if ($env:ProgramFiles) { $candidates.Add((Join-Path $env:ProgramFiles 'DeepSeek Harness')) }
  if ($env:ProgramFilesX86) { $candidates.Add((Join-Path $env:ProgramFilesX86 'DeepSeek Harness')) }
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path (Join-Path $candidate 'resources'))) { return $candidate }
  }
  return $null
}

function Resolve-ProfileDir([string]$dshHomeDir, [string]$name) {
  $profilesRoot = Join-Path $dshHomeDir 'profiles'
  if (-not (Test-Path $profilesRoot)) { Finish ('未找到 profiles 目录: ' + $profilesRoot + '（DSH 尚未初始化，请先启动一次桌面版）') }
  if ($name) {
    $dir = Join-Path $profilesRoot $name
    if (-not (Test-Path (Join-Path $dir 'package.json'))) { Finish ('profile 不存在或未初始化: ' + $dir) }
    return @{ Dir = $dir; Name = $name }
  }
  $dirs = @(Get-ChildItem $profilesRoot -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName 'package.json') })
  if ($dirs.Count -eq 0) { Finish ('profiles 目录下没有任何已初始化的 profile: ' + $profilesRoot) }
  $desktop = $dirs | Where-Object { $_.Name -eq 'desktop' } | Select-Object -First 1
  if ($desktop) { return @{ Dir = $desktop.FullName; Name = $desktop.Name } }
  if ($dirs.Count -eq 1) { return @{ Dir = $dirs[0].FullName; Name = $dirs[0].Name } }
  $names = ($dirs | ForEach-Object { $_.Name }) -join ', '
  Finish ('无法唯一确定 profile（发现: ' + $names + '），请用 -Profile <名称> 指定。')
}

function Invoke-Pnpm([string[]]$pnpmArgs, [string]$workDir, [string]$logPath) {
  Push-Location $workDir
  try {
    if ($pnpmKind -eq 'bundled') { & $nodeExe $pnpmScript @pnpmArgs *> $logPath }
    else { & $pnpmExe @pnpmArgs *> $logPath }
    return $LASTEXITCODE
  } finally { Pop-Location }
}

function Set-VendorLink([string]$profileDir, [string]$vendorDir) {
  $nodeModules = Join-Path $profileDir 'node_modules'
  if (-not (Test-Path $nodeModules)) { New-Item -ItemType Directory -Path $nodeModules | Out-Null }
  $link = Join-Path $nodeModules 'dsh-prompt-forge'
  if (Test-Path $link) { Remove-Item -Path $link -Recurse -Force -ErrorAction SilentlyContinue }
  New-Item -ItemType Junction -Path $link -Target $vendorDir | Out-Null
}

Write-Host ''
Write-Host '=========================================' -ForegroundColor White
Write-Host ' dsh-prompt-forge 离线安装器' -ForegroundColor White
Write-Host '=========================================' -ForegroundColor White
Write-Host ('包根目录 : ' + $packageRoot)
Write-Host ('PowerShell: ' + $PSVersionTable.PSVersion.ToString())
try {
  $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
  Write-Host ('系统      : ' + $os.Caption + ' (' + $os.Version + ')')
} catch { Write-Host ('系统      : ' + [System.Environment]::OSVersion.VersionString) }

Write-Section '1/7 校验包完整性'
foreach ($required in @($pluginSrc, $patchTool, $manifestFile)) {
  if (-not (Test-Path $required)) { Finish ('包文件缺失: ' + $required + '（请把整个 dsh-prompt-forge-package 目录一起复制）') }
}
$manifest = Get-Content $manifestFile -Raw | ConvertFrom-Json
$expectedVersion = [string]$manifest.version
Write-Ok ('包版本 ' + $expectedVersion + ' / 文件 ' + $manifest.fileCount)
if (-not $SkipIntegrityCheck) {
  $bad = @()
  foreach ($entry in $manifest.files) {
    $target = Join-Path $pluginSrc $entry.path
    if (-not (Test-Path $target)) { $bad += ('缺失 ' + $entry.path); continue }
    $hash = (Get-FileHash -Path $target -Algorithm SHA256).Hash.ToLower()
    if ($hash -ne $entry.sha256) { $bad += ('哈希不符 ' + $entry.path) }
  }
  if ($bad.Count -gt 0) { Finish ('包内容被改动或复制不完整: ' + ($bad -join '; ')) }
  Write-Ok '源文件哈希全部匹配'
}

Write-Section '2/7 定位 DSH、Node 与 pnpm'
$dshRoot = Resolve-DshRoot
if ($dshRoot) { Write-Ok ('DSH 安装目录: ' + $dshRoot) } else { Write-Warn '未探测到 DSH 安装目录（将依赖 PATH 中的 node/pnpm）' }

$appPkg = $null
if ($dshRoot) { $appPkg = Join-Path $dshRoot 'resources\app\package.json' }
if ($appPkg -and (Test-Path $appPkg)) {
  try {
    $dshVersion = [string](Get-Content $appPkg -Raw | ConvertFrom-Json).version
    Write-Ok ('DSH 版本: ' + $dshVersion)
    $core = $dshVersion -replace '[-+].*$', ''
    $dv = [version]$core
    if ($dv.Major -eq 0 -and ($dv.Minor -lt 1 -or $dv.Minor -gt 2)) {
      Write-Warn ('DSH ' + $dshVersion + ' 不在插件声明区间（>=0.1.1-rc.2 <0.3.0）内，继续安装但请留意加载日志')
    }
  } catch { Write-Warn '无法读取 DSH 版本' }
}

$nodeExe = $null
if ($dshRoot) { $nodeExe = Get-RuntimeFile $dshRoot 'primary-runtime\dependencies\node\bin\node.exe' }
if ($nodeExe) { Write-Ok ('Node: ' + $nodeExe + '（DSH 自带）') }
else {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { $nodeExe = $cmd.Source; Write-Ok ('Node: ' + $nodeExe + '（PATH）') }
}
if (-not $nodeExe) { Finish '未找到 Node 运行时：本机既无 DSH 自带 node，PATH 中也没有 node。请安装 Node.js ^22.19 或 >=24。' }

$nodeVersion = (& $nodeExe -v).Trim()
$semver = $nodeVersion -replace '^v', ''
try { $nv = [version]$semver } catch { Finish ('无法解析 Node 版本: ' + $nodeVersion) }
$nodeOk = (($nv.Major -eq 22) -and ($nv.Minor -ge 19)) -or ($nv.Major -ge 24)
if ($nv.Major -eq 23) { Write-Warn 'Node 23.x 不在插件 engines 范围内，建议改用 22 LTS 或 24+。' }
if (-not $nodeOk) { Finish ('Node 版本 ' + $nodeVersion + ' 不满足插件 engines（^22.19.0 || >=24.0.0）') }
Write-Ok ('Node 版本 ' + $nodeVersion + ' 满足要求')

$pnpmKind = 'none'
$pnpmScript = $null
$pnpmExe = $null
if ($dshRoot) { $pnpmScript = Get-RuntimeFile $dshRoot 'primary-runtime\dependencies\pnpm\bin\pnpm.cjs' }
if ($pnpmScript) { $pnpmKind = 'bundled'; Write-Ok ('pnpm: DSH 自带 ' + $pnpmScript) }
else {
  $cmd = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($cmd) { $pnpmKind = 'global'; $pnpmExe = $cmd.Source; Write-Ok ('pnpm: ' + $pnpmExe) }
  else { Write-Warn '未找到 pnpm（DSH 自带与 PATH 均无），将使用 junction 安装' }
}

if (-not $DshHome) { if ($env:DSH_HOME) { $DshHome = $env:DSH_HOME } else { $DshHome = Join-Path $env:USERPROFILE '.dsh' } }
if (-not (Test-Path $DshHome)) { Finish ('未找到 DSH 用户目录 ' + $DshHome + '，请先启动一次 DSH 桌面版完成初始化，或用 -DshHome 指定。') }
$profileInfo = Resolve-ProfileDir $DshHome $Profile
$profileDir = $profileInfo.Dir
$Profile = $profileInfo.Name
Write-Ok ('DSH 用户目录: ' + $DshHome)
Write-Ok ('profile: ' + $Profile + ' -> ' + $profileDir)

$statusRaw = (& $nodeExe $patchTool status --profile $profileDir 2>$null | Out-String)
$status = $null
try { $status = $statusRaw | ConvertFrom-Json } catch { }
if (-not $status -or -not $status.ok) { Finish ('无法读取 profile 清单: ' + ($statusRaw -replace '\s+', ' ')) }
if ($null -eq $status.bundleEntries) { Finish '该 profile 的 package.json 没有 dsh.profile.bundles（profile 未初始化），请先启动一次 DSH 桌面版。' }

Write-Section '3/7 确认 DeepSeek Harness 已退出'
$running = Get-Processes
if ($running.Count -gt 0) {
  if ($SkipProcessCheck) { Write-Warn ('检测到 ' + $running.Count + ' 个 DSH 进程，-SkipProcessCheck 已指定，跳过关闭流程') }
  elseif ($Force) {
    Write-Step ('关闭 ' + $running.Count + ' 个 DeepSeek Harness 进程')
    $running | Stop-Process -Force -ErrorAction SilentlyContinue
    for ($i = 0; $i -lt 20; $i++) { Start-Sleep -Milliseconds 500; if ((Get-Processes).Count -eq 0) { break } }
    if ((Get-Processes).Count -gt 0) { Finish '无法结束 DSH 进程，请手动退出（含托盘）后重试。' }
    Write-Ok 'DSH 已退出'
  }
  else { Finish 'DeepSeek Harness 正在运行，安装会改写被锁定的文件。请完全退出（含托盘）后重试，或加 -Force 让脚本强制结束。' }
} else { Write-Ok '未检测到运行中的 DSH' }

Write-Section '4/7 复制插件到 profile\vendor'
$vendorRoot = Join-Path $profileDir 'vendor'
$vendorDir = Join-Path $vendorRoot 'dsh-prompt-forge'
if (-not (Test-Path $vendorRoot)) { New-Item -ItemType Directory -Path $vendorRoot | Out-Null }
if (Test-Path $vendorDir) { Remove-Item -Path $vendorDir -Recurse -Force }
$null = robocopy $pluginSrc $vendorDir /E /NFL /NDL /NJH /NJS /NP /R:2 /W:2
if ($LASTEXITCODE -ge 8) { Finish ('复制插件失败，robocopy 退出码 ' + $LASTEXITCODE) }
Write-Ok ('已复制到 ' + $vendorDir)

Write-Section '5/7 写入 profile 清单（依赖 + bundle）'
$patchOut = (& $nodeExe $patchTool add --profile $profileDir 2>$null | Out-String)
if ($LASTEXITCODE -ne 0) { Finish ('写入 profile 清单失败: ' + ($patchOut -replace '\s+', ' ')) }
$patchRes = $null
try { $patchRes = $patchOut | ConvertFrom-Json } catch { }
if ($patchRes) { Write-Ok ('依赖: ' + $patchRes.dependency + ' / bundle 条目: ' + $patchRes.bundleEntries + ' / 安装前备份: ' + $patchRes.backup) }

Write-Section '6/7 接线 node_modules'
$logDir = Join-Path $vendorDir '.install'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logPath = Join-Path $logDir ('pnpm-install-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
$needLink = $false
if ($NoPnpm) { Write-Warn '-NoPnpm 已指定：跳过 pnpm install'; $needLink = $true }
elseif ($pnpmKind -eq 'none') { Write-Warn '无 pnpm：退回 junction 安装'; $needLink = $true }
else {
  Write-Step ('pnpm install（' + $pnpmKind + '），日志 ' + $logPath)
  $rc = Invoke-Pnpm @('install', '--prefer-offline', '--config.confirmModulesPurge=false') $profileDir $logPath
  if ($rc -ne 0) {
    Write-Warn ('pnpm install 退出码 ' + $rc + '，退回 junction 安装')
    if (Test-Path $logPath) { Get-Content $logPath -Tail 12 | ForEach-Object { Write-Host ('      | ' + $_) -ForegroundColor DarkGray } }
    $needLink = $true
  } else { Write-Ok 'pnpm install 完成' }
}
$installedManifest = Join-Path $profileDir 'node_modules\dsh-prompt-forge\package.json'
if ($needLink -or -not (Test-Path $installedManifest)) {
  Set-VendorLink $profileDir $vendorDir
  Write-Ok '已建立 node_modules\dsh-prompt-forge junction'
}
if (-not (Test-Path $installedManifest)) { Finish 'node_modules 中未解析到 dsh-prompt-forge，安装未完成。' }
$installedVersion = [string](Get-Content $installedManifest -Raw | ConvertFrom-Json).version
if ($installedVersion -ne $expectedVersion) { Write-Warn ('已安装版本 ' + $installedVersion + ' 与包内 ' + $expectedVersion + ' 不一致') }
else { Write-Ok ('已安装版本 ' + $installedVersion) }

Write-Section '7/7 校验安装'
if (-not $SkipVerify) {
  $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $verifyScript + '"'), '-Mode', 'install', '-NoPause', '-Profile', ('"' + $Profile + '"'), '-DshHome', ('"' + $DshHome + '"'))
  if ($DshRoot) { $argList += @('-DshRoot', ('"' + $DshRoot + '"')) }
  $verifyProc = Start-Process -FilePath 'powershell.exe' -ArgumentList $argList -NoNewWindow -Wait -PassThru
  if ($verifyProc.ExitCode -ne 0) {
    Write-Host ''
    Write-Host '自动校验未全部通过，请按上方 FAIL 项处理。' -ForegroundColor Red
    if (-not $NoPause) { Read-Host '按回车键退出' | Out-Null }
    exit 1
  }
} else { Write-Warn '-SkipVerify 已指定，跳过自动校验（之后可运行 verify.bat）' }

Write-Host ''
Write-Host '安装完成。' -ForegroundColor Green
Write-Host ('  插件目录 : ' + $vendorDir)
Write-Host ('  profile  : ' + $profileDir)
Write-Host '下一步：'
Write-Host '  1) 完全退出 DeepSeek Harness（含托盘）后重新打开；'
Write-Host '  2) 新建会话，输入任意草稿，点击输入框右侧「增强」按钮，或按 Ctrl+Alt+E；'
Write-Host '  3) 设置 → 插件配置 中应出现「提示词增强」相关设置项。'
Write-Host '卸载：双击 uninstall.bat（会还原安装前的 profile 清单）。'

if ($Launch) {
  $exe = $null
  if ($dshRoot) { $exe = Join-Path $dshRoot 'DeepSeek Harness.exe' }
  if ($exe -and (Test-Path $exe)) { Start-Process -FilePath $exe; Write-Ok '已启动 DeepSeek Harness' }
  else { Write-Warn '未找到 DeepSeek Harness.exe，请手动启动。' }
}

if (-not $NoPause) { Read-Host '按回车键退出' | Out-Null }
exit 0
