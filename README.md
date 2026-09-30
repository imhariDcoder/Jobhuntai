# Jobhuntai

An AI resume-tailoring app. Store your professional profile once, then:

- **Mode 1:** render it into a polished, ATS-friendly PDF resume any time you update it.
- **Mode 2:** paste a job description and get a tailored PDF — the AI selects and rewords a subset of your *own* stored bullets to match the JD (it never invents new content), shows you a match score, matched/missing keywords, and a before/after diff of every bullet it touched, before you download anything.

Works with your choice of OpenAI, Anthropic (Claude), or Google Gemini — you provide your own API key per request; it's never stored server-side.

## Prerequisites

- **Python 3.11+** (developed against 3.13)
- **Windows**: nothing else to install — a `tectonic` (LaTeX compiler) binary is already bundled at `tools/bin/tectonic.exe`.
- **macOS/Linux**: download a `tectonic` binary for your platform from the [tectonic releases page](https://github.com/tectonic-typesetting/tectonic/releases) and either place it at `tools/bin/tectonic` or point the `TECTONIC_PATH` environment variable at it.

## Running it

**Windows (PowerShell):**
```powershell
.\start.ps1
```

**macOS/Linux/Git Bash:**
```bash
./start.sh
```

Either script creates the Python virtual environment and installs dependencies on first run (idempotent — safe to re-run any time), then starts the server. Open **http://localhost:8000** in a browser.

Prefer to do it by hand?
```bash
python -m venv backend/.venv
backend/.venv/Scripts/pip install -r backend/requirements.txt   # backend/.venv/bin/pip on macOS/Linux
backend/.venv/Scripts/python -m uvicorn app.main:app --app-dir backend --port 8000
```

## Using it

- **`/`** — fill in your profile (header, education, experience, projects, skills, certifications). "Save Profile" persists it; "Save & Preview PDF" also renders a PDF you can review before downloading.
- **`/jd`** — pick an AI provider, paste your API key for it, paste a job description, and hit "Tailor My Resume." Review the match score and bullet diffs, optionally add any missing keywords you genuinely have to your Skills, then "Preview PDF" to review and download.

## Data & storage

- Everything is stored locally in a SQLite file at `backend/data/app.db`, created automatically on first run. There's no login/accounts — it's single-user by design.
- That file is gitignored on purpose: it holds real personal profile data (name, contact info, resume content) once you fill in the form. Don't commit or share it — each person running this locally builds up their own.
- If you need a specific LaTeX bundle mirror (some networks block the default one) or a custom SQLite path, see the environment variables `TECTONIC_BUNDLE`, `TECTONIC_PATH`, and `SMARTJOBAI_DB_PATH` referenced in `backend/app/latex/compile.py` and `backend/app/db.py`.

## Running the tests

```bash
backend/.venv/Scripts/python -m pytest backend   # backend/.venv/bin/python on macOS/Linux
```
