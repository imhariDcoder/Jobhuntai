#!/usr/bin/env bash
# Sets up the venv (first run only) and starts the server at http://localhost:8000
set -e
cd "$(dirname "$0")"

if [ -f "backend/.venv/Scripts/python.exe" ]; then
  VENV_PY="backend/.venv/Scripts/python.exe"   # venv created by Windows Python, run under Git Bash
elif [ -f "backend/.venv/bin/python" ]; then
  VENV_PY="backend/.venv/bin/python"            # venv created by macOS/Linux Python
else
  echo "Creating virtual environment (first run only)..."
  python3 -m venv backend/.venv
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
