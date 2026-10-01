"""Anthropic implementation of LLMProvider.

Uses Claude's structured-output feature (output_config.format =
json_schema) to force the model's output into a fixed shape, the same
role response_format=json_schema plays for OpenAIProvider.
"""

import json
from typing import Optional

from anthropic import Anthropic, AnthropicError

from app.llm.base import (
    Bullet,
    LLMProvider,
    LLMProviderError,
    SelectedBullet,
    SHARED_SELECT_AND_REWRITE_SYSTEM_PROMPT,
    clean_bullet_text,
    validate_selected_bullets,
)

_KEYWORDS_SCHEMA = {
    "type": "object",
    "properties": {
        "keywords": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["keywords"],
    "additionalProperties": False,
}

_SELECTIONS_SCHEMA = {
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
}


class AnthropicProvider(LLMProvider):
    def __init__(
        self,
        api_key: str,
        model: str = "claude-haiku-4-5-20251001",
        client: Optional[Anthropic] = None,
    ):
        """`api_key` is used to construct the client for this instance only
        -- it is never written to disk or a database."""
        self.client = client or Anthropic(api_key=api_key)
        self.model = model

    def _create_json(self, *, system: str, user_content: str, schema: dict) -> dict:
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2048,
                system=system,
                messages=[{"role": "user", "content": user_content}],
                output_config={"format": {"type": "json_schema", "schema": schema}},
            )
        except AnthropicError as e:
            raise LLMProviderError(str(e)) from e

        text_block = next(b for b in response.content if b.type == "text")
        return json.loads(text_block.text)

    def extract_keywords(self, jd_text: str) -> list[str]:
        data = self._create_json(
            system=(
                "You extract ATS-relevant keywords (skills, tools, role "
                "titles, domain terms) from a job description. Return only "
                "terms that actually appear in or are clearly implied by "
                "the text."
            ),
            user_content=jd_text,
            schema=_KEYWORDS_SCHEMA,
        )
        return data["keywords"]

    def select_and_rewrite_bullets(
        self, bullets: list[Bullet], jd_keywords: list[str]
    ) -> list[SelectedBullet]:
        bullets_payload = [
            {"bullet_id": b.id, "text": b.text, "keywords": b.keywords} for b in bullets
        ]
        data = self._create_json(
            system=SHARED_SELECT_AND_REWRITE_SYSTEM_PROMPT,
            user_content=json.dumps({"bullets": bullets_payload, "job_keywords": jd_keywords}),
            schema=_SELECTIONS_SCHEMA,
        )
        selections = [
            SelectedBullet(
                bullet_id=s["bullet_id"],
                rewritten_text=clean_bullet_text(s["rewritten_text"]),
            )
            for s in data["selections"]
        ]
        return validate_selected_bullets(bullets, selections)
