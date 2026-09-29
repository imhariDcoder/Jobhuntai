"""Load/replace the single default profile as a plain nested dict.

`get_full_profile` returns exactly the shape app.latex.injector expects.
`replace_full_profile` implements full-replace semantics: the profile
form always submits its complete current state, so child rows are
deleted and recreated rather than diffed.
"""

from sqlalchemy.orm import Session

from app.db import (
    DEFAULT_PROFILE_ID,
    Certification,
    Education,
    Experience,
    ExperienceBullet,
    Profile,
    Project,
    ProjectBullet,
    Skill,
)
from app.schemas import Profile as ProfileSchema


def get_full_profile(session: Session) -> dict:
    profile = session.get(Profile, DEFAULT_PROFILE_ID)

    return {
        "name": profile.name,
        "phone": profile.phone,
        "email": profile.email,
        "linkedin": profile.linkedin,
        "github": profile.github,
        "location": profile.location,
        "summary": profile.summary,
        "education": [
            {
                "id": e.id,
                "degree": e.degree,
                "org": e.org,
                "location": e.location,
                "dates": e.dates,
                "details": e.details,
            }
            for e in profile.education
        ],
        "experience": [
            {
                "id": exp.id,
                "type": exp.type,
                "org": exp.org,
                "role": exp.role,
                "location": exp.location,
                "dates": exp.dates,
                "bullets": [
                    {"id": b.id, "text": b.text, "keywords": b.keywords} for b in exp.bullets
                ],
            }
            for exp in profile.experience
        ],
        "projects": [
            {
                "id": p.id,
                "title": p.title,
                "tech": p.tech,
                "date": p.date,
                "link": p.link,
                "type": p.type,
                "bullets": [
                    {"id": b.id, "text": b.text, "keywords": b.keywords} for b in p.bullets
                ],
            }
            for p in profile.projects
        ],
        "skills": [
            {"id": s.id, "category": s.category, "items": s.items} for s in profile.skills
        ],
        "certifications": [
            {"id": c.id, "title": c.title, "org": c.org, "date": c.date}
            for c in profile.certifications
        ],
    }


def replace_full_profile(session: Session, data: ProfileSchema) -> None:
    profile = session.get(Profile, DEFAULT_PROFILE_ID)

    profile.name = data.name
    profile.phone = data.phone
    profile.email = data.email
    profile.linkedin = data.linkedin
    profile.github = data.github
    profile.location = data.location
    profile.summary = data.summary

    # Full-replace: drop existing child rows, recreate from the payload.
    for existing in list(profile.education):
        session.delete(existing)
    for existing in list(profile.experience):
        session.delete(existing)
    for existing in list(profile.projects):
        session.delete(existing)
    for existing in list(profile.skills):
        session.delete(existing)
    for existing in list(profile.certifications):
        session.delete(existing)
    session.flush()

    for i, edu in enumerate(data.education):
        session.add(
            Education(
                profile_id=profile.id,
                degree=edu.degree,
                org=edu.org,
                location=edu.location,
                dates=edu.dates,
                details=edu.details,
                sort_order=i,
            )
        )

    for i, exp in enumerate(data.experience):
        exp_row = Experience(
            profile_id=profile.id,
            type=exp.type,
            org=exp.org,
            role=exp.role,
            location=exp.location,
            dates=exp.dates,
            sort_order=i,
        )
        exp_row.bullets = [
            ExperienceBullet(text=b.text, keywords=b.keywords, sort_order=j)
            for j, b in enumerate(exp.bullets)
        ]
        session.add(exp_row)

    for i, proj in enumerate(data.projects):
        proj_row = Project(
            profile_id=profile.id,
            title=proj.title,
            tech=proj.tech,
            date=proj.date,
            link=proj.link,
            type=proj.type,
            sort_order=i,
        )
        proj_row.bullets = [
            ProjectBullet(text=b.text, keywords=b.keywords, sort_order=j)
            for j, b in enumerate(proj.bullets)
        ]
        session.add(proj_row)

    for i, skill in enumerate(data.skills):
        session.add(
            Skill(profile_id=profile.id, category=skill.category, items=skill.items, sort_order=i)
        )

    for i, cert in enumerate(data.certifications):
        session.add(
            Certification(
                profile_id=profile.id, title=cert.title, org=cert.org, date=cert.date, sort_order=i
            )
        )

    session.commit()
