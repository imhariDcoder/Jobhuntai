import pytest

from app.llm.anthropic_provider import AnthropicProvider
from app.llm.factory import get_provider
from app.llm.gemini_provider import GeminiProvider
from app.llm.openai_provider import OpenAIProvider


@pytest.mark.parametrize(
    "name,expected_cls",
    [
        ("openai", OpenAIProvider),
        ("anthropic", AnthropicProvider),
        ("gemini", GeminiProvider),
    ],
)
def test_get_provider_dispatches_to_correct_class(name, expected_cls):
    provider = get_provider(name, api_key="unused-in-tests")

    assert isinstance(provider, expected_cls)


def test_get_provider_rejects_unknown_name():
    with pytest.raises(ValueError):
        get_provider("not-a-real-provider", api_key="unused-in-tests")
