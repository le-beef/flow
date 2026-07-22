$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseDir = Join-Path $projectRoot 'release'
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'VERSION') -Raw).Trim()
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Versao do AtendeFlow invalida.' }
$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$stage = Join-Path $releaseDir "stage_$([Guid]::NewGuid().ToString('N'))"
$packageRoot = Join-Path $stage 'AtendeFlow'
$zip = Join-Path $releaseDir "AtendeFlow-$version-Instalador-$stamp.zip"
$manual = Join-Path $projectRoot "output\pdf\Manual-de-Instalacao-AtendeFlow-$version.pdf"

if (-not (Test-Path -LiteralPath $manual)) { throw "Manual da versão $version não encontrado." }
& (Join-Path $PSScriptRoot 'build-installer-launcher.ps1')

New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null
try {
  robocopy.exe $projectRoot $packageRoot /E /XD '.git' 'node_modules' 'dist' 'backups' 'logs' 'uploads' 'release' '.updates' 'tmp' 'output' '.agents' '.codex' /XF '.env' '.atendeflow.pid' '*.log' 'tsconfig.tsbuildinfo' | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Falha ao copiar os arquivos para distribuicao. Codigo Robocopy: $LASTEXITCODE" }
  Copy-Item -LiteralPath $manual -Destination (Join-Path $packageRoot 'Manual-de-Instalacao-AtendeFlow.pdf')
  Compress-Archive -LiteralPath $packageRoot -DestinationPath $zip -CompressionLevel Optimal
  Write-Host "Pacote comercial AtendeFlow $version criado: $zip" -ForegroundColor Green
  Write-Host 'O cliente deve extrair o ZIP e clicar em Instalar-AtendeFlow.exe.' -ForegroundColor Cyan
} finally {
  if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
