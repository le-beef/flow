param([switch]$Resume)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'VERSION') -Raw).Trim()
$launcher = Join-Path $projectRoot 'Instalar-AtendeFlow.cmd'
$logDir = Join-Path $projectRoot 'logs'
$logFile = Join-Path $logDir 'instalacao-windows.log'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Start-Transcript -Path $logFile -Append | Out-Null

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Test-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Find-Docker {
  $known = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
  if (Test-Path $known) { return $known }
  $command = Get-Command docker.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  return $null
}

try {
  if (-not (Test-Administrator)) {
    Write-Step 'Solicitando permissao de administrador'
    $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    if ($Resume) { $arguments += ' -Resume' }
    Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments
    Stop-Transcript | Out-Null
    exit 0
  }

  Set-Location $projectRoot
  Write-Host '=========================================' -ForegroundColor Green
  Write-Host "       INSTALADOR ATENDEFLOW $version" -ForegroundColor Green
  Write-Host '=========================================' -ForegroundColor Green

  Write-Step 'Verificando virtualizacao do processador'
  $processor = Get-CimInstance Win32_Processor | Select-Object -First 1
  if (-not $processor.VirtualizationFirmwareEnabled) {
    Write-Warning 'A virtualizacao esta desativada na BIOS/UEFI.'
    Write-Host 'Ative Intel VT-x/VT-d ou AMD-V/SVM na BIOS e execute este instalador novamente.' -ForegroundColor Yellow
    Write-Host 'Em alguns computadores essa opcao aparece como Virtualization Technology ou SVM Mode.' -ForegroundColor Yellow
    throw 'Virtualizacao de hardware desativada.'
  }

  Write-Step 'Habilitando componentes do Windows para Docker e WSL 2'
  $features = @('Microsoft-Windows-Subsystem-Linux','VirtualMachinePlatform','HypervisorPlatform')
  $restartNeeded = $false
  foreach ($feature in $features) {
    $state = (Get-WindowsOptionalFeature -Online -FeatureName $feature -ErrorAction SilentlyContinue).State
    if ($state -ne 'Enabled') {
      $result = Enable-WindowsOptionalFeature -Online -FeatureName $feature -All -NoRestart
      if ($result.RestartNeeded) { $restartNeeded = $true }
    }
  }

  Write-Step 'Verificando o gerenciador de programas do Windows'
  if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
    throw 'O Winget nao esta instalado. Atualize o App Installer pela Microsoft Store e tente novamente.'
  }

  if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    Write-Step 'Instalando Node.js LTS'
    winget.exe install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar Node.js LTS.' }
  } else {
    Write-Host 'Node.js ja esta instalado.' -ForegroundColor DarkGreen
  }

  if (-not (Find-Docker)) {
    Write-Step 'Instalando Docker Desktop'
    winget.exe install --id Docker.DockerDesktop --exact --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar Docker Desktop.' }
    $restartNeeded = $true
  } else {
    Write-Host 'Docker Desktop ja esta instalado.' -ForegroundColor DarkGreen
  }

  if ($restartNeeded -and -not $Resume) {
    Write-Step 'Preparando continuacao automatica depois do reinicio'
    $resumeCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Resume"
    New-ItemProperty -Path 'HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce' -Name 'AtendeFlowInstaller' -Value $resumeCommand -PropertyType String -Force | Out-Null
    Write-Host 'O computador sera reiniciado em 20 segundos. Salve seus trabalhos abertos.' -ForegroundColor Yellow
    Stop-Transcript | Out-Null
    shutdown.exe /r /t 20 /c "O AtendeFlow continuara a instalacao depois do reinicio."
    exit 0
  }

  Write-Step 'Atualizando os caminhos do sistema'
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
  $docker = Find-Docker
  if (-not $docker) { throw 'Docker Desktop nao foi localizado depois da instalacao.' }

  Write-Step 'Iniciando Docker Desktop'
  $dockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  if (Test-Path $dockerDesktop) {
    Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
  }
  $ready = $false
  for ($attempt = 1; $attempt -le 60; $attempt++) {
    & $docker info *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 3
  }
  if (-not $ready) {
    throw 'Docker Desktop nao ficou pronto. Abra o Docker Desktop, aceite os termos iniciais e execute o instalador novamente.'
  }

  Write-Step 'Instalando o AtendeFlow'
  & (Join-Path $PSScriptRoot 'install.ps1')

  Write-Step 'Criando atalho na Area de Trabalho'
  $desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'AtendeFlow.url'
  $brandIcon = Join-Path $projectRoot 'apps\web\public\atendeflow-icon.png'
  "[InternetShortcut]`r`nURL=http://localhost:5173/`r`nIconFile=$brandIcon`r`nIconIndex=0" | Set-Content -LiteralPath $desktopShortcut -Encoding ascii

  Write-Step 'Iniciando o AtendeFlow'
  & (Join-Path $PSScriptRoot 'start-atendeflow.ps1')
  $panelReady = $false
  for ($attempt = 1; $attempt -le 40; $attempt++) {
    if (Test-NetConnection -ComputerName 127.0.0.1 -Port 5173 -InformationLevel Quiet -WarningAction SilentlyContinue) { $panelReady = $true; break }
    Start-Sleep -Seconds 2
  }
  if (-not $panelReady) { throw 'O painel nao iniciou. Consulte logs/atendeflow-error.log.' }

  Write-Host "`nAtendeFlow instalado com sucesso!" -ForegroundColor Green
  Write-Host 'O painel sera aberto no navegador.' -ForegroundColor Green
  Start-Process 'http://localhost:5173/'
  Stop-Transcript | Out-Null
} catch {
  Write-Host "`nERRO: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Log: $logFile" -ForegroundColor Yellow
  try { Stop-Transcript | Out-Null } catch {}
  exit 1
}
