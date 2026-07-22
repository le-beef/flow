param([Parameter(Mandatory=$true)][string]$BackupFile)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
if (-not (Test-Path $docker)) { $docker = (Get-Command docker -ErrorAction Stop).Source }
$resolved = (Resolve-Path -LiteralPath $BackupFile).Path
if ([IO.Path]::GetExtension($resolved) -ne '.sql') { throw 'Selecione um backup SQL criado pelo AtendeFlow.' }
$confirmation = Read-Host 'A restauracao substituira os dados atuais. Digite RESTAURAR para continuar'
if ($confirmation -ne 'RESTAURAR') { Write-Host 'Operacao cancelada.'; exit 0 }
$container = & $docker compose -f (Join-Path $projectRoot 'docker-compose.yml') ps -q postgres
if (-not $container) { throw 'PostgreSQL do AtendeFlow nao esta em execucao.' }
Get-Content -LiteralPath $resolved -Raw | & $docker exec -i $container psql -U postgres -d lebeef
if ($LASTEXITCODE -ne 0) { throw 'Falha ao restaurar backup.' }
Write-Host 'Backup restaurado com sucesso.' -ForegroundColor Green
