import copy

from app.latex.injector import render_resume_tex
from fixtures.dummy_profile import DUMMY_PROFILE


def test_renders_full_dummy_profile_without_error():
    tex = render_resume_tex(DUMMY_PROFILE)
    assert tex.startswith("%")
    assert r"\begin{document}" in tex
    assert r"\end{document}" in tex
    assert "Jordan A. Smith" in tex


def test_user_supplied_text_is_escaped():
    profile = copy.deepcopy(DUMMY_PROFILE)
    profile["summary"] = "Grew revenue 20% & cut costs using C#"
    tex = render_resume_tex(profile)
    assert r"Grew revenue 20\% \& cut costs using C\#" in tex
    assert "20% &" not in tex


def test_experience_label_is_experience_when_job_present():
    tex = render_resume_tex(DUMMY_PROFILE)
    assert r"\section{Experience}" in tex


def test_experience_label_is_training_when_only_training_entries():
    profile = copy.deepcopy(DUMMY_PROFILE)
    profile["experience"] = [e for e in profile["experience"] if e["type"] == "training"]
    tex = render_resume_tex(profile)
    assert r"\section{Training \& Applied Learning}" in tex
    assert r"\section{Experience}" not in tex


def test_experience_section_omitted_when_empty():
    profile = copy.deepcopy(DUMMY_PROFILE)
    profile["experience"] = []
    tex = render_resume_tex(profile)
    assert r"\section{Experience}" not in tex
    assert r"\section{Training \& Applied Learning}" not in tex


def test_optional_sections_omitted_when_empty():
    profile = copy.deepcopy(DUMMY_PROFILE)
    profile["projects"] = []
    profile["certifications"] = []
    profile["skills"] = []
    tex = render_resume_tex(profile)
    assert r"\section{Projects}" not in tex
    assert r"\section{Certifications}" not in tex
    assert r"\section{Technical Skills}" not in tex
    # Sections that still have data remain.
    assert r"\section{Education}" in tex


def test_selected_bullets_override_replaces_entry_bullets():
    override = {"experience:exp-1": ["A single reworded bullet for the JD."]}
    tex = render_resume_tex(DUMMY_PROFILE, selected_bullets=override)
    assert "A single reworded bullet for the JD." in tex
    # The original bullets for exp-1 should not appear.
    assert "Automated a 40-hour" not in tex
    # exp-2 (untouched by the override) keeps its stored bullets.
    assert "Completed 20+ courses" in tex


def test_selected_bullets_override_only_affects_matching_id():
    override = {"project:proj-1": ["Rewritten project bullet."]}
    tex = render_resume_tex(DUMMY_PROFILE, selected_bullets=override)
    assert "Rewritten project bullet." in tex
    assert "Built a demand forecasting model" not in tex
    # Experience bullets are untouched.
    assert "Automated a 40-hour" in tex


def test_project_tech_stack_line_renders_when_tech_present():
    # Regression test: the template used to check `proj.tech`, which the
    # injector never sets (only `proj.tech_joined`), so this line was
    # silently dropped for every project regardless of stored tech data.
    tex = render_resume_tex(DUMMY_PROFILE)
    assert r"Python, Pandas, scikit-learn" in tex
    assert r"$|$ \textcolor{accent}{\emph{Python, Pandas, scikit-learn}}" in tex


def test_project_tech_stack_line_omitted_when_no_tech():
    profile = copy.deepcopy(DUMMY_PROFILE)
    profile["projects"][0]["tech"] = []
    tex = render_resume_tex(profile)
    assert r"\textcolor{accent}{\emph{" not in tex


def test_tailored_empty_bullets_entry_is_omitted_without_orphan_heading():
    # When tailoring, if an entry has 0 selected bullets, its heading should be
    # omitted rather than rendered as an orphan heading with blank space.
    override = {
        "experience:exp-1": ["Only exp-1 bullet."],
        "experience:exp-2": [],
        "project:proj-1": [],
    }
    tex = render_resume_tex(DUMMY_PROFILE, selected_bullets=override)
    assert "Only exp-1 bullet." in tex
    assert "Data Analytics Career Track" not in tex
    assert "Retail Sales Forecasting" not in tex


def test_tailored_skills_override_renders_custom_skills():
    tailored_skills = [
        {"category": "Data & BI", "items": ["Power BI", "Tableau", "SQL"]},
        {"category": "Omitted Category", "items": []},
    ]
    tex = render_resume_tex(DUMMY_PROFILE, tailored_skills=tailored_skills)
    assert r"Data \& BI" in tex
    assert "Power BI, Tableau, SQL" in tex
    # Old languages category from DUMMY_PROFILE should not be present
    assert "Languages & Tools" not in tex
    assert "Omitted Category" not in tex


