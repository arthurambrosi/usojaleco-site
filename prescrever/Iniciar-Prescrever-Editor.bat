@echo off
setlocal
cd /d "C:\Users\Arthur\Desktop\Prescrever"
start "Prescrever" cmd /k "python -m http.server 8080"
timeout /t 2 >nul
start "" "http://localhost:8080/editor/?v=20260228-22"
endlocal









