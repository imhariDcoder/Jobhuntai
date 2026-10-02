"""Gemini implementation of LLMProvider.

Uses Gemini's structured-output feature (response_mime_type=
"application/json" + response_json_schema) to force the model's output
into a fixed shape, the same role response_format=json_schema plays for
OpenAIProvider.
"""

import json
from typing import Optional

from google import genai
from google.genai import types
from google.genai.errors import APIError

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


class GeminiProvider(LLMProvider):
    def __init__(
        self,
        api_key: str,
        model: str = "gemini-3.6-flash",
        client: Optional[genai.Client] = None,
    ):
        """`api_key` is used to construct the client for this instance only
        -- it is never written to disk or a database."""
        self.client = client or genai.Client(api_key=api_key)
        self.model = model

    def _generate_json(self, *, system_instruction: str, contents: str, schema: dict) -> dict:
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_json_schema=schema,
                ),
            )
        except APIError as e:
            raise LLMProviderError(str(e)) from e

        return json.loads(response.text)

    def extract_keywords(self, jd_text: str) -> list[str]:
        data = self._generate_json(
            system_instruction=EXTRACT_KEYWORDS_SYSTEM_PROMPT,
            contents=jd_text,
            schema=_KEYWORDS_SCHEMA,
        )
        return data["keywords"]

    def select_and_rewrite_bullets(
        self, bullets: list[Bullet], jd_keywords: list[str]
    ) -> list[SelectedBullet]:
        bullets_payload = [
            {"bullet_id": b.id, "text": b.text, "keywords": b.keywords} for b in bullets
        ]
        data = self._generate_json(
            system_instruction=SHARED_SELECT_AND_REWRITE_SYSTEM_PROMPT,
            contents=json.dumps({"bullets": bullets_payload, "job_keywords": jd_keywords}),
            schema=_SELECTIONS_SCHEMA,
        )
        self.last_honesty_note = data.get("honesty_note", "")
        selections = [
            SelectedBullet(
                bullet_id=s["bullet_id"],
                rewritten_text=clean_bullet_text(s["rewritten_text"]),
            )
            for s in data["selections"]
        ]
        return validate_selected_bullets(bullets, selections)
