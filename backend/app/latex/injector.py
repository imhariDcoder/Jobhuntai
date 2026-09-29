"""Deterministic profile -> .tex injector.

This is the single function both Mode 1 (full profile render) and Mode 2
(JD-tailored render) call to produce a compilable .tex string. Mode 2 must
never build LaTeX by any other path than this module.
"""

from pathlib import Path
from typing import Any, Optional

from jinja2 import Environment, FileSystemLoader

from app.latex.escape import escape_latex

_TEMPLATE_DIR = Path(__file__).parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    block_start_string="((*",
    block_end_string="*))",
    variable_start_string="((",
    variable_end_string="))",
    comment_start_string="((=",
    comment_end_string="=))",
    trim_blocks=True,
    lstrip_blocks=True,
    autoescape=False,
)


def _bullet_text(bullet: Any) -> str:
    return bullet["text"] if isinstance(bullet, dict) else bullet


def _resolve_bullets(
    entry: dict, entry_kind: str, selected_bullets: Optional[dict[str, list[str]]]
) -> list[str]:
    """Pick the bullet texts to render for one experience/project entry.

    If `selected_bullets` carries an override for this entry's id (Mode 2:
    the LLM's chosen/reworded subset), use that verbatim. Otherwise fall
    back to every bullet stored on the entry, in stored order (Mode 1).
    """
    if selected_bullets is not None:
        key = f"{entry_kind}:{entry.get('id')}"
        if key in selected_bullets:
            return [escape_latex(text) for text in selected_bullets[key]]

    return [escape_latex(_bullet_text(b)) for b in entry.get("bullets", [])]


def _experience_label(experience: list[dict]) -> str:
    if not experience:
        return ""
    types = {exp.get("type") for exp in experience}
    if "job" in types:
        return "Experience"
    return r"Training \& Applied Learning"


def _url_with_scheme(url: str) -> str:
    if not url:
        return ""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return f"https://{url}"


def _build_context(
    profile: dict, selected_bullets: Optional[dict[str, list[str]]] = None
) -> dict:
    ctx: dict[str, Any] = {
        "name": escape_latex(profile.get("name", "")),
        "phone": escape_latex(profile.get("phone", "")),
        "email": escape_latex(profile.get("email", "")),
        "email_href": escape_latex(profile.get("email", "")),
        "linkedin": escape_latex(profile.get("linkedin", "")),
        "linkedin_url": escape_latex(_url_with_scheme(profile.get("linkedin", ""))),
        "github": escape_latex(profile.get("github", "")),
        "github_url": escape_latex(_url_with_scheme(profile.get("github", ""))),
        "location": escape_latex(profile.get("location", "")),
        "summary": escape_latex(profile.get("summary", "")),
    }

    experience = profile.get("experience") or []
    ctx["experience_label"] = _experience_label(experience)
    ctx["experience"] = [
        {
            "role": escape_latex(exp.get("role", "")),
            "org": escape_latex(exp.get("org", "")),
            "location": escape_latex(exp.get("location", "")),
            "dates": escape_latex(exp.get("dates", "")),
            "bullets": _resolve_bullets(exp, "experience", selected_bullets),
        }
        for exp in experience
    ]

    projects = profile.get("projects") or []
    rendered_projects = []
    for proj in projects:
        tech_list = [escape_latex(t) for t in proj.get("tech", [])]
        rendered_projects.append(
            {
                "title": escape_latex(proj.get("title", "")),
                "tech_joined": ", ".join(tech_list),
                "date": escape_latex(proj.get("date", "")),
                "link": escape_latex(proj.get("link", "")) if proj.get("link") else "",
                "bullets": _resolve_bullets(proj, "project", selected_bullets),
            }
        )
    ctx["projects"] = rendered_projects

    skills = profile.get("skills") or []
    skill_lines = [
        r"\textbf{\textcolor{accent}{%s:}} %s"
        % (
            escape_latex(s.get("category", "")),
            ", ".join(escape_latex(item) for item in s.get("items", [])),
        )
        for s in skills
    ]
    ctx["skills"] = skills
    ctx["skills_block"] = " \\\\[3pt]\n    ".join(skill_lines)

    certifications = profile.get("certifications") or []
    ctx["certifications"] = [
        {
            "title": escape_latex(cert.get("title", "")),
            "org": escape_latex(cert.get("org", "")),
            "date": escape_latex(cert.get("date", "")),
        }
        for cert in certifications
    ]

    education = profile.get("education") or []
    ctx["education"] = [
        {
            "degree": escape_latex(edu.get("degree", "")),
            "org": escape_latex(edu.get("org", "")),
            "location": escape_latex(edu.get("location", "")),
            "dates": escape_latex(edu.get("dates", "")),
            "details": [escape_latex(d) for d in edu.get("details", [])],
        }
        for edu in education
    ]

    return ctx


def render_resume_tex(
    profile: dict, selected_bullets: Optional[dict[str, list[str]]] = None
) -> str:
    """Render a complete .tex document from a structured profile dict.

    `selected_bullets`, when given, maps "experience:<id>" / "project:<id>"
    to the list of bullet strings to render for that entry -- this is how
    Mode 2 injects the LLM-selected/reworded subset without changing how
    the .tex itself gets built.
    """
    template = _env.get_template("resume.tex.j2")
    context = _build_context(profile, selected_bullets)
    return template.render(**context)
