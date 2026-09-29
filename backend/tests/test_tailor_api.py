from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.llm.base import InvalidBulletSelectionError, LLMProviderError, SelectedBullet
from app.main import app
from fixtures.dummy_profile import DUMMY_PROFILE


class FakeProvider:
    """Stands in for a real provider so tests never hit any real API."""

    def __init__(self, api_key):
        self.api_key = api_key

    def extract_keywords(self, jd_text):
        return ["python", "automation"]

    def select_and_rewrite_bullets(self, bullets, jd_keywords):
        chosen = bullets[0]
        return [SelectedBullet(bullet_id=chosen.id, rewritten_text="Reworded to mirror the JD.")]


class RaisingProvider:
    def __init__(self, api_key, exc):
        self._exc = exc

    def extract_keywords(self, jd_text):
        raise self._exc

    def select_and_rewrite_bullets(self, bullets, jd_keywords):
        raise self._exc


@pytest.mark.parametrize("provider_name", ["openai", "anthropic", "gemini"])
def test_preview_endpoint_returns_review_data(provider_name):
    with TestClient(app) as client:
        client.put("/api/profile", json=DUMMY_PROFILE)

        with patch("app.main.get_provider", return_value=FakeProvider(api_key="fake")):
            resp = client.post(
                "/api/resume/tailor/preview",
                json={
                    "jd_text": "Looking for a Python analyst",
                    "provider": provider_name,
                    "api_key": "fake-key",
                },
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["jd_keywords"] == ["python", "automation"]
        assert len(body["diffs"]) == 1
        assert body["diffs"][0]["rewritten_text"] == "Reworded to mirror the JD."
        assert "selected_bullets" in body


def test_preview_endpoint_rejects_unknown_provider():
    with TestClient(app) as client:
        client.put("/api/profile", json=DUMMY_PROFILE)

        resp = client.post(
            "/api/resume/tailor/preview",
            json={"jd_text": "some jd", "provider": "not-a-real-provider", "api_key": "x"},
        )

        assert resp.status_code == 422


def test_preview_endpoint_returns_502_on_provider_error():
    with TestClient(app) as client:
        client.put("/api/profile", json=DUMMY_PROFILE)

        raising = RaisingProvider("fake", LLMProviderError("simulated connection failure"))

        with patch("app.main.get_provider", return_value=raising):
            resp = client.post(
                "/api/resume/tailor/preview",
                json={"jd_text": "some jd", "provider": "anthropic", "api_key": "fake-key"},
            )

        assert resp.status_code == 502
        assert "anthropic request failed" in resp.json()["detail"]


def test_preview_endpoint_returns_502_when_selection_fails_validation():
    with TestClient(app) as client:
        client.put("/api/profile", json=DUMMY_PROFILE)

        raising = RaisingProvider("fake", InvalidBulletSelectionError("unknown id"))

        with patch("app.main.get_provider", return_value=raising):
            resp = client.post(
                "/api/resume/tailor/preview",
                json={"jd_text": "some jd", "provider": "openai", "api_key": "fake-key"},
            )

        assert resp.status_code == 502
        assert "AI response could not be validated" in resp.json()["detail"]


def test_download_endpoint_renders_pdf_from_given_selection_without_llm_call():
    with TestClient(app) as client:
        client.put("/api/profile", json=DUMMY_PROFILE)

        # No provider patched at all -- download must never touch an LLM.
        resp = client.post(
            "/api/resume/tailor/download",
            json={"selected_bullets": {"experience:exp-1": ["A single reworded bullet."]}},
        )

        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert resp.content[:5] == b"%PDF-"
