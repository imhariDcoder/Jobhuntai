"""Compile a .tex string to PDF using tectonic."""

import os
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_TECTONIC = _PROJECT_ROOT / "tools" / "bin" / "tectonic.exe"

# tectonic's baked-in default bundle host (fullyjustified.net) silently
# ignores HTTP Range requests on this network -- it returns a full 200
# instead of 206 Partial Content, which tectonic's on-demand bundle
# fetcher treats as a hard failure ("failed to download SHA256SUM").
# This Azure-hosted mirror of the same TeX Live resource bundle (surfaced
# in https://github.com/tectonic-typesetting/tectonic/issues/685) honors
# Range requests correctly, so tectonic can fetch just the files a given
# document needs instead of the whole ~2.8GB archive.
_DEFAULT_BUNDLE_URL = "https://ttassets.z13.web.core.windows.net/tlextras-2020.0r0.tar"


def _tectonic_path() -> str:
    return os.environ.get("TECTONIC_PATH", str(_DEFAULT_TECTONIC))


def _bundle_path() -> str:
    return os.environ.get("TECTONIC_BUNDLE", _DEFAULT_BUNDLE_URL)


def compile_tex_to_pdf(tex_source: str, output_dir: Optional[Path] = None) -> Path:
    """Compile `tex_source` and return the path to the produced PDF.

    Raises RuntimeError with tectonic's stderr on compile failure.
    """
    work_dir = Path(output_dir) if output_dir else Path(tempfile.mkdtemp(prefix="resume_"))
    work_dir.mkdir(parents=True, exist_ok=True)

    tex_path = work_dir / "resume.tex"
    tex_path.write_text(tex_source, encoding="utf-8")

    cmd = [
        _tectonic_path(),
        "--outdir",
        str(work_dir),
        "--bundle",
        _bundle_path(),
        str(tex_path),
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
    )

    pdf_path = work_dir / "resume.pdf"
    if result.returncode != 0 or not pdf_path.exists():
        raise RuntimeError(
            f"tectonic compile failed (exit {result.returncode}):\n"
            f"{result.stdout}\n{result.stderr}"
        )

    return pdf_path
