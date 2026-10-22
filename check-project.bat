@echo off
cd /d "%~dp0"
call npm.cmd run lint
if errorlevel 1 goto failed
call npm.cmd run typecheck
if errorlevel 1 goto failed
call npm.cmd test
if errorlevel 1 goto failed
call npm.cmd run build
if errorlevel 1 goto failed
echo All project checks passed.
exit /b 0
:failed
echo A project check failed. Review the output above.
exit /b 1
