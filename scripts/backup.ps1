$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $projectRoot 'backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$target = Join-Path $backupDir "atendeflow_$stamp.sql"
$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
if (-not (Test-Path $docker)) { $docker = (Get-Command docker -ErrorAction Stop).Source }
$container = & $docker compose -f (Join-Path $projectRoot 'docker-compose.yml') ps -q postgres
if (-not $container) { throw 'PostgreSQL do AtendeFlow nao esta em execucao.' }
& $docker exec $container pg_dump -U postgres -d lebeef --clean --if-exists | Set-Content -Encoding utf8 $target
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar backup do PostgreSQL.' }
Write-Host "Backup criado: $target" -ForegroundColor Green
Get-ChildItem -LiteralPath $backupDir -Filter 'atendeflow_*.sql' -File | Where-Object LastWriteTime -lt (Get-Date).AddDays(-30) | Remove-Item -Force
