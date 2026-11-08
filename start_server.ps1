Set-Location -Path $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  STARTING VIDEO ADMIN LOCAL SERVER" -ForegroundColor Green
Write-Host "  Url: http://localhost:8000" -ForegroundColor Yellow
Write-Host "  Press Ctrl + C to stop server" -ForegroundColor Gray
Write-Host "========================================================" -ForegroundColor Cyan

Start-Process "http://localhost:8000"

try {
    if (Test-Path "server.py") {
        python server.py
    } else {
        python -m http.server 8000
    }
} catch {
    npx --yes serve . -l 8000
}
