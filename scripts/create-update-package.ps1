param(
  [string]$BaseUrl = 'https://SEU-DOMINIO.web.app',
  [string]$MinimumVersion = '3.18.0',
  [switch]$Required,
  [string[]]$Notes = @('Melhorias e correções do AtendeFlow.')
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'VERSION') -Raw).Trim()
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Versão inválida.' }
if ($MinimumVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Versão mínima inválida.' }
$releaseDir = Join-Path $projectRoot 'release\updates'
$stage = Join-Path $releaseDir "stage_$([Guid]::NewGuid().ToString('N'))"
$payload = Join-Path $stage 'payload'
$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$fileName = "AtendeFlow-$version-Atualizacao-$stamp.zip"
$zip = Join-Path $releaseDir $fileName
New-Item -ItemType Directory -Force -Path $payload | Out-Null

try {
  foreach ($folder in @('apps','scripts','assets')) {
    robocopy.exe (Join-Path $projectRoot $folder) (Join-Path $payload $folder) /E /XD 'node_modules' 'dist' 'uploads' /XF '*.log' 'tsconfig.tsbuildinfo' | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Falha ao copiar $folder ($LASTEXITCODE)." }
  }
  foreach ($file in @('package.json','package-lock.json','docker-compose.yml','VERSION','README.md')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination (Join-Path $payload $file)
  }
  [ordered]@{
    product = 'AtendeFlow'
    version = $version
    minimumVersion = $MinimumVersion
    createdAt = (Get-Date).ToUniversalTime().ToString('o')
    remove = @()
  } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $stage 'update.json') -Encoding utf8
  Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal
  $hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
  $size = (Get-Item -LiteralPath $zip).Length
  $url = "$($BaseUrl.TrimEnd('/'))/$fileName"
  [ordered]@{
    product = 'AtendeFlow'
    version = $version
    publishedAt = (Get-Date).ToUniversalTime().ToString('o')
    required = [bool]$Required
    minimumVersion = $MinimumVersion
    packageUrl = $url
    sha256 = $hash
    size = $size
    notes = @($Notes)
  } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $releaseDir 'latest.json') -Encoding utf8
  Write-Host "Pacote incremental criado: $zip" -ForegroundColor Green
  Write-Host "Manifesto criado: $(Join-Path $releaseDir 'latest.json')" -ForegroundColor Green
  Write-Host 'Publique o ZIP e latest.json no endereço configurado.' -ForegroundColor Cyan
} finally {
  if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
