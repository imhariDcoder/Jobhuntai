"""Pydantic request/response schemas for the profile API.

Shape mirrors exactly what app.latex.injector.render_resume_tex expects,
so a Profile.model_dump() can be passed straight to the injector with no
translation step.
"""

from typing import Optional

from pydantic import BaseModel, Field


class Bullet(BaseModel):
    id: Optional[str] = None
    text: str
    keywords: list[str] = Field(default_factory=list)


class Education(BaseModel):
    id: Optional[str] = None
    degree: Optional[str] = None
    org: Optional[str] = None
    location: Optional[str] = None
    dates: Optional[str] = None
    details: list[str] = Field(default_factory=list)


class Experience(BaseModel):
    id: Optional[str] = None
    type: str  # "job" | "training"
    org: Optional[str] = None
    role: Optional[str] = None
    location: Optional[str] = None
    dates: Optional[str] = None
    bullets: list[Bullet] = Field(default_factory=list)


class Project(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    tech: list[str] = Field(default_factory=list)
    date: Optional[str] = None
    link: Optional[str] = None
    type: Optional[str] = None  # "personal" | "academic" | "professional"
    bullets: list[Bullet] = Field(default_factory=list)


class Skill(BaseModel):
    id: Optional[str] = None
    category: Optional[str] = None
    items: list[str] = Field(default_factory=list)


class Certification(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    org: Optional[str] = None
    date: Optional[str] = None


class Profile(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    location: Optional[str] = None
    summary: Optional[str] = None
    education: list[Education] = Field(default_factory=list)
    experience: list[Experience] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    skills: list[Skill] = Field(default_factory=list)
    certifications: list[Certification] = Field(default_factory=list)
