@echo off
cd /d "%~dp0"

echo ========================================================
echo   STARTING VIDEO ADMIN LOCAL SERVER
echo   Url: http://localhost:8000
echo   Press Ctrl + C to stop server
echo ========================================================

start http://localhost:8000

if exist server.py (
    python server.py
    if %ERRORLEVEL% NEQ 0 (
        npx --yes serve . -l 8000
    )
) else (
    python -m http.server 8000
    if %ERRORLEVEL% NEQ 0 (
        npx --yes serve . -l 8000
    )
)

pause
