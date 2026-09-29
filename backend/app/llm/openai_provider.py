"""OpenAI implementation of LLMProvider.

Uses OpenAI's structured-output JSON mode (response_format=json_schema,
strict=True) to force the model's output into a fixed shape, rather than
relying on prompt instructions alone to produce parseable JSON.
"""

import json
from typing import Optional

from openai import OpenAI, OpenAIError

from app.llm.base import (
    Bullet,
    LLMProvider,
    LLMProviderError,
    SelectedBullet,
    validate_selected_bullets,
)

_KEYWORDS_SCHEMA = {
    "name": "extracted_keywords",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "keywords": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["keywords"],
        "additionalProperties": False,
    },
}

_SELECTIONS_SCHEMA = {
    "name": "bullet_selections",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "selections": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "bullet_id": {"type": "string"},
                        "rewritten_text": {"type": "string"},
                    },
                    "required": ["bullet_id", "rewritten_text"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["selections"],
        "additionalProperties": False,
    },
}


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gpt-4o-mini", client: Optional[OpenAI] = None):
        """`api_key` is used to construct the client for this instance only
        -- it is never written to disk or a database, matching the v1 spec
        constraint that a user's LLM key is per-request/session only."""
        self.client = client or OpenAI(api_key=api_key)
        self.model = model

    def _create(self, **kwargs):
        try:
            return self.client.chat.completions.create(**kwargs)
        except OpenAIError as e:
            raise LLMProviderError(str(e)) from e

    def extract_keywords(self, jd_text: str) -> list[str]:
        response = self._create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You extract ATS-relevant keywords (skills, tools, "
                        "role titles, domain terms) from a job description. "
                        "Return only terms that actually appear in or are "
                        "clearly implied by the text."
                    ),
                },
                {"role": "user", "content": jd_text},
            ],
            response_format={"type": "json_schema", "json_schema": _KEYWORDS_SCHEMA},
        )
        data = json.loads(response.choices[0].message.content)
        return data["keywords"]

    def select_and_rewrite_bullets(
        self, bullets: list[Bullet], jd_keywords: list[str]
    ) -> list[SelectedBullet]:
        bullets_payload = [
            {"bullet_id": b.id, "text": b.text, "keywords": b.keywords} for b in bullets
        ]

        response = self._create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You help tailor a resume to a job description. You "
                        "are given the candidate's real, existing resume "
                        "bullets (each with a bullet_id) and a list of "
                        "keywords extracted from the job description.\n\n"
                        "Select only the bullets that are a good fit for "
                        "this job -- not necessarily all of them. For each "
                        "selected bullet, rewrite its text to mirror the "
                        "job description's language and terminology, but "
                        "do NOT invent new facts, numbers, tools, or claims "
                        "that are not already present in the original "
                        "bullet text. This is a rewording of existing "
                        "content, not new content.\n\n"
                        "Every bullet_id you return MUST be one of the "
                        "bullet_id values you were given -- never invent a "
                        "bullet_id."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {"bullets": bullets_payload, "job_keywords": jd_keywords}
                    ),
                },
            ],
            response_format={"type": "json_schema", "json_schema": _SELECTIONS_SCHEMA},
        )
        data = json.loads(response.choices[0].message.content)
        selections = [
            SelectedBullet(bullet_id=s["bullet_id"], rewritten_text=s["rewritten_text"])
            for s in data["selections"]
        ]
        return validate_selected_bullets(bullets, selections)
