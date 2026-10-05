"""Intelligent skill categorization engine.

Maps skills and keywords to specific technical and professional domains.
Prioritizes matching against the candidate's existing resume categories
(e.g., 'Programming & Query Languages', 'BI & Visualization', 'Tools', 'Concepts').
If a skill introduces a new domain not yet covered in the profile, it creates
a specific, professional category (e.g., 'Cloud & DevOps') rather than a generic
dumping ground like 'Additional Skills'.
"""

import re
from typing import Optional

DOMAINS = [
    {
        "domain": "Languages",
        "default_category": "Programming & Query Languages",
        "category_keywords": ["language", "programming", "query", "coding", "scripting"],
        "exact_skills": {
            "python", "sql", "r", "java", "c", "c++", "c#", "typescript", "javascript",
            "js", "ts", "go", "golang", "rust", "php", "ruby", "bash", "shell",
            "powershell", "scala", "kotlin", "swift", "perl", "dart", "lua", "julia",
            "html", "css", "sass", "scss", "graphql", "sparql", "cypher", "vba"
        },
        "patterns": [
            r"\b(python|sql|java|typescript|javascript|golang|rust|bash|scala|c\+\+|c#|kotlin|swift|ruby|php|html5?|css3?)\b",
            r"query\s+language",
            r"programming\s+language",
            r"scripting\s+language",
        ],
    },
    {
        "domain": "BI & Visualization",
        "default_category": "BI & Visualization",
        "category_keywords": ["visual", "bi", "report", "dashboard", "intelligence", "tableau", "power bi"],
        "exact_skills": {
            "power bi", "powerbi", "tableau", "looker", "looker studio", "qlik", "qlikview",
            "qlik sense", "excel", "advanced excel", "excel (advanced)", "dax", "power query",
            "matplotlib", "seaborn", "plotly", "d3.js", "dash", "streamlit", "superset",
            "metabase", "microstrategy", "ssrs", "ssis", "ssas", "reporting",
            "data visualization", "interactive dashboards", "executive bi dashboards",
            "executive dashboards", "kpi dashboards", "business intelligence"
        },
        "patterns": [
            r"dashboard",
            r"visualization",
            r"visuals",
            r"power\s*bi",
            r"tableau",
            r"looker",
            r"power\s*query",
            r"\bdax\b",
            r"reporting",
            r"business\s+intelligence",
            r"kpi",
        ],
    },
    {
        "domain": "Data & Databases",
        "default_category": "Data & Databases",
        "category_keywords": ["data", "database", "storage", "warehouse", "pipeline", "etl", "db"],
        "exact_skills": {
            "pandas", "numpy", "scipy", "postgresql", "postgres", "mysql", "sqlite",
            "mongodb", "redis", "cassandra", "dynamodb", "oracle", "snowflake",
            "bigquery", "redshift", "databricks", "spark", "pyspark", "hadoop", "hive",
            "kafka", "airflow", "dbt", "etl", "elt", "data modeling", "data warehouse",
            "data warehousing", "data lake", "data pipelines", "data extraction",
            "data manipulation", "manipulation", "data wrangling", "data mining",
            "data cleansing", "data cleaning", "data validation", "data ingestion",
            "relational databases", "nosql", "oltp", "olap",
            "transactional and customer behavior datasets", "customer behavior datasets",
            "transactional datasets", "sql queries"
        },
        "patterns": [
            r"data\s+(extraction|manipulation|wrangling|cleansing|cleaning|modeling|pipeline|warehouse|lake|ingestion|storage|mining)",
            r"dataset",
            r"database",
            r"postgres",
            r"mysql",
            r"mongodb",
            r"redis",
            r"snowflake",
            r"bigquery",
            r"\b(spark|pyspark|airflow|dbt|pandas|numpy|scipy|etl|elt|nosql|olap|oltp)\b",
            r"sql\s+queries",
            r"relational\s+data",
        ],
    },
    {
        "domain": "Machine Learning & AI",
        "default_category": "Machine Learning & AI",
        "category_keywords": ["machine learning", "ml", "ai", "artificial intelligence", "data science", "deep learning", "neural"],
        "exact_skills": {
            "scikit-learn", "sklearn", "tensorflow", "pytorch", "keras", "opencv",
            "cnn", "cnns", "rnn", "lstm", "transformer", "transformers", "llm", "llms",
            "nlp", "natural language processing", "nltk", "spacy", "huggingface",
            "genai", "generative ai", "langchain", "llamaindex", "vector database",
            "chromadb", "pinecone", "faiss", "machine learning", "deep learning",
            "supervised learning", "unsupervised learning", "computer vision",
            "predictive modeling", "reinforcement learning"
        },
        "patterns": [
            r"machine\s+learning",
            r"deep\s+learning",
            r"neural\s+net",
            r"scikit",
            r"tensorflow",
            r"pytorch",
            r"\b(nlp|cnn|cnns|rnn|lstm|llm|llms|genai|langchain)\b",
            r"predictive\s+model",
            r"computer\s+vision",
            r"generative\s+ai",
        ],
    },
    {
        "domain": "Testing & QA",
        "default_category": "Testing & Automation",
        "category_keywords": ["test", "testing", "qa", "automation", "quality"],
        "exact_skills": {
            "selenium", "cypress", "playwright", "puppeteer", "pytest", "junit",
            "testng", "jest", "mocha", "cucumber", "test automation", "unit testing",
            "integration testing", "e2e testing", "qa", "quality assurance",
            "automated testing", "load testing", "jmeter", "postman testing"
        },
        "patterns": [
            r"test\s+automation",
            r"unit\s+test",
            r"automated\s+test",
            r"selenium",
            r"cypress",
            r"playwright",
            r"pytest",
            r"quality\s+assurance",
            r"\b(qa|e2e|junit)\b",
        ],
    },
    {
        "domain": "Cloud & DevOps",
        "default_category": "Cloud & DevOps",
        "category_keywords": ["cloud", "devops", "infra", "infrastructure", "platform", "deployment", "ci/cd", "container"],
        "exact_skills": {
            "aws", "amazon web services", "azure", "microsoft azure", "gcp",
            "google cloud", "google cloud platform", "docker", "kubernetes", "k8s",
            "terraform", "ansible", "jenkins", "github actions", "gitlab ci", "ci/cd",
            "linux", "unix", "ubuntu", "nginx", "apache", "serverless", "lambda",
            "cloudformation", "helm", "openshift", "promethus", "grafana"
        },
        "patterns": [
            r"\b(aws|azure|gcp|docker|kubernetes|k8s|terraform|ansible|jenkins|ci/cd|linux|unix|ubuntu|nginx|serverless|lambda|helm|openshift)\b",
            r"cloud",
            r"devops",
            r"infrastructure",
            r"container",
        ],
    },
    {
        "domain": "Developer Tools",
        "default_category": "Tools",
        "category_keywords": ["tool", "tools", "platform", "developer tools", "utilities", "ide"],
        "exact_skills": {
            "git", "github", "gitlab", "bitbucket", "jira", "confluence", "trello",
            "asana", "postman", "swagger", "insomnia", "vs code", "visual studio",
            "pycharm", "intellij", "eclipse", "docker desktop", "terminal"
        },
        "patterns": [
            r"\b(git|github|gitlab|bitbucket|jira|confluence|postman|swagger|vs\s*code|pycharm|intellij)\b",
            r"developer\s+tools",
        ],
    },
    {
        "domain": "Concepts & Methodologies",
        "default_category": "Concepts",
        "category_keywords": ["concept", "concepts", "methodolog", "practice", "management", "leadership", "competenc", "analytical"],
        "exact_skills": {
            "agile", "scrum", "kanban", "sprint planning", "sdlc", "waterfall",
            "exploratory data analysis", "exploratory data analysis (eda)", "eda",
            "statistical analysis", "statistics", "hypothesis testing", "a/b testing",
            "experimentation", "root cause analysis", "performance optimization",
            "optimization", "object-oriented programming", "oop", "design patterns",
            "solid principles", "rest apis", "rest", "restful", "system design",
            "stakeholder management", "cross-functional stakeholders",
            "cross-functional collaboration", "cross-functional leadership",
            "senior leadership", "leadership", "mentorship", "requirement gathering",
            "business analysis", "data governance", "compliance", "data-driven insights",
            "problem solving", "senior data analyst", "business intelligence specialist"
        },
        "patterns": [
            r"agile",
            r"scrum",
            r"kanban",
            r"stakeholder",
            r"leadership",
            r"exploratory\s+data\s+analysis",
            r"\b(eda|oop|sdlc)\b",
            r"statistical",
            r"optimization",
            r"data-driven",
            r"management",
            r"specialist",
            r"analyst",
        ],
    },
]

GENERIC_CATEGORY_MARKERS = [
    "additional",
    "self-reported",
    "targeted jd",
    "other skills",
    "miscellaneous",
    "misc",
]


def _is_generic_category(category_name: str) -> bool:
    c_lower = category_name.lower()
    return any(marker in c_lower for marker in GENERIC_CATEGORY_MARKERS)


def classify_skill(skill: str, existing_categories: list[str]) -> str:
    """Determine the best category for a skill.

    1. Checks if the skill maps to a recognized domain.
    2. Searches `existing_categories` for a category representing that domain.
    3. If found, returns that existing category name (preserving exact casing/wording).
    4. If not found in existing categories, returns the domain's specific default category
       (e.g., 'Cloud & DevOps'), avoiding generic dumping grounds.
    """
    s_clean = skill.strip().lower()
    if not s_clean:
        return "Tools"

    # 1. Identify which domain the skill belongs to
    matched_domain = None
    for dom in DOMAINS:
        if s_clean in dom["exact_skills"]:
            matched_domain = dom
            break
        for pat in dom["patterns"]:
            if re.search(pat, s_clean, re.IGNORECASE):
                matched_domain = dom
                break
        if matched_domain:
            break

    # Secondary word overlap check
    if not matched_domain:
        words = set(re.findall(r"\w+", s_clean))
        for dom in DOMAINS:
            if words.intersection(dom["exact_skills"]):
                matched_domain = dom
                break

    # 2. Match the domain against user's existing categories
    if matched_domain:
        for cat in existing_categories:
            if _is_generic_category(cat):
                continue
            c_lower = cat.lower()
            for kw in matched_domain["category_keywords"]:
                if kw in c_lower:
                    return cat

        # No existing category matches this domain -> return the domain's specific category
        return matched_domain["default_category"]

    # 3. Fallback: check direct word overlap with any existing non-generic category
    for cat in existing_categories:
        if _is_generic_category(cat):
            continue
        c_lower = cat.lower()
        if any(w in c_lower for w in re.findall(r"\w+", s_clean) if len(w) > 3):
            return cat

    # Concept/Methodology hints
    if any(k in s_clean for k in ["management", "analysis", "strategy", "leadership", "design", "process", "skills"]):
        for cat in existing_categories:
            if any(k in cat.lower() for k in ["concept", "methodolog", "competenc"]):
                return cat
        return "Concepts"

    # Default to existing Tools category if available, or create specific
    for cat in existing_categories:
        if "tool" in cat.lower() and not _is_generic_category(cat):
            return cat

    return "Tools & Technologies"


def classify_skills_batch(skills: list[str], existing_categories: list[str]) -> dict[str, str]:
    """Map each skill in a list to its target category."""
    clean_existing = [c for c in existing_categories if not _is_generic_category(c)]
    result: dict[str, str] = {}
    for skill in skills:
        result[skill] = classify_skill(skill, clean_existing)
    return result


def clean_and_redistribute_skills(skills_list: list[dict]) -> list[dict]:
    """Inspects a skills list (list of {category, items}).
    If any generic category exists (e.g. 'Additional Skills (self-reported)'),
    re-distributes its items into the proper specific categories and removes
    the generic category.
    """
    valid_categories = [
        s["category"] for s in skills_list
        if s.get("category") and not _is_generic_category(s["category"])
    ]

    orphaned_items: list[str] = []
    clean_categories: list[dict] = []

    for s in skills_list:
        cat_name = s.get("category", "")
        items = [str(i).strip() for i in s.get("items", []) if str(i).strip()]
        if _is_generic_category(cat_name):
            orphaned_items.extend(items)
        else:
            clean_categories.append({"category": cat_name, "items": items})

    if not orphaned_items:
        return skills_list

    # Re-distribute orphaned items into specific categories
    for item in orphaned_items:
        target_cat = classify_skill(item, valid_categories)
        existing = next(
            (c for c in clean_categories if c["category"].lower() == target_cat.lower()),
            None
        )
        if not existing:
            existing = {"category": target_cat, "items": []}
            clean_categories.append(existing)
            valid_categories.append(target_cat)

        existing_lower = {i.lower() for i in existing["items"]}
        if item.lower() not in existing_lower:
            existing["items"].append(item)

    return clean_categories
