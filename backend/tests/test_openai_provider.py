import json
from types import SimpleNamespace

import pytest
from openai import APIConnectionError

from app.llm.base import Bullet, InvalidBulletSelectionError, LLMProviderError
from app.llm.openai_provider import OpenAIProvider


class FakeCompletions:
    """Stands in for client.chat.completions -- returns canned JSON content
    in the same shape the real OpenAI SDK response has, so OpenAIProvider's
    parsing code is exercised without any network call."""

    def __init__(self, responses: list[str]):
        self._responses = responses
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        content = self._responses[len(self.calls) - 1]
        message = SimpleNamespace(content=content)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class RaisingCompletions:
    def __init__(self, exc):
        self._exc = exc

    def create(self, **kwargs):
        raise self._exc


class FakeOpenAIClient:
    def __init__(self, responses: list[str]):
        self.chat = SimpleNamespace(completions=FakeCompletions(responses))


def make_provider(responses: list[str]) -> OpenAIProvider:
    return OpenAIProvider(api_key="unused-in-tests", client=FakeOpenAIClient(responses))


def test_extract_keywords_parses_structured_response():
    provider = make_provider([json.dumps({"keywords": ["python", "sql", "power bi"]})])

    result = provider.extract_keywords("Looking for a Python/SQL/PowerBI analyst.")

    assert result == ["python", "sql", "power bi"]


def test_extract_keywords_sends_json_schema_response_format():
    provider = make_provider([json.dumps({"keywords": []})])

    provider.extract_keywords("some jd")

    call = provider.client.chat.completions.calls[0]
    assert call["response_format"]["type"] == "json_schema"


def test_select_and_rewrite_bullets_returns_validated_selections():
    bullets = [
        Bullet(id="b1", text="Automated reporting with Python", keywords=["python"]),
        Bullet(id="b2", text="Built dashboards in Power BI", keywords=["power bi"]),
    ]
    canned = json.dumps(
        {
            "selections": [
                {"bullet_id": "b1", "rewritten_text": "Automated Python-based reporting pipelines"},
            ]
        }
    )
    provider = make_provider([canned])

    result = provider.select_and_rewrite_bullets(bullets, jd_keywords=["python", "automation"])

    assert len(result) == 1
    assert result[0].bullet_id == "b1"
    assert result[0].rewritten_text == "Automated Python-based reporting pipelines"


def test_select_and_rewrite_bullets_rejects_fabricated_bullet_id():
    bullets = [Bullet(id="b1", text="Automated reporting", keywords=["python"])]
    canned = json.dumps(
        {"selections": [{"bullet_id": "made-up-id", "rewritten_text": "fabricated content"}]}
    )
    provider = make_provider([canned])

    with pytest.raises(InvalidBulletSelectionError):
        provider.select_and_rewrite_bullets(bullets, jd_keywords=["python"])


def test_select_and_rewrite_bullets_sends_only_known_bullet_ids_to_the_model():
    bullets = [Bullet(id="b1", text="did a thing", keywords=["x"])]
    provider = make_provider([json.dumps({"selections": []})])

    provider.select_and_rewrite_bullets(bullets, jd_keywords=["x"])

    call = provider.client.chat.completions.calls[0]
    user_message = next(m for m in call["messages"] if m["role"] == "user")
    sent_payload = json.loads(user_message["content"])
    assert sent_payload["bullets"] == [{"bullet_id": "b1", "text": "did a thing", "keywords": ["x"]}]


def test_sdk_error_is_wrapped_as_llm_provider_error():
    import httpx

    provider = OpenAIProvider(api_key="unused-in-tests", client=FakeOpenAIClient([]))
    fake_request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    provider.client.chat.completions = RaisingCompletions(APIConnectionError(request=fake_request))

    with pytest.raises(LLMProviderError):
        provider.extract_keywords("some jd")
