@echo off
setlocal
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do taskkill /PID %%P /F >nul 2>&1
cd /d "%~dp0"
set "ENV_FILE=%~dp0editor\env.js"
powershell -NoProfile -Command "$token = [Environment]::GetEnvironmentVariable('GITHUB_TOKEN','Process'); if ([string]::IsNullOrWhiteSpace($token)) { $token = [Environment]::GetEnvironmentVariable('GITHUB_TOKEN','User') }; if ([string]::IsNullOrWhiteSpace($token)) { $token = [Environment]::GetEnvironmentVariable('GITHUB_TOKEN','Machine') }; if ($null -eq $token) { $token = '' }; $payload = 'window.PRESCREVER_ENV = ' + (@{ GITHUB_TOKEN = $token } | ConvertTo-Json -Compress) + ';'; Set-Content -Path '%ENV_FILE%' -Value $payload -Encoding UTF8"
start "Prescrever" cmd /k "cd /d ""%~dp0"" && python -m http.server 8080"
timeout /t 2 >nul
start "" "http://localhost:8080/editor/?v=20260306-03"
endlocal
