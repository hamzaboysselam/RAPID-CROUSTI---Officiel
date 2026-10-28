@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or is not available on PATH.
  exit /b 1
)
npm.cmd run dev
