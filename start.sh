#!/usr/bin/env bash
# Sets up the venv (first run only) and starts the server at http://localhost:8000
set -e
cd "$(dirname "$0")"

if [ -f "backend/.venv/Scripts/python.exe" ]; then
  VENV_PY="backend/.venv/Scripts/python.exe"   # venv created by Windows Python, run under Git Bash
elif [ -f "backend/.venv/bin/python" ]; then
  VENV_PY="backend/.venv/bin/python"            # venv created by macOS/Linux Python
else
  echo "Checking for Python 3.10+ installation..."

  # Helper to test if a candidate command is a working Python 3.9+
  check_py() {
    "$@" -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" 2>/dev/null
  }

  PY_CMD=()

  # Check standard commands
  if check_py python; then
    PY_CMD=("python")
  elif check_py py -3; then
    PY_CMD=("py" "-3")
  elif check_py python3; then
    PY_CMD=("python3")
  else
    # Check common Windows directories if Python was installed without "Add to PATH"
    for cand in \
      "$LOCALAPPDATA/Programs/Python/Python313/python.exe" \
      "$LOCALAPPDATA/Programs/Python/Python312/python.exe" \
      "$LOCALAPPDATA/Programs/Python/Python311/python.exe" \
      "$LOCALAPPDATA/Programs/Python/Python310/python.exe" \
      "/c/Program Files/Python313/python.exe" \
      "/c/Program Files/Python312/python.exe" \
      "/c/Program Files/Python311/python.exe" \
      "/c/Program Files/Python310/python.exe" \
      "/c/Python313/python.exe" \
      "/c/Python312/python.exe" \
      "/c/Python311/python.exe" \
      "/c/Python310/python.exe"; do
      if [ -f "$cand" ] && check_py "$cand"; then
        PY_CMD=("$cand")
        break
      fi
    done
  fi

  if [ ${#PY_CMD[@]} -eq 0 ]; then
    echo ""
    echo "=========================================================================="
    echo "ERROR: Python 3.10+ was not found or is blocked by the Windows Store alias."
    echo ""
    echo "If Python is already installed on your machine:"
    echo "1. Disable the Microsoft Store redirector:"
    echo "   Settings -> Apps -> Advanced app settings -> App execution aliases"
    echo "   Turn OFF 'App Installer (python.exe)' and 'App Installer (python3.exe)'"
    echo "2. Or reinstall from https://www.python.org/downloads/ and be sure to check:"
    echo "   [x] Add Python to PATH"
    echo "=========================================================================="
    echo ""
    exit 1
  fi

  PY_VER=$("${PY_CMD[@]}" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')")
  echo "Found Python $PY_VER (${PY_CMD[*]})"
  echo "Creating virtual environment (first run only)..."
  "${PY_CMD[@]}" -m venv backend/.venv

  if [ -f "backend/.venv/Scripts/python.exe" ]; then
    VENV_PY="backend/.venv/Scripts/python.exe"
  else
    VENV_PY="backend/.venv/bin/python"
  fi
fi

echo "Installing/updating dependencies..."
"$VENV_PY" -m pip install -q -r backend/requirements.txt

echo ""
echo "Starting server at http://localhost:8000 (Ctrl+C to stop)"
echo ""
"$VENV_PY" -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
