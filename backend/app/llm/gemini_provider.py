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
    LLMProvider,
    LLMProviderError,
    SelectedBullet,
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

_SELECT_AND_REWRITE_SYSTEM_PROMPT = (
    "You help tailor a resume to a job description. You are given the "
    "candidate's real, existing resume bullets (each with a bullet_id) "
    "and a list of keywords extracted from the job description.\n\n"
    "Select only the bullets that are a good fit for this job -- not "
    "necessarily all of them. For each selected bullet, rewrite its text "
    "to mirror the job description's language and terminology, but do "
    "NOT invent new facts, numbers, tools, or claims that are not already "
    "present in the original bullet text. This is a rewording of "
    "existing content, not new content.\n\n"
    "Every bullet_id you return MUST be one of the bullet_id values you "
    "were given -- never invent a bullet_id."
)


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
            system_instruction=(
                "You extract ATS-relevant keywords (skills, tools, role "
                "titles, domain terms) from a job description. Return only "
                "terms that actually appear in or are clearly implied by "
                "the text."
            ),
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
            system_instruction=_SELECT_AND_REWRITE_SYSTEM_PROMPT,
            contents=json.dumps({"bullets": bullets_payload, "job_keywords": jd_keywords}),
            schema=_SELECTIONS_SCHEMA,
        )
        selections = [
            SelectedBullet(bullet_id=s["bullet_id"], rewritten_text=s["rewritten_text"])
            for s in data["selections"]
        ]
        return validate_selected_bullets(bullets, selections)
