# Sets up the venv (first run only) and starts the server at http://localhost:8000
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

$venvPython = "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "Checking for Python 3.10+ installation..."

    function Test-PythonCmd($cmd, $args) {
        try {
            $p = Start-Process -FilePath $cmd -ArgumentList $args -NoNewWindow -PassThru -Wait -RedirectStandardError ([System.IO.Path]::GetTempFileName())
            return ($p.ExitCode -eq 0)
        } catch {
            return $false
        }
    }

    $foundPy = $null
    $foundArgs = @()

    # 1. Try python
    if (Test-PythonCmd "python" @("-c", "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)")) {
        $foundPy = "python"
        $foundArgs = @()
    }
    # 2. Try py -3 (Windows Python Launcher)
    elseif (Test-PythonCmd "py" @("-3", "-c", "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)")) {
        $foundPy = "py"
        $foundArgs = @("-3")
    }
    # 3. Try python3
    elseif (Test-PythonCmd "python3" @("-c", "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)")) {
        $foundPy = "python3"
        $foundArgs = @()
    }
    else {
        # Check standard Windows directories
        $paths = @(
            "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
            "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
            "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
            "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe",
            "$env:ProgramFiles\Python313\python.exe",
            "$env:ProgramFiles\Python312\python.exe",
            "$env:ProgramFiles\Python311\python.exe",
            "$env:ProgramFiles\Python310\python.exe",
            "C:\Python313\python.exe",
            "C:\Python312\python.exe",
            "C:\Python311\python.exe",
            "C:\Python310\python.exe"
        )
        foreach ($p in $paths) {
            if (Test-Path $p) {
                if (Test-PythonCmd $p @("-c", "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)")) {
                    $foundPy = $p
                    $foundArgs = @()
                    break
                }
            }
        }
    }

    if (-not $foundPy) {
        Write-Host ""
        Write-Host "==========================================================================" -ForegroundColor Red
        Write-Host "ERROR: Python 3.10+ was not found or is blocked by the Windows Store alias." -ForegroundColor Red
        Write-Host ""
        Write-Host "If Python is already installed on your machine:"
        Write-Host "1. Disable the Microsoft Store redirector:"
        Write-Host "   Settings -> Apps -> Advanced app settings -> App execution aliases"
        Write-Host "   Turn OFF 'App Installer (python.exe)' and 'App Installer (python3.exe)'"
        Write-Host "2. Or reinstall from https://www.python.org/downloads/ and be sure to check:"
        Write-Host "   [x] Add Python to PATH"
        Write-Host "==========================================================================" -ForegroundColor Red
        Write-Host ""
        exit 1
    }

    Write-Host "Found Python ($foundPy $foundArgs)"
    Write-Host "Creating virtual environment (first run only)..."
    & $foundPy @foundArgs -m venv backend\.venv
}

Write-Host "Installing/updating dependencies..."
& $venvPython -m pip install -q -r backend\requirements.txt

Write-Host ""
Write-Host "Starting server at http://localhost:8000 (Ctrl+C to stop)"
Write-Host ""
& $venvPython -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
