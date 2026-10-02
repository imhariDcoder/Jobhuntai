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
    EXTRACT_KEYWORDS_SYSTEM_PROMPT,
    LLMProvider,
    LLMProviderError,
    SelectedBullet,
    SHARED_SELECT_AND_REWRITE_SYSTEM_PROMPT,
    clean_bullet_text,
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
                    "content": EXTRACT_KEYWORDS_SYSTEM_PROMPT,
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
                    "content": SHARED_SELECT_AND_REWRITE_SYSTEM_PROMPT,
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
        self.last_honesty_note = data.get("honesty_note", "")
        selections = [
            SelectedBullet(
                bullet_id=s["bullet_id"],
                rewritten_text=clean_bullet_text(s["rewritten_text"]),
            )
            for s in data["selections"]
        ]
        return validate_selected_bullets(bullets, selections)
