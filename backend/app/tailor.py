"""Mode 2 glue: turn a JD + the stored profile into a tailoring result the
API can show the user (match score, keyword coverage, before/after bullet
diffs) and the `selected_bullets` override the Step 1 injector already
knows how to consume for the actual PDF.

This is the only place Mode 2 differs from Mode 1 -- it decides which
bullets and phrasing go in, then hands off to the same
`render_resume_tex` used by Mode 1, unmodified.
"""

from dataclasses import dataclass, field

from app.llm.base import Bullet, LLMProvider


@dataclass
class BulletDiff:
    bullet_id: str
    entry_kind: str
    entry_label: str
    original_text: str
    rewritten_text: str


@dataclass
class TailorResult:
    jd_keywords: list[str]
    matched_keywords: list[str]
    missing_keywords: list[str]
    match_score: float
    diffs: list[BulletDiff] = field(default_factory=list)
    selected_bullets: dict[str, list[str]] = field(default_factory=dict)


def _entry_label(entry: dict, kind: str) -> str:
    if kind == "experience":
        role = entry.get("role") or ""
        org = entry.get("org") or ""
        label = " @ ".join(part for part in (role, org) if part)
        return label or "Experience entry"
    title = entry.get("title") or ""
    return title or "Project"


def _flatten_bullets(profile: dict) -> tuple[list[Bullet], dict[str, dict]]:
    """Collect every experience/project bullet into one flat list for the
    LLM call, plus a bullet_id -> origin lookup used to regroup the
    response and to look up each bullet's original text for the diff."""
    all_bullets: list[Bullet] = []
    bullet_info: dict[str, dict] = {}

    for exp in profile.get("experience", []):
        entry_bullets = exp.get("bullets", [])
        if not entry_bullets:
            continue
        label = _entry_label(exp, "experience")
        for b in entry_bullets:
            all_bullets.append(Bullet(id=b["id"], text=b["text"], keywords=b.get("keywords", [])))
            bullet_info[b["id"]] = {
                "kind": "experience",
                "entry_id": exp["id"],
                "entry_label": label,
                "original_text": b["text"],
            }

    for proj in profile.get("projects", []):
        entry_bullets = proj.get("bullets", [])
        if not entry_bullets:
            continue
        label = _entry_label(proj, "project")
        for b in entry_bullets:
            all_bullets.append(Bullet(id=b["id"], text=b["text"], keywords=b.get("keywords", [])))
            bullet_info[b["id"]] = {
                "kind": "project",
                "entry_id": proj["id"],
                "entry_label": label,
                "original_text": b["text"],
            }

    return all_bullets, bullet_info


def _known_keywords(profile: dict) -> set[str]:
    """Every keyword the candidate's stored profile already carries --
    from bullet keywords and skill items/categories -- lowercased for
    case-insensitive matching against JD keywords."""
    known: set[str] = set()
    for exp in profile.get("experience", []):
        for b in exp.get("bullets", []):
            known.update(k.lower() for k in b.get("keywords", []))
    for proj in profile.get("projects", []):
        for b in proj.get("bullets", []):
            known.update(k.lower() for k in b.get("keywords", []))
    for skill in profile.get("skills", []):
        known.update(item.lower() for item in skill.get("items", []))
        if skill.get("category"):
            known.add(skill["category"].lower())
    return known


def compute_keyword_coverage(profile: dict, jd_keywords: list[str]) -> tuple[list[str], list[str]]:
    """Which JD keywords the candidate's profile already covers, and
    which it doesn't -- independent of which bullets the LLM ultimately
    selected, since coverage reflects the candidate's real skillset."""
    known = _known_keywords(profile)
    matched = [kw for kw in jd_keywords if kw.lower() in known]
    missing = [kw for kw in jd_keywords if kw.lower() not in known]
    return matched, missing


def tailor_profile(profile: dict, jd_text: str, provider: LLMProvider) -> TailorResult:
    all_bullets, bullet_info = _flatten_bullets(profile)

    if not all_bullets:
        return TailorResult(jd_keywords=[], matched_keywords=[], missing_keywords=[], match_score=0.0)

    jd_keywords = provider.extract_keywords(jd_text)
    selections = provider.select_and_rewrite_bullets(all_bullets, jd_keywords)

    entry_keys = {f"{info['kind']}:{info['entry_id']}" for info in bullet_info.values()}
    selected_bullets: dict[str, list[str]] = {key: [] for key in entry_keys}
    diffs: list[BulletDiff] = []

    for selection in selections:
        info = bullet_info[selection.bullet_id]
        selected_bullets[f"{info['kind']}:{info['entry_id']}"].append(selection.rewritten_text)
        diffs.append(
            BulletDiff(
                bullet_id=selection.bullet_id,
                entry_kind=info["kind"],
                entry_label=info["entry_label"],
                original_text=info["original_text"],
                rewritten_text=selection.rewritten_text,
            )
        )

    matched, missing = compute_keyword_coverage(profile, jd_keywords)
    match_score = len(matched) / len(jd_keywords) if jd_keywords else 0.0

    return TailorResult(
        jd_keywords=jd_keywords,
        matched_keywords=matched,
        missing_keywords=missing,
        match_score=match_score,
        diffs=diffs,
        selected_bullets=selected_bullets,
    )
