@echo off
setlocal
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify.ps1" -Mode install %*
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify.ps1" %*
)
exit /b %ERRORLEVEL%
