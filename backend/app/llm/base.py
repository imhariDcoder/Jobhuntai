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

SHARED_SELECT_AND_REWRITE_SYSTEM_PROMPT = (
    "You are a professional resume tailoring assistant. You are given the candidate's "
    "real, existing resume bullets (each with a bullet_id) and keywords extracted from a target job description.\n\n"
    "Your instructions:\n"
    "1. Selection & Distribution:\n"
    "   - Select bullets that best match the job description requirements and domain.\n"
    "   - For each relevant role or project, select 1 to 3 bullets so the resume remains balanced and complete.\n"
    "   - If an entire project or role has zero relevance to the target job, do not select any bullets for it.\n"
    "2. Rewording Rules:\n"
    "   - Rewrite each selected bullet to naturally incorporate the job description's terminology and keywords.\n"
    "   - Strictly preserve all real metrics, numbers, technologies, and outcomes from the original bullet. NEVER fabricate facts, tools, or metrics.\n"
    "   - Ban AI buzzwords: do NOT use words like 'leveraged', 'spearheaded', 'orchestrated', 'utilized', 'synergy', 'cutting-edge', 'streamlined', 'robust', 'seamless', 'dynamic'.\n"
    "3. Formatting Consistency (CRITICAL):\n"
    "   - Output pure plain text ONLY. Do NOT use Markdown formatting (NO bold **...**, NO italics *...*, NO backticks).\n"
    "   - Do NOT include bullet characters, dashes, or numbering at the start of bullets (NO '•', '-', '*').\n"
    "   - Start each bullet with a strong action verb.\n"
    "   - End every bullet with a period '.' consistently.\n\n"
    "4. Constraints:\n"
    "   - Every bullet_id you return MUST be one of the exact bullet_id values you were given. Never invent a bullet_id."
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

