$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backupScript = Join-Path $PSScriptRoot 'backup.ps1'
$taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$backupScript`""
schtasks.exe /Create /TN 'AtendeFlow Backup Diario' /TR $taskCommand /SC DAILY /ST 03:00 /F | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel agendar o backup automatico.' }
Write-Host 'Backup automatico agendado diariamente para 03:00.' -ForegroundColor Green
