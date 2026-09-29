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
