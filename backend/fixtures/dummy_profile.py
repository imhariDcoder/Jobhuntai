"""A dummy profile fixture covering every section, used to prove the
injector + tectonic compile pipeline works before any DB/LLM is wired up.
"""

DUMMY_PROFILE = {
    "name": "Jordan A. Smith",
    "phone": "+1-555-123-4567",
    "email": "jordan.smith@example.com",
    "linkedin": "linkedin.com/in/jordan-smith",
    "github": "github.com/jordansmith",
    "location": "Austin, TX",
    "summary": (
        "Data Analyst with 3+ years turning messy datasets into decisions, "
        "using Python, SQL & Power BI. Cut reporting turnaround by 40% at "
        "last role."
    ),
    "education": [
        {
            "degree": "B.S. Computer Science",
            "org": "University of Texas at Austin",
            "location": "Austin, TX",
            "dates": "2018 -- 2022",
            "details": ["GPA: 3.7 / 4.0", "Relevant coursework: Databases, Statistics"],
        }
    ],
    "experience": [
        {
            "id": "exp-1",
            "type": "job",
            "org": "Acme Analytics Inc.",
            "role": "Data Analyst",
            "location": "Remote",
            "dates": "Jul 2022 -- Present",
            "bullets": [
                {
                    "id": "b-1",
                    "text": "Automated a 40-hour/month manual reporting process using Python & SQL, saving 30% of team bandwidth.",
                    "keywords": ["python", "sql", "automation"],
                },
                {
                    "id": "b-2",
                    "text": "Built 12+ Power BI dashboards tracking revenue, churn, and funnel KPIs for 5 department heads.",
                    "keywords": ["power bi", "dashboards", "kpi"],
                },
            ],
        },
        {
            "id": "exp-2",
            "type": "training",
            "org": "DataCamp",
            "role": "Data Analytics Career Track",
            "location": "Remote",
            "dates": "Jan 2022 -- May 2022",
            "bullets": [
                {
                    "id": "b-3",
                    "text": "Completed 20+ courses on SQL, Python, and data visualization with hands-on projects.",
                    "keywords": ["sql", "python"],
                }
            ],
        },
    ],
    "projects": [
        {
            "id": "proj-1",
            "title": "Retail Sales Forecasting",
            "tech": ["Python", "Pandas", "scikit-learn"],
            "date": "2022",
            "link": "github.com/jordansmith/retail-forecast",
            "type": "personal",
            "bullets": [
                {
                    "id": "b-4",
                    "text": "Built a demand forecasting model achieving 92% accuracy on 2 years of retail sales data.",
                    "keywords": ["forecasting", "scikit-learn"],
                }
            ],
        }
    ],
    "skills": [
        {"category": "Languages", "items": ["Python", "SQL", "R"]},
        {"category": "Tools", "items": ["Power BI", "Tableau", "Excel"]},
    ],
    "certifications": [
        {"title": "Google Data Analytics Certificate", "org": "Coursera", "date": "2022"}
    ],
}
