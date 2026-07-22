$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$compiler = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) {
  $compiler = 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe'
}
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Compilador do Windows .NET Framework não encontrado.' }

$source = Join-Path $PSScriptRoot 'installer-launcher.cs'
$icon = Join-Path $projectRoot 'assets\installer\AtendeFlow.ico'
$output = Join-Path $projectRoot 'Instalar-AtendeFlow.exe'
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'VERSION') -Raw).Trim()
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Versão do AtendeFlow inválida.' }
$temporarySource = Join-Path ([IO.Path]::GetTempPath()) "atendeflow-launcher-$([Guid]::NewGuid().ToString('N')).cs"
try {
  (Get-Content -LiteralPath $source -Raw).Replace('__ATENDEFLOW_ASSEMBLY_VERSION__', "$version.0") | Set-Content -LiteralPath $temporarySource -Encoding utf8
  & $compiler /nologo /target:winexe /optimize+ /win32icon:$icon /reference:System.Windows.Forms.dll /out:$output $temporarySource
} finally {
  if (Test-Path -LiteralPath $temporarySource) { Remove-Item -LiteralPath $temporarySource -Force }
}
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $output)) {
  throw 'Não foi possível compilar o instalador executável.'
}
Write-Host "Executável criado: $output" -ForegroundColor Green
