import json
from types import SimpleNamespace

import pytest
from google.genai.errors import APIError

from app.llm.base import Bullet, InvalidBulletSelectionError, LLMProviderError
from app.llm.gemini_provider import GeminiProvider


class FakeModels:
    """Stands in for client.models -- returns a canned .text attribute in
    the same shape the real Gemini response has, so GeminiProvider's
    parsing code is exercised without any network call."""

    def __init__(self, responses: list[str]):
        self._responses = responses
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        text = self._responses[len(self.calls) - 1]
        return SimpleNamespace(text=text)


class RaisingModels:
    def __init__(self, exc):
        self._exc = exc

    def generate_content(self, **kwargs):
        raise self._exc


class FakeGeminiClient:
    def __init__(self, responses: list[str]):
        self.models = FakeModels(responses)


def make_provider(responses: list[str]) -> GeminiProvider:
    return GeminiProvider(api_key="unused-in-tests", client=FakeGeminiClient(responses))


def test_extract_keywords_parses_structured_response():
    provider = make_provider([json.dumps({"keywords": ["python", "sql", "power bi"]})])

    result = provider.extract_keywords("Looking for a Python/SQL/PowerBI analyst.")

    assert result == ["python", "sql", "power bi"]


def test_extract_keywords_sends_json_response_schema():
    provider = make_provider([json.dumps({"keywords": []})])

    provider.extract_keywords("some jd")

    call = provider.client.models.calls[0]
    assert call["config"].response_mime_type == "application/json"
    assert call["config"].response_json_schema is not None


def test_select_and_rewrite_bullets_returns_validated_selections():
    bullets = [
        Bullet(id="b1", text="Automated reporting with Python", keywords=["python"]),
        Bullet(id="b2", text="Built dashboards in Power BI", keywords=["power bi"]),
    ]
    canned = json.dumps(
        {"selections": [{"bullet_id": "b1", "rewritten_text": "Automated Python pipelines"}]}
    )
    provider = make_provider([canned])

    result = provider.select_and_rewrite_bullets(bullets, jd_keywords=["python", "automation"])

    assert len(result) == 1
    assert result[0].bullet_id == "b1"
    assert result[0].rewritten_text == "Automated Python pipelines"


def test_select_and_rewrite_bullets_rejects_fabricated_bullet_id():
    bullets = [Bullet(id="b1", text="Automated reporting", keywords=["python"])]
    canned = json.dumps(
        {"selections": [{"bullet_id": "made-up-id", "rewritten_text": "fabricated content"}]}
    )
    provider = make_provider([canned])

    with pytest.raises(InvalidBulletSelectionError):
        provider.select_and_rewrite_bullets(bullets, jd_keywords=["python"])


def test_sdk_error_is_wrapped_as_llm_provider_error():
    provider = GeminiProvider(api_key="unused-in-tests", client=FakeGeminiClient([]))
    provider.client.models = RaisingModels(APIError(500, {"error": {"message": "boom"}}))

    with pytest.raises(LLMProviderError):
        provider.extract_keywords("some jd")
