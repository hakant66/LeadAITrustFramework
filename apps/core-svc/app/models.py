from __future__ import annotations

import uuid
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    BigInteger,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, ENUM, UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


def uuid_str() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


# ----------------------------- Project & Core ----------------------------- #
class Entity(Base):
    __tablename__ = "entity"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    full_legal_name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'active'"))
    legal_standing_result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class Project(Base):
    __tablename__ = "entity_projects"
    __table_args__ = (
        UniqueConstraint("entity_id", "slug", name="uq_entity_projects_entity_slug"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    entity_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("entity.id", ondelete="CASCADE"), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(120), index=True)
    name: Mapped[str] = mapped_column(String(200))
    risk_level: Mapped[str] = mapped_column(String(50), default="medium")
    target_threshold: Mapped[float] = mapped_column(Float, default=0.80)
    priority: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sponsor: Mapped[str | None] = mapped_column(String(100), nullable=True)
    owner: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="Planned")
    is_archived: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        default=False,
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
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
    translations: Mapped[list["ProjectTranslation"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )


class ProjectTranslation(Base):
    __tablename__ = "project_translations"

    project_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("entity_projects.id", ondelete="CASCADE"),
        primary_key=True,
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("entity.id", ondelete="CASCADE"), nullable=False, index=True)
    locale: Mapped[str] = mapped_column(String(10), primary_key=True)
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    risk_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    priority: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sponsor: Mapped[str | None] = mapped_column(String(100), nullable=True)
    owner: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    company_registration_number: Mapped[str | None] = mapped_column(Text, nullable=True)
    headquarters_country: Mapped[str | None] = mapped_column(Text, nullable=True)
    regions_of_operation: Mapped[str | None] = mapped_column(Text, nullable=True)
    sectors: Mapped[str | None] = mapped_column(Text, nullable=True)

    project: Mapped["Project"] = relationship(back_populates="translations")


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


class TrustAxisPillarMap(Base):
    __tablename__ = "trust_axis_pillar_map"

    pillar_key: Mapped[str] = mapped_column(String(60), primary_key=True)
    axis_key: Mapped[str] = mapped_column(String(20))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class TrustEvaluation(Base):
    __tablename__ = "trust_evaluations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    entity_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("entity.id", ondelete="CASCADE"), nullable=False, index=True)
    project_slug: Mapped[str] = mapped_column(String(120), index=True)
    axis_scores: Mapped[dict] = mapped_column(JSONB)
    tol_level: Mapped[str] = mapped_column(String(20))
    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class TrustEvaluationAudit(Base):
    __tablename__ = "trust_evaluation_audit"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("entity.id", ondelete="CASCADE"), nullable=False, index=True)
    evaluation_id: Mapped[str] = mapped_column(String, index=True)
    action: Mapped[str] = mapped_column(String(60))
    actor: Mapped[str | None] = mapped_column(String(120), nullable=True)
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    details_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class TrustMark(Base):
    __tablename__ = "trustmarks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    entity_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("entity.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(String, nullable=False)
    project_slug: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    tol_level: Mapped[str] = mapped_column(String(20), nullable=False)
    axis_scores: Mapped[dict] = mapped_column(JSONB, nullable=False)
    axis_levels: Mapped[dict] = mapped_column(JSONB, nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    signature: Mapped[str] = mapped_column(Text, nullable=False)
    public_key: Mapped[str] = mapped_column(Text, nullable=False)
    key_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    evaluation_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class ProvenanceArtifact(Base):
    __tablename__ = "provenance_artifacts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    entity_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("entity.id", ondelete="CASCADE"), nullable=False, index=True)
    project_slug: Mapped[str] = mapped_column(String(120), index=True)
    name: Mapped[str] = mapped_column(String(200))
    uri: Mapped[str] = mapped_column(Text)
    sha256: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    mime: Mapped[str | None] = mapped_column(String(120), nullable=True)
    license_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    license_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    usage_rights: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class EntityProviderArtifact(Base):
    __tablename__ = "entity_provider_artifacts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    entity_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("entity.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider_key: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    uri: Mapped[str] = mapped_column(Text, nullable=False)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    valid_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    valid_to: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ProvenanceDataset(Base):
    __tablename__ = "provenance_datasets"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    entity_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("entity.id", ondelete="CASCADE"), nullable=False, index=True)
    project_slug: Mapped[str] = mapped_column(String(120), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifact_id: Mapped[str | None] = mapped_column(
        ForeignKey("provenance_artifacts.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class ProvenanceModel(Base):
    __tablename__ = "provenance_models"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    entity_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("entity.id", ondelete="CASCADE"), nullable=False, index=True)
    project_slug: Mapped[str] = mapped_column(String(120), index=True)
    name: Mapped[str] = mapped_column(String(200))
    version: Mapped[str | None] = mapped_column(String(120), nullable=True)
    framework: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifact_id: Mapped[str | None] = mapped_column(
        ForeignKey("provenance_artifacts.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class ProvenanceEvidence(Base):
    __tablename__ = "provenance_evidence"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    entity_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("entity.id", ondelete="CASCADE"), nullable=False, index=True)
    project_slug: Mapped[str] = mapped_column(String(120), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifact_id: Mapped[str | None] = mapped_column(
        ForeignKey("provenance_artifacts.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class ProvenanceLineage(Base):
    __tablename__ = "provenance_lineage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("entity.id", ondelete="CASCADE"), nullable=False, index=True)
    project_slug: Mapped[str] = mapped_column(String(120), index=True)
    parent_type: Mapped[str] = mapped_column(String(40))
    parent_id: Mapped[str] = mapped_column(String)
    child_type: Mapped[str] = mapped_column(String(40))
    child_id: Mapped[str] = mapped_column(String)
    relationship: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class ProvenanceAudit(Base):
    __tablename__ = "provenance_audit"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str] = mapped_column(String)
    action: Mapped[str] = mapped_column(String(120))
    actor: Mapped[str | None] = mapped_column(String(120), nullable=True)
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    details_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


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


class Control(Base):
    __tablename__ = "controls"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    kpi_key: Mapped[str] = mapped_column(String(120), index=True)
    name: Mapped[str] = mapped_column(String(200))
    pillar: Mapped[str | None] = mapped_column(String(120), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(40), nullable=True)
    norm_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    norm_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    higher_is_better: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    axis_key: Mapped[str | None] = mapped_column(
        ENUM("safety", "compliance", "provenance", name="trust_axis", create_type=False),
        nullable=True,
    )


class EntityKpiOverride(Base):
    __tablename__ = "entity_kpi_overrides"
    __table_args__ = (
        UniqueConstraint("entity_id", "kpi_id", name="uq_entity_kpi_overrides_entity_kpi"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("entity.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kpi_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("kpis.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    weight_override: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_ideal_override: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_ideal_override: Mapped[float | None] = mapped_column(Float, nullable=True)
    invert_override: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    example_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    scoring_override_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    locale_override: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class EntityControlOverride(Base):
    __tablename__ = "entity_control_overrides"
    __table_args__ = (
        UniqueConstraint("entity_id", "control_id", name="uq_entity_control_overrides_entity_control"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("entity.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    control_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("controls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    pillar_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    norm_min_override: Mapped[float | None] = mapped_column(Float, nullable=True)
    norm_max_override: Mapped[float | None] = mapped_column(Float, nullable=True)
    higher_is_better_override: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    weight_override: Mapped[float | None] = mapped_column(Float, nullable=True)
    axis_key_override: Mapped[str | None] = mapped_column(
        ENUM("safety", "compliance", "provenance", name="trust_axis", create_type=False),
        nullable=True,
    )
    target_text_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_numeric_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    evidence_source_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_role_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    frequency_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    entity_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("entity.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("entity_projects.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    frozen: Mapped[bool] = mapped_column(Boolean, default=False)

    project: Mapped["Project"] = relationship(back_populates="assessments")
   

# ----------------------------- Pillar Override ---------------------------- #
class PillarOverride(Base):
    __tablename__ = "pillar_overrides"
    __table_args__ = (
        UniqueConstraint("entity_id", "project_id", "pillar_key", name="uq_pillar_overrides_entity_project_pillar"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    entity_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("entity.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("entity_projects.id", ondelete="CASCADE"),
        index=True,
    )
    pillar_key: Mapped[str] = mapped_column(String(60))
    score_pct: Mapped[float | None] = mapped_column(Float, nullable=True)  # 0..100
    calculated_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    maturity: Mapped[int | None] = mapped_column(Integer, nullable=True)   # 1..5
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    project: Mapped["Project"] = relationship(back_populates="pillar_overrides")


# ----------------------------- Trust Monitoring ---------------------------- #
class TrustMonitoringSignal(Base):
    __tablename__ = "trust_monitoring_signals"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    entity_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("entity.id", ondelete="CASCADE"), nullable=False, index=True)
    project_slug: Mapped[str] = mapped_column(String(120), index=True)
    signal_type: Mapped[str] = mapped_column(String(60))
    axis_key: Mapped[str | None] = mapped_column(
        ENUM("safety", "compliance", "provenance", name="trust_axis", create_type=False),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(20), default="pending")
    details_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    source: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class TrustDecayEvent(Base):
    __tablename__ = "trust_decay_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    entity_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("entity.id", ondelete="CASCADE"), nullable=False, index=True)
    signal_id: Mapped[str] = mapped_column(String, index=True)
    project_slug: Mapped[str] = mapped_column(String(120), index=True)
    axis_key: Mapped[str] = mapped_column(
        ENUM("safety", "compliance", "provenance", name="trust_axis", create_type=False),
    )
    rule_key: Mapped[str] = mapped_column(String(80))
    decay_delta: Mapped[float | None] = mapped_column(Float, nullable=True)
    previous_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    new_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    reversible: Mapped[bool] = mapped_column(Boolean, default=True)
    details_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    
# Ensure reflected models are registered on the same Base.metadata (for Alembic autogenerate)
import app.leadai_models_reflected # noqa: F401
