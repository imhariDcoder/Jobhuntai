import json
from types import SimpleNamespace

import pytest
from anthropic import AnthropicError

from app.llm.anthropic_provider import AnthropicProvider
from app.llm.base import Bullet, InvalidBulletSelectionError, LLMProviderError


class FakeContentBlock:
    def __init__(self, text, type_="text"):
        self.type = type_
        self.text = text


class FakeMessages:
    """Stands in for client.messages -- returns canned text content in the
    same shape the real Anthropic response has, so AnthropicProvider's
    parsing code is exercised without any network call."""

    def __init__(self, responses: list[str]):
        self._responses = responses
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        content = self._responses[len(self.calls) - 1]
        return SimpleNamespace(content=[FakeContentBlock(content)])


class RaisingMessages:
    def __init__(self, exc):
        self._exc = exc

    def create(self, **kwargs):
        raise self._exc


class FakeAnthropicClient:
    def __init__(self, responses: list[str]):
        self.messages = FakeMessages(responses)


def make_provider(responses: list[str]) -> AnthropicProvider:
    return AnthropicProvider(api_key="unused-in-tests", client=FakeAnthropicClient(responses))


def test_extract_keywords_parses_structured_response():
    provider = make_provider([json.dumps({"keywords": ["python", "sql", "power bi"]})])

    result = provider.extract_keywords("Looking for a Python/SQL/PowerBI analyst.")

    assert result == ["python", "sql", "power bi"]


def test_extract_keywords_sends_json_schema_output_config():
    provider = make_provider([json.dumps({"keywords": []})])

    provider.extract_keywords("some jd")

    call = provider.client.messages.calls[0]
    assert call["output_config"]["format"]["type"] == "json_schema"


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
    provider = AnthropicProvider(api_key="unused-in-tests", client=FakeAnthropicClient([]))
    provider.client.messages = RaisingMessages(AnthropicError("invalid api key"))

    with pytest.raises(LLMProviderError):
        provider.extract_keywords("some jd")
