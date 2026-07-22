@echo off
chcp 65001 >nul
title Criar pacote AtendeFlow
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\create-client-package.ps1"
pause
