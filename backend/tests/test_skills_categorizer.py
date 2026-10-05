from app.skills_categorizer import (
    classify_skill,
    classify_skills_batch,
    clean_and_redistribute_skills,
)


def test_classify_skill_matches_existing_category():
    existing = [
        "Programming & Query Languages",
        "BI & Visualization",
        "Data & Databases",
        "Tools",
        "Concepts",
    ]

    assert classify_skill("Python", existing) == "Programming & Query Languages"
    assert classify_skill("SQL queries", existing) == "Programming & Query Languages"
    assert classify_skill("Tableau", existing) == "BI & Visualization"
    assert classify_skill("executive BI dashboards", existing) == "BI & Visualization"
    assert classify_skill("Snowflake", existing) == "Data & Databases"
    assert classify_skill("data extraction", existing) == "Data & Databases"
    assert classify_skill("Git", existing) == "Tools"
    assert classify_skill("Jira", existing) == "Tools"
    assert classify_skill("Agile / Scrum", existing) == "Concepts"
    assert classify_skill("exploratory data analysis", existing) == "Concepts"


def test_classify_skill_creates_specific_domain_category_when_not_in_profile():
    # User only has Languages and Tools
    existing = ["Languages", "Tools"]

    # Cloud skills should create a specific domain category, not a generic bucket
    cloud_cat = classify_skill("AWS", existing)
    assert cloud_cat == "Cloud & DevOps"

    docker_cat = classify_skill("Docker", existing)
    assert docker_cat in ("Cloud & DevOps", "Tools")

    # Testing skill should create Testing & Automation
    test_cat = classify_skill("Selenium", existing)
    assert test_cat == "Testing & Automation"

    # ML skill should create Machine Learning & AI
    ml_cat = classify_skill("TensorFlow", existing)
    assert ml_cat == "Machine Learning & AI"


def test_classify_skills_batch():
    existing = ["Programming Languages", "Tools"]
    skills = ["Python", "AWS", "Jira"]
    batch = classify_skills_batch(skills, existing)

    assert batch["Python"] == "Programming Languages"
    assert batch["AWS"] == "Cloud & DevOps"
    assert batch["Jira"] == "Tools"


def test_clean_and_redistribute_skills_removes_generic_bucket():
    raw_skills = [
        {"category": "Programming & Query Languages", "items": ["Python", "SQL"]},
        {"category": "BI & Visualization", "items": ["Power BI"]},
        {
            "category": "Additional Skills (self-reported)",
            "items": ["SQL queries", "executive BI dashboards", "Docker"],
        },
    ]

    cleaned = clean_and_redistribute_skills(raw_skills)

    categories = [c["category"] for c in cleaned]
    assert "Additional Skills (self-reported)" not in categories

    prog_cat = next(c for c in cleaned if c["category"] == "Programming & Query Languages")
    assert "SQL queries" in prog_cat["items"]

    bi_cat = next(c for c in cleaned if c["category"] == "BI & Visualization")
    assert "executive BI dashboards" in bi_cat["items"]

    # Docker should be in a specific category (e.g. Cloud & DevOps)
    docker_cat = next(c for c in cleaned if "Docker" in c["items"])
    assert docker_cat["category"] == "Cloud & DevOps"
