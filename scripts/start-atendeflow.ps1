$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$apiReady = Test-NetConnection -ComputerName 127.0.0.1 -Port 3333 -InformationLevel Quiet -WarningAction SilentlyContinue
$webReady = Test-NetConnection -ComputerName 127.0.0.1 -Port 5173 -InformationLevel Quiet -WarningAction SilentlyContinue
if ($apiReady -and $webReady) { exit 0 }

$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$process = Start-Process -FilePath $npm -ArgumentList @('run','dev') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'atendeflow-output.log') -RedirectStandardError (Join-Path $logDir 'atendeflow-error.log') -PassThru
Set-Content -LiteralPath (Join-Path $projectRoot '.atendeflow.pid') -Value $process.Id -Encoding ascii
