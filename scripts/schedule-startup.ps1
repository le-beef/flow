$ErrorActionPreference = 'Stop'
$startScript = Join-Path $PSScriptRoot 'start-atendeflow.ps1'
$taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`""
schtasks.exe /Create /TN 'AtendeFlow Inicializacao' /TR $taskCommand /SC ONLOGON /RL HIGHEST /F | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel configurar a inicializacao automatica.' }
Write-Host 'Inicializacao automatica configurada.' -ForegroundColor Green
