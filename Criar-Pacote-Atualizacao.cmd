@echo off
chcp 65001 >nul
title Criar atualização AtendeFlow
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\create-update-package.ps1"
pause
