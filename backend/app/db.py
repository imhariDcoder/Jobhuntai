"""SQLite persistence layer.

Single-user, no-auth setup: there is exactly one profile row, created on
first startup with a fixed id. This can be swapped for Supabase-backed
multi-user auth later without touching the LaTeX injector -- the injector
only ever sees a plain profile dict.
"""

import json
import os
import uuid
from pathlib import Path
from typing import Optional

from sqlalchemy import (
    ForeignKey,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

_DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "app.db"
_DB_PATH = Path(os.environ.get("SMARTJOBAI_DB_PATH", _DEFAULT_DB_PATH))
_DB_PATH.parent.mkdir(parents=True, exist_ok=True)

DEFAULT_PROFILE_ID = "00000000-0000-0000-0000-000000000001"

engine = create_engine(f"sqlite:///{_DB_PATH}", connect_args={"check_same_thread": False})


class JSONList(TypeDecorator):
    """Stores a list[str] as JSON text (SQLite has no native array type)."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return json.dumps(value or [])

    def process_result_value(self, value, dialect):
        return json.loads(value) if value else []


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return str(uuid.uuid4())


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[Optional[str]] = mapped_column(String)
    phone: Mapped[Optional[str]] = mapped_column(String)
    email: Mapped[Optional[str]] = mapped_column(String)
    linkedin: Mapped[Optional[str]] = mapped_column(String)
    github: Mapped[Optional[str]] = mapped_column(String)
    location: Mapped[Optional[str]] = mapped_column(String)
    summary: Mapped[Optional[str]] = mapped_column(Text)

    education: Mapped[list["Education"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", order_by="Education.sort_order"
    )
    experience: Mapped[list["Experience"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", order_by="Experience.sort_order"
    )
    projects: Mapped[list["Project"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", order_by="Project.sort_order"
    )
    skills: Mapped[list["Skill"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", order_by="Skill.sort_order"
    )
    certifications: Mapped[list["Certification"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", order_by="Certification.sort_order"
    )


class Education(Base):
    __tablename__ = "education"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    profile_id: Mapped[str] = mapped_column(ForeignKey("profiles.id"))
    degree: Mapped[Optional[str]] = mapped_column(String)
    org: Mapped[Optional[str]] = mapped_column(String)
    location: Mapped[Optional[str]] = mapped_column(String)
    dates: Mapped[Optional[str]] = mapped_column(String)
    details: Mapped[list[str]] = mapped_column(JSONList, default=list)
    sort_order: Mapped[int] = mapped_column(default=0)

    profile: Mapped[Profile] = relationship(back_populates="education")


class Experience(Base):
    __tablename__ = "experience"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    profile_id: Mapped[str] = mapped_column(ForeignKey("profiles.id"))
    type: Mapped[str] = mapped_column(String)  # "job" | "training"
    org: Mapped[Optional[str]] = mapped_column(String)
    role: Mapped[Optional[str]] = mapped_column(String)
    location: Mapped[Optional[str]] = mapped_column(String)
    dates: Mapped[Optional[str]] = mapped_column(String)
    sort_order: Mapped[int] = mapped_column(default=0)

    profile: Mapped[Profile] = relationship(back_populates="experience")
    bullets: Mapped[list["ExperienceBullet"]] = relationship(
        back_populates="experience",
        cascade="all, delete-orphan",
        order_by="ExperienceBullet.sort_order",
    )


class ExperienceBullet(Base):
    __tablename__ = "experience_bullets"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    experience_id: Mapped[str] = mapped_column(ForeignKey("experience.id"))
    text: Mapped[str] = mapped_column(Text)
    keywords: Mapped[list[str]] = mapped_column(JSONList, default=list)
    sort_order: Mapped[int] = mapped_column(default=0)

    experience: Mapped[Experience] = relationship(back_populates="bullets")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    profile_id: Mapped[str] = mapped_column(ForeignKey("profiles.id"))
    title: Mapped[Optional[str]] = mapped_column(String)
    tech: Mapped[list[str]] = mapped_column(JSONList, default=list)
    date: Mapped[Optional[str]] = mapped_column(String)
    link: Mapped[Optional[str]] = mapped_column(String)
    type: Mapped[Optional[str]] = mapped_column(String)  # "personal"|"academic"|"professional"
    sort_order: Mapped[int] = mapped_column(default=0)

    profile: Mapped[Profile] = relationship(back_populates="projects")
    bullets: Mapped[list["ProjectBullet"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="ProjectBullet.sort_order",
    )


class ProjectBullet(Base):
    __tablename__ = "project_bullets"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"))
    text: Mapped[str] = mapped_column(Text)
    keywords: Mapped[list[str]] = mapped_column(JSONList, default=list)
    sort_order: Mapped[int] = mapped_column(default=0)

    project: Mapped[Project] = relationship(back_populates="bullets")


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    profile_id: Mapped[str] = mapped_column(ForeignKey("profiles.id"))
    category: Mapped[Optional[str]] = mapped_column(String)
    items: Mapped[list[str]] = mapped_column(JSONList, default=list)
    sort_order: Mapped[int] = mapped_column(default=0)

    profile: Mapped[Profile] = relationship(back_populates="skills")


class Certification(Base):
    __tablename__ = "certifications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    profile_id: Mapped[str] = mapped_column(ForeignKey("profiles.id"))
    title: Mapped[Optional[str]] = mapped_column(String)
    org: Mapped[Optional[str]] = mapped_column(String)
    date: Mapped[Optional[str]] = mapped_column(String)
    sort_order: Mapped[int] = mapped_column(default=0)

    profile: Mapped[Profile] = relationship(back_populates="certifications")


def init_db() -> None:
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        if session.get(Profile, DEFAULT_PROFILE_ID) is None:
            session.add(Profile(id=DEFAULT_PROFILE_ID))
            session.commit()


def get_session() -> Session:
    return Session(engine)
