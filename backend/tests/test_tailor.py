from app.llm.base import Bullet, SelectedBullet
from app.tailor import compute_keyword_coverage, tailor_profile


class FakeProvider:
    def __init__(self, keywords, selections):
        self._keywords = keywords
        self._selections = selections
        self.extract_keywords_calls = []
        self.select_calls = []

    def extract_keywords(self, jd_text):
        self.extract_keywords_calls.append(jd_text)
        return self._keywords

    def select_and_rewrite_bullets(self, bullets, jd_keywords):
        self.select_calls.append((bullets, jd_keywords))
        return self._selections


PROFILE = {
    "experience": [
        {
            "id": "exp-1",
            "role": "Data Analyst",
            "org": "Acme Analytics Inc.",
            "bullets": [
                {"id": "b1", "text": "did thing one", "keywords": ["a"]},
                {"id": "b2", "text": "did thing two", "keywords": ["b"]},
            ],
        },
        {
            "id": "exp-2",
            "role": "Intern",
            "org": "Other Co",
            "bullets": [{"id": "b3", "text": "did thing three", "keywords": ["c"]}],
        },
    ],
    "projects": [
        {
            "id": "proj-1",
            "title": "Retail Forecast",
            "bullets": [{"id": "b4", "text": "built a thing", "keywords": ["d"]}],
        }
    ],
    "skills": [{"category": "Languages", "items": ["Python", "SQL"]}],
}


def test_selected_bullets_grouped_by_original_entry():
    provider = FakeProvider(
        keywords=["python"],
        selections=[
            SelectedBullet(bullet_id="b1", rewritten_text="reworded thing one"),
            SelectedBullet(bullet_id="b4", rewritten_text="reworded built thing"),
        ],
    )

    result = tailor_profile(PROFILE, "some jd text", provider)

    assert result.selected_bullets == {
        "experience:exp-1": ["reworded thing one"],
        "experience:exp-2": [],
        "project:proj-1": ["reworded built thing"],
    }


def test_entry_with_no_selected_bullets_gets_empty_list_not_fallback():
    provider = FakeProvider(keywords=[], selections=[])

    result = tailor_profile(PROFILE, "jd", provider)

    assert result.selected_bullets["experience:exp-2"] == []


def test_diffs_capture_original_and_rewritten_text_with_entry_label():
    provider = FakeProvider(
        keywords=["python"],
        selections=[SelectedBullet(bullet_id="b1", rewritten_text="reworded thing one")],
    )

    result = tailor_profile(PROFILE, "jd", provider)

    assert len(result.diffs) == 1
    diff = result.diffs[0]
    assert diff.bullet_id == "b1"
    assert diff.entry_kind == "experience"
    assert diff.entry_label == "Data Analyst @ Acme Analytics Inc."
    assert diff.original_text == "did thing one"
    assert diff.rewritten_text == "reworded thing one"


def test_all_bullet_texts_sent_to_provider_are_from_the_profile():
    provider = FakeProvider(keywords=["x"], selections=[])

    tailor_profile(PROFILE, "jd", provider)

    sent_bullets, sent_keywords = provider.select_calls[0]
    sent_ids = {b.id for b in sent_bullets}
    assert sent_ids == {"b1", "b2", "b3", "b4"}
    assert sent_keywords == ["x"]


def test_empty_profile_skips_llm_calls_entirely():
    provider = FakeProvider(keywords=["should not be used"], selections=[])

    result = tailor_profile({"experience": [], "projects": []}, "jd", provider)

    assert result.selected_bullets == {}
    assert result.jd_keywords == []
    assert provider.extract_keywords_calls == []
    assert provider.select_calls == []


def test_match_score_is_fraction_of_jd_keywords_covered():
    provider = FakeProvider(keywords=["python", "sql", "kubernetes"], selections=[])

    result = tailor_profile(PROFILE, "jd", provider)

    assert result.matched_keywords == ["python", "sql"]
    assert result.missing_keywords == ["kubernetes"]
    assert result.match_score == 2 / 3


def test_match_score_is_zero_when_no_jd_keywords_extracted():
    provider = FakeProvider(keywords=[], selections=[])

    result = tailor_profile(PROFILE, "jd", provider)

    assert result.match_score == 0.0


def test_compute_keyword_coverage_is_case_insensitive():
    matched, missing = compute_keyword_coverage(PROFILE, ["PYTHON", "Kubernetes"])

    assert matched == ["PYTHON"]
    assert missing == ["Kubernetes"]


def test_compute_keyword_coverage_checks_skill_category_too():
    matched, _ = compute_keyword_coverage(PROFILE, ["Languages"])

    assert matched == ["Languages"]
