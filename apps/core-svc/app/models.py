from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


def uuid_str() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


# ----------------------------- Project & Core ----------------------------- #
class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    risk_level: Mapped[str] = mapped_column(String(50), default="medium")
    target_threshold: Mapped[float] = mapped_column(Float, default=0.80)
    priority: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sponsor: Mapped[str | None] = mapped_column(String(100), nullable=True)
    owner: Mapped[str | None] = mapped_column(String(100), nullable=True)
    creation_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        server_default=func.current_date(),
    )
    update_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        server_default=func.now(),
        onupdate=func.now(),
    )

    assessments: Mapped[list["Assessment"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )
    pillar_overrides: Mapped[list["PillarOverride"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )


class Pillar(Base):
    __tablename__ = "pillars"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    key: Mapped[str] = mapped_column(String(60), unique=True, index=True)  # e.g. governance, data, etc.
    name: Mapped[str] = mapped_column(String(120))
    weight: Mapped[float] = mapped_column(Float)  # e.g., 0.20

    kpis: Mapped[list["KPI"]] = relationship(
        back_populates="pillar",
        cascade="all, delete-orphan",
    )


class KPI(Base):
    __tablename__ = "kpis"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    key: Mapped[str] = mapped_column(String(120), unique=True, index=True)  # e.g., pcl_assignment_rate
    name: Mapped[str] = mapped_column(String(200))
    pillar_id: Mapped[str] = mapped_column(ForeignKey("pillars.id", ondelete="CASCADE"))
    unit: Mapped[str] = mapped_column(String(40), default="%")  # %, days, hours, ms, count
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    min_ideal: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_ideal: Mapped[float | None] = mapped_column(Float, nullable=True)
    invert: Mapped[bool] = mapped_column(Boolean, default=False)  # True if lower is better
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    pillar: Mapped["Pillar"] = relationship(back_populates="kpis")


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    frozen: Mapped[bool] = mapped_column(Boolean, default=False)

    project: Mapped["Project"] = relationship(back_populates="assessments")
    kpi_values: Mapped[list["KPIValue"]] = relationship(
        back_populates="assessment",
        cascade="all, delete-orphan",
    )


class KPIValue(Base):
    __tablename__ = "kpi_values"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    assessment_id: Mapped[str] = mapped_column(ForeignKey("assessments.id", ondelete="CASCADE"))
    kpi_id: Mapped[str] = mapped_column(ForeignKey("kpis.id", ondelete="CASCADE"))
    raw_value: Mapped[float] = mapped_column(Float)
    normalized_0_100: Mapped[float] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    assessment: Mapped["Assessment"] = relationship(back_populates="kpi_values")


# ----------------------------- Pillar Override ---------------------------- #
class PillarOverride(Base):
    __tablename__ = "pillar_overrides"
    __table_args__ = (
        UniqueConstraint("project_id", "pillar_key", name="uq_pillar_overrides_project_pillar"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
    )
    pillar_key: Mapped[str] = mapped_column(String(60))
    score_pct: Mapped[float | None] = mapped_column(Float, nullable=True)  # 0..100
    maturity: Mapped[int | None] = mapped_column(Integer, nullable=True)   # 1..5
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    project: Mapped["Project"] = relationship(back_populates="pillar_overrides")
