# Sets up the venv (first run only) and starts the server at http://localhost:8000
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

$venvPython = "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "Creating virtual environment (first run only)..."
    python -m venv backend\.venv
}

Write-Host "Installing/updating dependencies..."
& $venvPython -m pip install -q -r backend\requirements.txt

Write-Host ""
Write-Host "Starting server at http://localhost:8000 (Ctrl+C to stop)"
Write-Host ""
& $venvPython -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
