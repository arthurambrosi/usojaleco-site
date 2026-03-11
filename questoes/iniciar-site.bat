@echo off
setlocal
cd /d "%~dp0"

set "PY_CMD="
where py >nul 2>nul && set "PY_CMD=py"
if not defined PY_CMD (
  where python >nul 2>nul && set "PY_CMD=python"
)

if not defined PY_CMD (
  echo Python nao foi encontrado neste computador.
  echo Instale Python e execute novamente este arquivo.
  pause
  exit /b 1
)

echo Atualizando lista de provas com base nas subpastas de data...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$dataDir = Join-Path (Get-Location) 'data';" ^
  "if (-not (Test-Path -LiteralPath $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null };" ^
  "$names = Get-ChildItem -LiteralPath $dataDir -Directory | Select-Object -ExpandProperty Name;" ^
  "$json = @{ provas = @($names) } | ConvertTo-Json -Depth 4;" ^
  "$enc = New-Object System.Text.UTF8Encoding($false);" ^
  "[System.IO.File]::WriteAllText((Join-Path $dataDir 'provas.json'), ($json + [Environment]::NewLine), $enc);"

start "" "http://127.0.0.1:5500"
echo Iniciando servidor em http://127.0.0.1:5500
echo Para encerrar, feche esta janela ou pressione Ctrl+C.
%PY_CMD% -m http.server 5500 --bind 127.0.0.1

endlocal
