"""Provider-agnostic LLM interface for JD keyword extraction and bullet
selection/rewriting.

The LLM never writes original resume content: `select_and_rewrite_bullets`
only ever rewords bullets the user already wrote, and its output is
validated against the real input ids at the code level (see
`validate_selected_bullets`) -- not just via prompt instructions -- so a
provider can never smuggle in fabricated bullets.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class Bullet:
    id: str
    text: str
    keywords: list[str]


@dataclass
class SelectedBullet:
    bullet_id: str
    rewritten_text: str


class LLMProvider(ABC):
    @abstractmethod
    def extract_keywords(self, jd_text: str) -> list[str]:
        """Extract ATS-style keywords/skills from a job description."""

    @abstractmethod
    def select_and_rewrite_bullets(
        self, bullets: list[Bullet], jd_keywords: list[str]
    ) -> list[SelectedBullet]:
        """Pick the best-fit subset of `bullets` for the JD and reword them
        to mirror its language, without inventing new claims."""


class InvalidBulletSelectionError(ValueError):
    """Raised when a provider's response references a bullet_id that was
    never in the input -- i.e. it looks like fabricated content."""


class LLMProviderError(Exception):
    """Raised by a provider when the underlying API call itself fails
    (bad key, rate limit, network, etc). Concrete providers catch their
    own SDK's exception types and re-raise this, so callers only need to
    handle one error type regardless of which provider is in use."""


def validate_selected_bullets(
    bullets: list[Bullet], selections: list[SelectedBullet]
) -> list[SelectedBullet]:
    known_ids = {b.id for b in bullets}
    unknown = [s.bullet_id for s in selections if s.bullet_id not in known_ids]
    if unknown:
        raise InvalidBulletSelectionError(
            f"response referenced unknown bullet_id(s): {unknown}"
        )
    return selections


import re

EXTRACT_KEYWORDS_SYSTEM_PROMPT = (
    "You are a career document and ATS specialist. Extract ATS-relevant requirements from the job description.\n"
    "Pull out: required technical skills, tools/technologies, seniority signals, domain language, and repeated phrases "
    "(JD language repeated 2+ times is almost always a critical ATS keyword).\n"
    "Note the exact terminology used (e.g., 'stakeholder management' and 'cross-functional collaboration' are not interchangeable to an ATS).\n"
    "Return only terms that actually appear in or are directly required by the text."
)

SHARED_SELECT_AND_REWRITE_SYSTEM_PROMPT = (
    "You are a career document specialist. Your job is to tailor a candidate's existing CV to a specific "
    "job description (JD), without inventing anything and without sounding like an AI wrote it.\n\n"
    "MASTER INSTRUCTIONS:\n\n"
    "1. Requirement Cross-Referencing & Classification:\n"
    "   Cross-reference JD requirements against candidate experience into three strict buckets:\n"
    "   - Direct match: candidate has this, described in different words. Rewrite using the JD's exact terminology.\n"
    "   - Adjacent match: candidate has related experience, not exact. Bridge it honestly (e.g., 'familiar with X' not 'expert in X') — NEVER upgrade the claim.\n"
    "   - Gap: candidate has no evidence of this. Do NOT add it, imply it, or word around it. Leave it out.\n\n"
    "2. Rewriting & Truthfulness:\n"
    "   - Keep the original structure: same sections, same overall length. This is a re-tune of existing bullets, NOT a rebuild.\n"
    "   - Strictly preserve all real metrics, tools, dates, and outcomes from the original bullets. NEVER invent or manufacture numbers, metrics, tools, or job titles if the original CV has none.\n"
    "   - Where a direct or adjacent match exists, weave the JD's exact phrasing into the existing bullet — do NOT bolt on a keyword list at the bottom.\n"
    "   - Preserve the candidate's actual voice and level of formality from the original CV. If they write short and blunt, keep it short and blunt.\n\n"
    "3. STRIP EVERY AI TELL (NON-NEGOTIABLE):\n"
    "   - BAN THESE WORDS AND PHRASES ENTIRELY: leverage, utilize, spearheaded, orchestrated, robust, seamless, dynamic, synergy, cutting-edge, results-driven, proven track record, passionate about, delve, tapestry, testament to, unlock, elevate, holistic, game-changer, in today's fast-paced.\n"
    "   - Do NOT give every bullet the same rhythm ('Verb + task + resulting in X%'). Vary sentence length and structure the way an actual human résumé does — some bullets are short, some are slightly longer, not all metric-capped.\n"
    "   - NO em-dash overuse. NO triple-adjective stacking ('innovative, agile, forward-thinking').\n"
    "   - NO generic transitions or summary-speak that reads like a LinkedIn bio ('A dedicated professional with X years...').\n\n"
    "4. Formatting Consistency (CRITICAL):\n"
    "   - Output pure plain text ONLY (NO bold **...**, NO italics *...*, NO backticks).\n"
    "   - Do NOT include bullet characters, dashes, or numbering at start of bullets (NO '•', '-', '*').\n"
    "   - Start each bullet with an active verb matching the candidate's tone.\n"
    "   - End every bullet with a period '.' consistently.\n\n"
    "5. Output Constraints:\n"
    "   - Every bullet_id you return MUST be one of the exact bullet_id values you were given. Never invent a bullet_id.\n"
    "   - For each relevant role or project, select 1 to 3 bullets so the resume remains balanced and complete. If a role or project has zero relevance, do not select any bullets for it."
)


def clean_bullet_text(text: str) -> str:
    """Normalize bullet text to remove markdown, bullet glyphs, and extra whitespace."""
    if not text:
        return ""
    cleaned = text.strip()
    # Strip leading bullet/dash markers like •, -, —, or * followed by space
    cleaned = re.sub(r"^\s*([•\-–—]|\*(?=\s))\s*", "", cleaned)
    # Strip markdown bold asterisks
    cleaned = re.sub(r"\*\*([^*]+)\*\*", r"\1", cleaned)
    # Strip markdown italic asterisks
    cleaned = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"\1", cleaned)
    return cleaned.strip()

