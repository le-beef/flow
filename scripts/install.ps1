$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'VERSION') -Raw).Trim()

Write-Host "=== Instalador AtendeFlow $version ===" -ForegroundColor Green
function New-HexSecret([int]$Bytes) {
  $buffer = New-Object byte[] $Bytes
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($buffer) } finally { $generator.Dispose() }
  return ([BitConverter]::ToString($buffer) -replace '-', '').ToLower()
}
$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
if (-not (Test-Path $docker)) { $docker = (Get-Command docker -ErrorAction Stop).Source }
foreach ($command in @('node','npm.cmd')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "Dependencia ausente: $command. Instale Docker Desktop e Node.js LTS antes de continuar."
  }
}

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  $apiKey = 'af_' + (New-HexSecret 24)
  $webhook = 'whsec_' + (New-HexSecret 24)
  $jwt = New-HexSecret 48
  $content = Get-Content '.env' -Raw
  $content = $content.Replace('troque-por-uma-chave-forte', $apiKey).Replace('troque-por-outro-segredo-forte', $webhook).Replace('troque-por-um-segredo-com-mais-de-32-caracteres', $jwt)
  Set-Content '.env' $content -Encoding utf8
  Write-Host 'Arquivo .env criado. Revise o e-mail e a senha inicial antes de vender a instalacao.' -ForegroundColor Yellow
}

& $docker compose up -d
npm.cmd install
Get-Content 'apps/api/src/db/schema.sql' -Raw | & $docker compose exec -T postgres psql -U postgres -d lebeef
npm.cmd run build
try { & (Join-Path $PSScriptRoot 'schedule-backup.ps1') } catch { Write-Warning 'Nao foi possivel agendar o backup automatico. Execute scripts/schedule-backup.ps1 como administrador.' }
try { & (Join-Path $PSScriptRoot 'schedule-startup.ps1') } catch { Write-Warning 'Nao foi possivel configurar a inicializacao automatica.' }
Write-Host 'AtendeFlow instalado e configurado para iniciar com o Windows.' -ForegroundColor Green
