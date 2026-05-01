$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$npm = 'C:\Program Files\nodejs\npm.cmd'
$node = 'C:\Program Files\nodejs\node.exe'
$hostName = '127.0.0.1'
$port = 3000
$url = "http://$hostName`:$port/"
$serverEntry = Join-Path $projectDir 'dist\server\index.mjs'
$outLog = Join-Path $projectDir 'usojaleco-server.out.log'
$errLog = Join-Path $projectDir 'usojaleco-server.err.log'
$launcherLog = Join-Path $projectDir 'usojaleco-launcher.err.log'

function Test-UsoJalecoOnline {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect($hostName, $port, $null, $null)

    if (-not $async.AsyncWaitHandle.WaitOne(250, $false)) {
      $client.Close()
      return $false
    }

    $client.EndConnect($async)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

function Test-ProductionBuildExists {
  $distIndex = Join-Path $projectDir 'dist\index.html'
  return (Test-Path -LiteralPath $distIndex) -and (Test-Path -LiteralPath $serverEntry)
}

function Ensure-ProductionFiles {
  if (Test-ProductionBuildExists) {
    return
  }

  $build = Start-Process -FilePath $npm -ArgumentList @('run', 'build') -WorkingDirectory $projectDir -WindowStyle Hidden -Wait -PassThru

  if ($build.ExitCode -ne 0) {
    throw 'Falha ao gerar a versao otimizada do UsoJaleco. Confira usojaleco-server.err.log.'
  }
}

function Start-UsoJalecoServer {
  $env:NODE_ENV = 'production'
  $env:PORT = [string]$port

  $command = 'cd /d "{0}" && "{1}" "{2}" >> "{3}" 2>> "{4}"' -f $projectDir, $node, $serverEntry, $outLog, $errLog
  Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/c', $command) -WorkingDirectory $projectDir -WindowStyle Hidden
}

function Open-UsoJaleco {
  Start-Process $url
}

try {
  Set-Location -LiteralPath $projectDir

  if (-not (Test-Path -LiteralPath (Join-Path $projectDir 'node_modules'))) {
    Start-Process -FilePath $npm -ArgumentList 'install' -WorkingDirectory $projectDir -WindowStyle Hidden -Wait
  }

  if (-not (Test-UsoJalecoOnline)) {
    Ensure-ProductionFiles
    Start-UsoJalecoServer

    $deadline = (Get-Date).AddSeconds(5)
    while ((Get-Date) -lt $deadline) {
      Start-Sleep -Milliseconds 150
      if (Test-UsoJalecoOnline) {
        break
      }
    }
  }

  Open-UsoJaleco
} catch {
  $message = "Nao foi possivel abrir o UsoJaleco.`n`n" + $_.Exception.Message
  Add-Content -LiteralPath $launcherLog -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' - ' + $_.Exception.ToString())

  $shell = New-Object -ComObject WScript.Shell
  $shell.Popup($message, 0, 'UsoJaleco', 16) | Out-Null
}
