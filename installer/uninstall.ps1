#requires -Version 5.1
<#
.SYNOPSIS
  dsh-prompt-forge 离线包卸载器（Windows 10/11 + PowerShell 5.1+）
.DESCRIPTION
  1) 检测并（按需）结束 DeepSeek Harness
  2) 还原安装前的 profile package.json / pnpm-lock.yaml（无备份时剥离依赖与 bundle 条目）
  3) pnpm install 清理 node_modules 接线；无 pnpm 时手动移除 junction
  4) 删除 <profile>\vendor\dsh-prompt-forge
  5) 自动调用 verify.ps1 -Mode uninstall 校验
.PARAMETER Profile
  profile 名称，默认自动探测（优先 desktop）。
.PARAMETER DshHome
  DSH 用户目录，默认 %USERPROFILE%\.dsh（或环境变量 DSH_HOME）。
.PARAMETER DshRoot
  DSH 安装根目录，默认注册表/常见路径/运行进程探测。
.PARAMETER Force
  检测到 DeepSeek Harness 进程时强制结束。
.PARAMETER SkipProcessCheck
  跳过运行进程检测（仅自动化测试）。
.PARAMETER SkipVerify
  卸载后不自动运行 verify.ps1。
.PARAMETER NoPause
  结束时不等待回车。
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File uninstall.ps1
#>
[CmdletBinding()]
param(
  [string]$Profile = '',
  [string]$DshHome = '',
  [string]$DshRoot = '',
  [switch]$Force,
  [switch]$SkipProcessCheck,
  [switch]$SkipVerify,
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$packageRoot = Split-Path -Parent $PSScriptRoot
$patchTool = Join-Path $PSScriptRoot 'tools\patch-profile.mjs'
$verifyScript = Join-Path $packageRoot 'verify.ps1'

function Write-Section([string]$text) { Write-Host ''; Write-Host ('==> ' + $text) -ForegroundColor Cyan }
function Write-Ok([string]$text) { Write-Host ('  [ok]   ' + $text) -ForegroundColor Green }
function Write-Step([string]$text) { Write-Host ('  [...] ' + $text) -ForegroundColor Gray }
function Write-Warn([string]$text) { Write-Host ('  [warn] ' + $text) -ForegroundColor Yellow }
function Finish([string]$text) {
  Write-Host ''
  Write-Host ('卸载失败: ' + $text) -ForegroundColor Red
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
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path (Join-Path $candidate 'resources'))) { return $candidate }
  }
  return $null
}

function Resolve-ProfileDir([string]$dshHomeDir, [string]$name) {
  $profilesRoot = Join-Path $dshHomeDir 'profiles'
  if (-not (Test-Path $profilesRoot)) { Finish ('未找到 profiles 目录: ' + $profilesRoot) }
  if ($name) {
    $dir = Join-Path $profilesRoot $name
    if (-not (Test-Path (Join-Path $dir 'package.json'))) { Finish ('profile 不存在: ' + $dir) }
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

Write-Host ''
Write-Host '=========================================' -ForegroundColor White
Write-Host ' dsh-prompt-forge 离线卸载器' -ForegroundColor White
Write-Host '=========================================' -ForegroundColor White

Write-Section '1/5 定位 DSH 与 profile'
if (-not $DshHome) { if ($env:DSH_HOME) { $DshHome = $env:DSH_HOME } else { $DshHome = Join-Path $env:USERPROFILE '.dsh' } }
if (-not (Test-Path $DshHome)) { Finish ('未找到 DSH 用户目录: ' + $DshHome) }
$profileInfo = Resolve-ProfileDir $DshHome $Profile
$profileDir = $profileInfo.Dir
$Profile = $profileInfo.Name
Write-Ok ('profile: ' + $Profile + ' -> ' + $profileDir)
$dshRoot = Resolve-DshRoot
if ($dshRoot) { Write-Ok ('DSH 安装目录: ' + $dshRoot) } else { Write-Warn '未探测到 DSH 安装目录（将依赖 PATH 中的 node/pnpm）' }

$nodeExe = $null
if ($dshRoot) { $nodeExe = Get-RuntimeFile $dshRoot 'primary-runtime\dependencies\node\bin\node.exe' }
if (-not $nodeExe) { $cmd = Get-Command node -ErrorAction SilentlyContinue; if ($cmd) { $nodeExe = $cmd.Source } }
if (-not $nodeExe) { Finish '未找到 Node 运行时，无法修补 profile 清单。请安装 Node.js ^22.19 或 >=24。' }
$pnpmKind = 'none'
$pnpmScript = $null
$pnpmExe = $null
if ($dshRoot) { $pnpmScript = Get-RuntimeFile $dshRoot 'primary-runtime\dependencies\pnpm\bin\pnpm.cjs' }
if ($pnpmScript) { $pnpmKind = 'bundled' }
else { $cmd = Get-Command pnpm -ErrorAction SilentlyContinue; if ($cmd) { $pnpmKind = 'global'; $pnpmExe = $cmd.Source } }

Write-Section '2/5 确认 DeepSeek Harness 已退出'
$running = Get-Processes
if ($running.Count -gt 0) {
  if ($SkipProcessCheck) { Write-Warn ('检测到 ' + $running.Count + ' 个 DSH 进程，-SkipProcessCheck 已指定，跳过关闭流程') }
  elseif ($Force) {
    $running | Stop-Process -Force -ErrorAction SilentlyContinue
    for ($i = 0; $i -lt 20; $i++) { Start-Sleep -Milliseconds 500; if ((Get-Processes).Count -eq 0) { break } }
    if ((Get-Processes).Count -gt 0) { Finish '无法结束 DSH 进程，请手动退出后重试。' }
    Write-Ok 'DSH 已退出'
  }
  else { Finish 'DeepSeek Harness 正在运行，请完全退出（含托盘）后重试，或加 -Force。' }
} else { Write-Ok '未检测到运行中的 DSH' }

Write-Section '3/5 还原 profile 清单'
$patchOut = (& $nodeExe $patchTool remove --profile $profileDir 2>$null | Out-String)
if ($LASTEXITCODE -ne 0) { Finish ('还原 profile 清单失败: ' + ($patchOut -replace '\s+', ' ')) }
$patchRes = $null
try { $patchRes = $patchOut | ConvertFrom-Json } catch { }
if ($patchRes -and $patchRes.mode -eq 'restored') {
  Write-Ok ('已还原安装前清单（依赖写法: ' + $patchRes.dependency + '）')
} else {
  Write-Ok '已剥离依赖与 bundle 条目（未发现安装前备份）'
}

Write-Section '4/5 清理 node_modules 与 vendor'
$link = Join-Path $profileDir 'node_modules\dsh-prompt-forge'
$vendorDir = Join-Path $profileDir 'vendor\dsh-prompt-forge'
if ($pnpmKind -ne 'none') {
  $logDir = Join-Path $env:TEMP 'dsh-prompt-forge-uninstall'
  if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
  $logPath = Join-Path $logDir ('pnpm-prune-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
  Write-Step ('pnpm install（清理接线），日志 ' + $logPath)
  $rc = Invoke-Pnpm @('install', '--prefer-offline', '--config.confirmModulesPurge=false') $profileDir $logPath
  if ($rc -ne 0) {
    Write-Warn ('pnpm install 退出码 ' + $rc + '：改为手动移除 junction')
    if (Test-Path $logPath) { Get-Content $logPath -Tail 10 | ForEach-Object { Write-Host ('      | ' + $_) -ForegroundColor DarkGray } }
  } else { Write-Ok 'pnpm install 完成' }
}
if (Test-Path $link) {
  $item = Get-Item -Path $link -Force -ErrorAction SilentlyContinue
  $isVendorLink = $false
  if ($item) {
    if ($item.LinkType -eq 'Junction') { $isVendorLink = $true }
    elseif ($item.Target) { if ((($item.Target | Out-String) -like '*vendor*')) { $isVendorLink = $true } }
  }
  if ($isVendorLink) { Remove-Item -Path $link -Force -Recurse; Write-Ok '已移除 node_modules junction' }
  else { Write-Warn ('node_modules\dsh-prompt-forge 不是指向 vendor 的链接（可能是还原后的常规安装），保留原样') }
}
if (Test-Path $vendorDir) { Remove-Item -Path $vendorDir -Recurse -Force; Write-Ok ('已删除 ' + $vendorDir) } else { Write-Ok 'vendor 目录本不存在' }
$vendorRoot = Join-Path $profileDir 'vendor'
if (Test-Path $vendorRoot) {
  $left = @(Get-ChildItem $vendorRoot -Force -ErrorAction SilentlyContinue)
  if ($left.Count -eq 0) { Remove-Item -Path $vendorRoot -Force -ErrorAction SilentlyContinue }
}

Write-Section '5/5 校验卸载结果'
if (-not $SkipVerify) {
  $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $verifyScript + '"'), '-Mode', 'uninstall', '-NoPause', '-Profile', ('"' + $Profile + '"'), '-DshHome', ('"' + $DshHome + '"'))
  if ($DshRoot) { $argList += @('-DshRoot', ('"' + $DshRoot + '"')) }
  $verifyProc = Start-Process -FilePath 'powershell.exe' -ArgumentList $argList -NoNewWindow -Wait -PassThru
  if ($verifyProc.ExitCode -ne 0) {
    Write-Host ''
    Write-Host '卸载校验未全部通过，请按上方 FAIL 项处理。' -ForegroundColor Red
    if (-not $NoPause) { Read-Host '按回车键退出' | Out-Null }
    exit 1
  }
} else { Write-Warn '-SkipVerify 已指定' }

Write-Host ''
Write-Host '卸载完成。' -ForegroundColor Green
Write-Host '  说明：若安装前该 profile 已有 dsh-prompt-forge（例如 registry 0.3.4），卸载会把清单还原为原写法，'
Write-Host '        下次 pnpm install/DSH 启动会重新安装原版本；要彻底移除请在 DSH 插件管理器中再次卸载。'
Write-Host '  下一步：完全退出 DeepSeek Harness 后重新打开，确认输入框不再出现「增强」按钮。'

if (-not $NoPause) { Read-Host '按回车键退出' | Out-Null }
exit 0
