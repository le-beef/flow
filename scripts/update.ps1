$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
if (-not (Test-Path $docker)) { $docker = (Get-Command docker -ErrorAction Stop).Source }
& (Join-Path $PSScriptRoot 'backup.ps1')
npm.cmd install
& $docker compose up -d
npm.cmd run build
Write-Host 'AtendeFlow atualizado. O backup foi criado antes da atualizacao.' -ForegroundColor Green
