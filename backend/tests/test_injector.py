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
