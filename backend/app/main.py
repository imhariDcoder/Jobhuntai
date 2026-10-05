import truststore

# Must run before anything creates an SSL context (e.g. the openai/httpx
# import chain below): this network's corporate proxy does TLS inspection
# with a root CA that's trusted by Windows (curl/schannel work fine) but
# not by certifi's bundled CA list, which httpx uses by default -- that
# mismatch surfaces as a generic openai.APIConnectionError with a wrapped
# "CERTIFICATE_VERIFY_FAILED". Patching ssl.SSLContext to defer to the OS
# trust store instead fixes it.
truststore.inject_into_ssl()

from contextlib import asynccontextmanager
from pathlib import Path

from typing import Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app import crud
from app.db import get_session, init_db
from app.latex.compile import compile_tex_to_pdf
from app.latex.injector import render_resume_tex
from app.llm.base import InvalidBulletSelectionError, LLMProviderError
from app.llm.factory import get_provider
from app.schemas import Profile
from app.skills_categorizer import classify_skills_batch, clean_and_redistribute_skills
from app.tailor import tailor_profile

_FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="SmartJobAI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/profile", response_model=Profile)
def get_profile() -> Profile:
    with get_session() as session:
        return Profile.model_validate(crud.get_full_profile(session))


@app.put("/api/profile", response_model=Profile)
def put_profile(profile: Profile) -> Profile:
    profile_dict = profile.model_dump()
    if profile_dict.get("skills"):
        profile_dict["skills"] = clean_and_redistribute_skills(profile_dict["skills"])
        profile = Profile.model_validate(profile_dict)
    with get_session() as session:
        crud.replace_full_profile(session, profile)
        return Profile.model_validate(crud.get_full_profile(session))


class CategorizeSkillsRequest(BaseModel):
    skills: list[str]
    existing_categories: list[str] = []


class CategorizeSkillsResponse(BaseModel):
    assignments: dict[str, str]


@app.post("/api/skills/categorize", response_model=CategorizeSkillsResponse)
def categorize_skills_endpoint(req: CategorizeSkillsRequest) -> CategorizeSkillsResponse:
    return CategorizeSkillsResponse(
        assignments=classify_skills_batch(req.skills, req.existing_categories)
    )


@app.post("/api/resume/render")
def render_resume() -> FileResponse:
    """Mode 1: render the stored profile through the Step 1 injector and
    compile it with tectonic, unmodified from how Step 1 proved it out."""
    with get_session() as session:
        profile_dict = crud.get_full_profile(session)

    tex = render_resume_tex(profile_dict)
    pdf_path = compile_tex_to_pdf(tex)

    return FileResponse(pdf_path, media_type="application/pdf", filename="resume.pdf")


class TailorRequest(BaseModel):
    jd_text: str
    provider: Literal["openai", "anthropic", "gemini"] = "openai"
    api_key: str


class BulletDiffOut(BaseModel):
    bullet_id: str
    entry_kind: str
    entry_label: str
    original_text: str
    rewritten_text: str


class TailorPreviewResponse(BaseModel):
    jd_keywords: list[str]
    matched_keywords: list[str]
    missing_keywords: list[str]
    match_score: float
    diffs: list[BulletDiffOut]
    selected_bullets: dict[str, list[str]]
    honesty_note: str = ""
    profile_skills: list[dict] = []


@app.post("/api/resume/tailor/preview", response_model=TailorPreviewResponse)
def tailor_preview(payload: TailorRequest) -> TailorPreviewResponse:
    """Mode 2, step 1: extract JD keywords and have the LLM select/reword
    a subset of the user's own stored bullets. Returns the review data
    (match score, keyword coverage, before/after diffs) plus the
    `selected_bullets` override needed to actually render a PDF -- no PDF
    is compiled here, so the user can review before spending a render."""
    with get_session() as session:
        profile_dict = crud.get_full_profile(session)

    provider = get_provider(payload.provider, payload.api_key)

    try:
        result = tailor_profile(profile_dict, payload.jd_text, provider)
    except LLMProviderError as e:
        raise HTTPException(status_code=502, detail=f"{payload.provider} request failed: {e}")
    except InvalidBulletSelectionError as e:
        raise HTTPException(status_code=502, detail=f"AI response could not be validated: {e}")

    return TailorPreviewResponse(
        jd_keywords=result.jd_keywords,
        matched_keywords=result.matched_keywords,
        missing_keywords=result.missing_keywords,
        match_score=result.match_score,
        diffs=[BulletDiffOut(**vars(d)) for d in result.diffs],
        selected_bullets=result.selected_bullets,
        honesty_note=result.honesty_note,
        profile_skills=profile_dict.get("skills", []),
    )


class TailorDownloadRequest(BaseModel):
    selected_bullets: dict[str, list[str]]
    tailored_skills: Optional[list[dict]] = None


@app.post("/api/resume/tailor/download")
def tailor_download(payload: TailorDownloadRequest) -> FileResponse:
    """Mode 2, step 2: render+compile the PDF from the `selected_bullets`
    a prior /preview call already produced -- reuses the *same* Step 1
    injector Mode 1 uses, and makes no further LLM call."""
    with get_session() as session:
        profile_dict = crud.get_full_profile(session)

    tex = render_resume_tex(
        profile_dict,
        selected_bullets=payload.selected_bullets,
        tailored_skills=payload.tailored_skills,
    )
    pdf_path = compile_tex_to_pdf(tex)

    return FileResponse(pdf_path, media_type="application/pdf", filename="resume_tailored.pdf")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(_FRONTEND_DIR / "index.html")


@app.get("/jd")
def jd_page() -> FileResponse:
    return FileResponse(_FRONTEND_DIR / "jd.html")


@app.get("/kage")
def kage_page() -> FileResponse:
    return FileResponse(_FRONTEND_DIR / "kage.html")


app.mount("/static", StaticFiles(directory=_FRONTEND_DIR), name="static")
