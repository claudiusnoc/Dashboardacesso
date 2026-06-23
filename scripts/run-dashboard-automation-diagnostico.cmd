@echo off
setlocal
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-dashboard-automation.ps1" -SkipGit -PauseOnExit
echo.
echo Se a janela chegou aqui, o PowerShell encerrou. Verifique o log mais recente na pasta logs.
pause
