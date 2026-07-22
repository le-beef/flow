param(
  [Parameter(Mandatory=$true)][string]$Package,
  [Parameter(Mandatory=$true)][string]$ExpectedVersion,
  [Parameter(Mandatory=$true)][string]$ExpectedHash,
  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$updatesRoot = Join-Path $projectRoot '.updates'
$statusFile = Join-Path $updatesRoot 'status.json'
$logDir = Join-Path $projectRoot 'logs'
$logFile = Join-Path $logDir 'atualizacao.log'
$work = Join-Path $updatesRoot "work_$([Guid]::NewGuid().ToString('N'))"
$rollback = Join-Path $updatesRoot "rollback\before-$ExpectedVersion-$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')"
$stopped = $false

New-Item -ItemType Directory -Force -Path $updatesRoot,$logDir | Out-Null
Start-Transcript -Path $logFile -Append | Out-Null

function Set-UpdateStatus([string]$State, [string]$Message, [int]$Progress) {
  [ordered]@{
    state = $State
    message = $Message
    progress = $Progress
    version = $ExpectedVersion
    updatedAt = (Get-Date).ToUniversalTime().ToString('o')
  } | ConvertTo-Json | Set-Content -LiteralPath $statusFile -Encoding utf8
}

function Find-Docker {
  $known = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
  if (Test-Path -LiteralPath $known) { return $known }
  return (Get-Command docker.exe -ErrorAction Stop).Source
}

function Stop-AtendeFlow {
  $pidFile = Join-Path $projectRoot '.atendeflow.pid'
  if (Test-Path -LiteralPath $pidFile) {
    $rootPid = [int](Get-Content -LiteralPath $pidFile -Raw)
    if ($rootPid) { taskkill.exe /PID $rootPid /T /F *> $null }
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  }
  $ids = @(Get-NetTCPConnection -State Listen -LocalPort 3333,5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
  foreach ($id in $ids) {
    if ($id -and $id -ne $PID) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
  }
  Start-Sleep -Seconds 2
}

function Start-AtendeFlow {
  & (Join-Path $PSScriptRoot 'start-atendeflow.ps1')
}

try {
  Set-UpdateStatus 'validating' 'Validando o pacote de atualização.' 5
  $resolvedPackage = (Resolve-Path -LiteralPath $Package).Path
  if ([IO.Path]::GetExtension($resolvedPackage) -ne '.zip') { throw 'O pacote de atualização precisa ser ZIP.' }
  $actualHash = (Get-FileHash -LiteralPath $resolvedPackage -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne $ExpectedHash.ToLowerInvariant()) { throw 'SHA-256 do pacote não corresponde ao manifesto.' }

  New-Item -ItemType Directory -Force -Path $work | Out-Null
  Expand-Archive -LiteralPath $resolvedPackage -DestinationPath $work
  $manifestPath = Join-Path $work 'update.json'
  $payload = Join-Path $work 'payload'
  if (-not (Test-Path -LiteralPath $manifestPath) -or -not (Test-Path -LiteralPath $payload)) { throw 'Estrutura do pacote inválida.' }
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($manifest.product -ne 'AtendeFlow' -or $manifest.version -ne $ExpectedVersion) { throw 'Produto ou versão do pacote inválidos.' }
  if ($ValidateOnly) {
    Set-UpdateStatus 'validated' 'Pacote validado sem aplicar alterações.' 100
    Stop-Transcript | Out-Null
    return
  }

  Set-UpdateStatus 'backup' 'Criando backup do banco e dos arquivos atuais.' 15
  & (Join-Path $PSScriptRoot 'backup.ps1')
  New-Item -ItemType Directory -Force -Path $rollback | Out-Null
  robocopy.exe $projectRoot $rollback /E /XD '.git' 'node_modules' 'dist' 'backups' 'logs' 'uploads' 'release' '.updates' 'tmp' 'output' '.agents' '.codex' /XF '.env' '*.log' 'tsconfig.tsbuildinfo' | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Falha ao criar ponto de restauração ($LASTEXITCODE)." }

  Set-UpdateStatus 'installing' 'Parando o painel e aplicando os novos arquivos.' 35
  Stop-AtendeFlow
  $stopped = $true
  robocopy.exe $payload $projectRoot /E /XD 'node_modules' 'dist' 'backups' 'logs' 'uploads' 'release' '.updates' 'tmp' 'output' /XF '.env' '*.log' 'tsconfig.tsbuildinfo' | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Falha ao aplicar os arquivos ($LASTEXITCODE)." }

  foreach ($relative in @($manifest.remove)) {
    if (-not $relative) { continue }
    $candidate = [IO.Path]::GetFullPath((Join-Path $projectRoot ([string]$relative)))
    if (-not $candidate.StartsWith($projectRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'O pacote tentou remover um caminho fora do AtendeFlow.' }
    if ($candidate -match '\\(\.env|backups|uploads|logs|\.updates)(\\|$)') { throw 'O pacote tentou remover dados protegidos.' }
    if (Test-Path -LiteralPath $candidate) { Remove-Item -LiteralPath $candidate -Recurse -Force }
  }

  Set-UpdateStatus 'building' 'Atualizando dependências e banco de dados.' 58
  Set-Location $projectRoot
  npm.cmd install
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar as dependências.' }
  $docker = Find-Docker
  & $docker compose up -d
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar os containers.' }
  Get-Content 'apps/api/src/db/schema.sql' -Raw | & $docker compose exec -T postgres psql -U postgres -d lebeef
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao atualizar o banco de dados.' }
  npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar a nova versão.' }

  Set-UpdateStatus 'restarting' 'Reiniciando o AtendeFlow.' 85
  Start-AtendeFlow
  $ready = $false
  for ($attempt = 1; $attempt -le 45; $attempt++) {
    if (Test-NetConnection -ComputerName 127.0.0.1 -Port 3333 -InformationLevel Quiet -WarningAction SilentlyContinue) { $ready = $true; break }
    Start-Sleep -Seconds 2
  }
  if (-not $ready) { throw 'A nova versão não iniciou corretamente.' }
  Set-UpdateStatus 'complete' 'Atualização concluída com sucesso.' 100
  Stop-Transcript | Out-Null
} catch {
  $failure = $_.Exception.Message
  try {
    if (Test-Path -LiteralPath $rollback) {
      Set-UpdateStatus 'rollback' 'A atualização falhou. Restaurando a versão anterior.' 90
      if (-not $stopped) { Stop-AtendeFlow }
      robocopy.exe $rollback $projectRoot /E /XD '.updates' /XF '.env' | Out-Null
      Set-Location $projectRoot
      npm.cmd install | Out-Null
      npm.cmd run build | Out-Null
      Start-AtendeFlow
    }
  } catch {}
  Set-UpdateStatus 'failed' "Falha na atualização: $failure" 100
  try { Stop-Transcript | Out-Null } catch {}
  exit 1
} finally {
  if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force }
}
