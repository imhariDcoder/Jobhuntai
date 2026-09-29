"""Maps a provider name (as chosen by the user in the JD-paste page) to a
concrete LLMProvider, constructed fresh per request with that request's
own API key."""

from app.llm.anthropic_provider import AnthropicProvider
from app.llm.base import LLMProvider
from app.llm.gemini_provider import GeminiProvider
from app.llm.openai_provider import OpenAIProvider

PROVIDERS = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "gemini": GeminiProvider,
}


def get_provider(name: str, api_key: str) -> LLMProvider:
    try:
        provider_cls = PROVIDERS[name]
    except KeyError:
        raise ValueError(f"Unknown LLM provider: {name!r}") from None
    return provider_cls(api_key=api_key)
