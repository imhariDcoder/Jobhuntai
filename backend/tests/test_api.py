import copy

from fastapi.testclient import TestClient

from app.main import app
from fixtures.dummy_profile import DUMMY_PROFILE


def _as_api_payload(profile: dict) -> dict:
    """DUMMY_PROFILE's bullets are {id, text, keywords}; the API's Bullet
    schema uses the same shape, so this is a passthrough deepcopy for clarity
    at the call site without mutating the shared fixture."""
    return copy.deepcopy(profile)


def test_put_then_get_profile_roundtrips():
    with TestClient(app) as client:
        resp = client.put("/api/profile", json=_as_api_payload(DUMMY_PROFILE))
        assert resp.status_code == 200

        resp = client.get("/api/profile")
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Jordan A. Smith"
        assert len(body["experience"]) == 2
        assert body["experience"][0]["bullets"][0]["text"].startswith("Automated a 40-hour")
        assert len(body["projects"]) == 1
        assert len(body["skills"]) == 2


def test_render_resume_produces_a_pdf():
    with TestClient(app) as client:
        client.put("/api/profile", json=_as_api_payload(DUMMY_PROFILE))

        resp = client.post("/api/resume/render")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert resp.content[:5] == b"%PDF-"


def test_render_resume_with_payload_produces_a_pdf():
    with TestClient(app) as client:
        payload = _as_api_payload(DUMMY_PROFILE)
        payload["name"] = "Alice Live Tester"
        resp = client.post("/api/resume/render", json=payload)
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert resp.content[:5] == b"%PDF-"
        assert "Alice_Live_Tester_Resume.pdf" in resp.headers.get("content-disposition", "")


def test_put_replaces_previous_data_entirely():
    with TestClient(app) as client:
        client.put("/api/profile", json=_as_api_payload(DUMMY_PROFILE))

        minimal = {"name": "Only A Name"}
        resp = client.put("/api/profile", json=minimal)
        assert resp.status_code == 200

        resp = client.get("/api/profile")
        body = resp.json()
        assert body["name"] == "Only A Name"
        assert body["experience"] == []
        assert body["projects"] == []


def test_page_routes_serve_html():
    with TestClient(app) as client:
        for path in ["/", "/jd", "/kage"]:
            resp = client.get(path)
            assert resp.status_code == 200
            assert "text/html" in resp.headers["content-type"]
            assert b"SmartJob" in resp.content or b"Kage" in resp.content


def test_categorize_skills_api():
    with TestClient(app) as client:
        resp = client.post(
            "/api/skills/categorize",
            json={
                "skills": ["SQL queries", "Git", "Docker", "Tableau"],
                "existing_categories": ["Programming Languages", "Tools"],
            },
        )
        assert resp.status_code == 200
        data = resp.json()["assignments"]
        assert data["SQL queries"] == "Programming Languages"
        assert data["Git"] == "Tools"
        assert data["Docker"] == "Cloud & DevOps"
        assert data["Tableau"] == "BI & Visualization"

