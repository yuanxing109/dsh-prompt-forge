@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1" %*
if errorlevel 1 (
  echo.
  pause
)
exit /b %ERRORLEVEL%
