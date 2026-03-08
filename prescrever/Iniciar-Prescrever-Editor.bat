@echo off
setlocal
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do taskkill /PID %%P /F >nul 2>&1
cd /d "%~dp0"
start "Prescrever" cmd /k "cd /d ""%~dp0"" && python -m http.server 8080"
timeout /t 2 >nul
start "" "http://localhost:8080/editor/?v=20260308-01"
endlocal
