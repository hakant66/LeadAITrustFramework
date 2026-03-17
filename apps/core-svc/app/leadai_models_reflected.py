from typing import Optional
import datetime
import decimal
import uuid

from sqlalchemy import BigInteger, Boolean, CHAR, CheckConstraint, Column, Date, DateTime, Double, Enum, ForeignKeyConstraint, Index, Integer, Numeric, PrimaryKeyConstraint, String, Table, Text, UniqueConstraint, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB

from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models import Base


class AiReadinessResults(Base):
    __tablename__ = 'ai_readiness_results'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='ai_readiness_results_pkey'),
        UniqueConstraint('slug', name='ai_readiness_results_slug_key'),
        {'schema': 'public'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    totals: Mapped[dict] = mapped_column(JSONB, nullable=False)
    avg: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    user_name: Mapped[Optional[str]] = mapped_column(Text)
    user_email: Mapped[Optional[str]] = mapped_column(Text)
    company: Mapped[Optional[str]] = mapped_column(Text)
    pdf_url: Mapped[Optional[str]] = mapped_column(Text)


class ControlValuesHistory(Base):
    __tablename__ = 'control_values_history'
    __table_args__ = (
        PrimaryKeyConstraint('audit_id', name='control_values_history_pkey'),
        Index('ix_cvh_project', 'project_slug'),
        Index('ix_cvh_txid', 'audit_txid'),
        Index('ix_cvh_when', 'audit_ts'),
        {'schema': 'public'}
    )

    project_slug: Mapped[str] = mapped_column(Text, nullable=False)
    kpi_key: Mapped[str] = mapped_column(Text, nullable=False)
    raw_value: Mapped[float] = mapped_column(Double(53), nullable=False)
    normalized_pct: Mapped[float] = mapped_column(Double(53), nullable=False, server_default=text('0'))
    observed_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    control_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    audit_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    audit_action: Mapped[str] = mapped_column(Text, nullable=False)
    audit_ts: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    audit_txid: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default=text('txid_current()'))
    target_text: Mapped[Optional[str]] = mapped_column(Text)
    target_numeric: Mapped[Optional[int]] = mapped_column(Integer)
    evidence_source: Mapped[Optional[str]] = mapped_column(Text)
    owner_role: Mapped[Optional[str]] = mapped_column(Text)
    frequency: Mapped[Optional[int]] = mapped_column(Integer)
    failure_action: Mapped[Optional[int]] = mapped_column(Integer)
    maturity_anchor_l3: Mapped[Optional[int]] = mapped_column(Integer)
    current_value: Mapped[Optional[int]] = mapped_column(Integer)
    as_of: Mapped[Optional[int]] = mapped_column(Integer)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    kpi_score: Mapped[Optional[int]] = mapped_column(Integer)
    audit_user: Mapped[Optional[str]] = mapped_column(Text)
    audit_reason: Mapped[Optional[str]] = mapped_column(Text)
    audit_source: Mapped[Optional[str]] = mapped_column(Text)

"""
class Controls(Base):
    __tablename__ = 'controls'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='controls_pkey'),
        {'schema': 'public'}
    )

    kpi_key: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    higher_is_better: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('true'))
    weight: Mapped[float] = mapped_column(Double(53), nullable=False, server_default=text('1.0'))
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    pillar: Mapped[Optional[str]] = mapped_column(Text)
    unit: Mapped[Optional[str]] = mapped_column(Text)
    norm_min: Mapped[Optional[float]] = mapped_column(Double(53))
    norm_max: Mapped[Optional[float]] = mapped_column(Double(53))
    target_text: Mapped[Optional[str]] = mapped_column(Text)
    target_numeric: Mapped[Optional[int]] = mapped_column(Integer)
    evidence_source: Mapped[Optional[str]] = mapped_column(Text)
    owner_role: Mapped[Optional[str]] = mapped_column(Text)
    frequency: Mapped[Optional[int]] = mapped_column(Integer)
    failure_action: Mapped[Optional[int]] = mapped_column(Integer)
    maturity_anchor_l3: Mapped[Optional[int]] = mapped_column(Integer)
    current_value: Mapped[Optional[int]] = mapped_column(Integer)
    as_of: Mapped[Optional[int]] = mapped_column(Integer)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    kpi_score: Mapped[Optional[int]] = mapped_column(Integer)
    description: Mapped[Optional[str]] = mapped_column(Text)
    example: Mapped[Optional[str]] = mapped_column(Text)
    axis_key: Mapped[Optional[str]] = mapped_column(Enum('safety', 'compliance', 'provenance', name='trust_axis'))

    control_values: Mapped[list['ControlValues']] = relationship('ControlValues', back_populates='control')
"""

class GuardrailFactSources(Base):
    __tablename__ = 'guardrail_fact_sources'
    __table_args__ = (
        CheckConstraint("source = ANY (ARRAY['kpi'::text, 'project_attr'::text])", name='ck_guardrail_fact_sources_source'),
        PrimaryKeyConstraint('fact_key', name='guardrail_fact_sources_pkey'),
        Index('ix_guardrail_fact_sources_source', 'source'),
        {'schema': 'public'}
    )

    fact_key: Mapped[str] = mapped_column(Text, primary_key=True)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    kpi_key: Mapped[Optional[str]] = mapped_column(Text)
    attr_key: Mapped[Optional[str]] = mapped_column(Text)
    present_threshold: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric)


class GuardrailRules(Base):
    __tablename__ = 'guardrail_rules'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='guardrail_rules_pkey'),
        Index('ix_guardrail_rules_is_enabled', 'is_enabled'),
        Index('ix_guardrail_rules_pillar_key', 'pillar_key'),
        Index('ux_guardrail_rules_unique', 'pillar_key', 'cap', 'rule', unique=True),
        {'schema': 'public'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    pillar_key: Mapped[str] = mapped_column(Text, nullable=False)
    cap: Mapped[decimal.Decimal] = mapped_column(Numeric, nullable=False)
    rule: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_enabled: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('true'))


class PillarOverridesHistory(Base):
    __tablename__ = 'pillar_overrides_history'
    __table_args__ = (
        PrimaryKeyConstraint('audit_id', name='pillar_overrides_history_pkey'),
        Index('ix_poh_pillar', 'pillar_key'),
        Index('ix_poh_proj_pil', 'project_id', 'pillar_key'),
        Index('ix_poh_project', 'project_id'),
        Index('ix_poh_txid', 'audit_txid'),
        Index('ix_poh_when', 'audit_ts'),
        {'schema': 'public'}
    )

    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    id: Mapped[str] = mapped_column(String, nullable=False)
    project_id: Mapped[str] = mapped_column(String, nullable=False)
    pillar_key: Mapped[str] = mapped_column(String(60), nullable=False)
    pillar_name: Mapped[str] = mapped_column(String(120), nullable=False)
    audit_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    audit_action: Mapped[str] = mapped_column(Text, nullable=False)
    audit_ts: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    audit_txid: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default=text('txid_current()'))
    weight: Mapped[float] = mapped_column(Double(53), nullable=False)
    score_pct: Mapped[Optional[float]] = mapped_column(Double(53))
    maturity: Mapped[Optional[int]] = mapped_column(Integer)
    audit_user: Mapped[Optional[str]] = mapped_column(Text)
    audit_reason: Mapped[Optional[str]] = mapped_column(Text)
    audit_source: Mapped[Optional[str]] = mapped_column(Text)
    op: Mapped[Optional[str]] = mapped_column(Text)
    changed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    pillar_override_id: Mapped[Optional[str]] = mapped_column(Text)
    audit_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))

"""
class Pillars(Base):
    __tablename__ = 'pillars'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='pillars_pkey'),
        Index('ix_pillars_key', 'key', unique=True),
        {'schema': 'public'}
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    key: Mapped[str] = mapped_column(String(60), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    weight: Mapped[float] = mapped_column(Double(53), nullable=False)

    kpis: Mapped[list['Kpis']] = relationship('Kpis', foreign_keys='[Kpis.pillar_id]', back_populates='pillar')
    kpis_: Mapped[list['Kpis']] = relationship('Kpis', foreign_keys='[Kpis.pillar_id]', back_populates='pillar_')
    pillar_overrides: Mapped[list['PillarOverrides']] = relationship('PillarOverrides', back_populates='pillars')
    kpi_definition: Mapped[list['KpiDefinition']] = relationship('KpiDefinition', back_populates='pillar')
"""

class ProjectPillarScores(Base):
    __tablename__ = 'project_pillar_scores'
    __table_args__ = (
        PrimaryKeyConstraint('project_id', 'pillar_key', name='project_pillar_scores_pkey'),
        {'schema': 'public'}
    )

    project_id: Mapped[str] = mapped_column(Text, primary_key=True)
    pillar_key: Mapped[str] = mapped_column(Text, primary_key=True)
    raw_score_pct: Mapped[decimal.Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    final_score_pct: Mapped[decimal.Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    computed_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))

"""
class Projects(Base):
    __tablename__ = 'entity_projects'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='projects_pkey'),
        Index('ix_projects_slug', 'slug', unique=True),
        Index('projects_slug_key', 'slug', unique=True),
        {'schema': 'public'}
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, server_default=text('(gen_random_uuid())::text'))
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(50), nullable=False)
    target_threshold: Mapped[float] = mapped_column(Double(53), nullable=False)
    priority: Mapped[Optional[str]] = mapped_column(String(50))
    sponsor: Mapped[Optional[str]] = mapped_column(String(100))
    owner: Mapped[Optional[str]] = mapped_column(String(100))
    creation_date: Mapped[Optional[datetime.date]] = mapped_column(Date, server_default=text('CURRENT_DATE'))
    update_date: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    is_high_risk: Mapped[Optional[bool]] = mapped_column(Boolean)

    assessments: Mapped[list['Assessments']] = relationship('Assessments', back_populates='project')
    pillar_overrides: Mapped[list['PillarOverrides']] = relationship('PillarOverrides', back_populates='project')
"""
"""
class ProvenanceArtifacts(Base):
    __tablename__ = 'provenance_artifacts'
    __table_args__ = (
        CheckConstraint("sha256 ~* '^[0-9a-f]{64}$'::text", name='ck_provenance_artifacts_sha256'),
        PrimaryKeyConstraint('id', name='provenance_artifacts_pkey'),
        Index('ix_provenance_artifacts_project', 'project_slug'),
        Index('ix_provenance_artifacts_sha256', 'sha256'),
        {'schema': 'public'}
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_slug: Mapped[str] = mapped_column(String(120), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    uri: Mapped[str] = mapped_column(Text, nullable=False)
    sha256: Mapped[str] = mapped_column(CHAR(64), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger)
    mime: Mapped[Optional[str]] = mapped_column(String(120))
    license_name: Mapped[Optional[str]] = mapped_column(String(200))
    license_url: Mapped[Optional[str]] = mapped_column(Text)
    usage_rights: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[str]] = mapped_column(String(120))

    provenance_datasets: Mapped[list['ProvenanceDatasets']] = relationship('ProvenanceDatasets', back_populates='artifact')
    provenance_evidence: Mapped[list['ProvenanceEvidence']] = relationship('ProvenanceEvidence', back_populates='artifact')
    provenance_models: Mapped[list['ProvenanceModels']] = relationship('ProvenanceModels', back_populates='artifact')


class ProvenanceAudit(Base):
    __tablename__ = 'provenance_audit'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='provenance_audit_pkey'),
        Index('ix_provenance_audit_entity', 'entity_type', 'entity_id', 'at'),
        {'schema': 'public'}
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_id: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    actor: Mapped[Optional[str]] = mapped_column(String(120))
    details_json: Mapped[Optional[dict]] = mapped_column(JSONB)


class ProvenanceEvaluations(Base):
    __tablename__ = 'provenance_evaluations'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='provenance_evaluations_pkey'),
        Index('ix_prov_eval_manifest_hash', 'manifest_hash'),
        Index('ix_prov_eval_project', 'project_slug', 'evaluated_at'),
        {'schema': 'public'}
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_slug: Mapped[str] = mapped_column(String(120), nullable=False)
    overall_level: Mapped[str] = mapped_column(String(8), nullable=False)
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False)
    overall_score_pct: Mapped[float] = mapped_column(Double(53), nullable=False)
    fields_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    gates_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    manifest_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False)
    evaluated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    rules_version: Mapped[Optional[str]] = mapped_column(String(40))
    rules_hash: Mapped[Optional[str]] = mapped_column(CHAR(64))


class ProvenanceLineage(Base):
    __tablename__ = 'provenance_lineage'
    __table_args__ = (
        CheckConstraint("child_type::text = ANY (ARRAY['dataset'::character varying, 'model'::character varying, 'artifact'::character varying, 'evidence'::character varying]::text[])", name='ck_prov_lineage_child_type'),
        CheckConstraint("parent_type::text = ANY (ARRAY['dataset'::character varying, 'model'::character varying, 'artifact'::character varying, 'evidence'::character varying]::text[])", name='ck_prov_lineage_parent_type'),
        PrimaryKeyConstraint('id', name='provenance_lineage_pkey'),
        Index('ix_provenance_lineage_child', 'child_type', 'child_id'),
        Index('ix_provenance_lineage_parent', 'parent_type', 'parent_id'),
        Index('ix_provenance_lineage_project', 'project_slug'),
        {'schema': 'public'}
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    project_slug: Mapped[str] = mapped_column(String(120), nullable=False)
    parent_type: Mapped[str] = mapped_column(String(40), nullable=False)
    parent_id: Mapped[str] = mapped_column(String, nullable=False)
    child_type: Mapped[str] = mapped_column(String(40), nullable=False)
    child_id: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    relationship_: Mapped[Optional[str]] = mapped_column('relationship', String(120))


class ProvenanceManifestFacts(Base):
    __tablename__ = 'provenance_manifest_facts'
    __table_args__ = (
        PrimaryKeyConstraint('project_slug', name='provenance_manifest_facts_pkey'),
        Index('ix_prov_manifest_project', 'project_slug', unique=True),
        {'schema': 'public'}
    )

    project_slug: Mapped[str] = mapped_column(String(120), primary_key=True)
    manifest_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    manifest_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))


class TrustAxisPillarMap(Base):
    __tablename__ = 'trust_axis_pillar_map'
    __table_args__ = (
        PrimaryKeyConstraint('pillar_key', name='trust_axis_pillar_map_pkey'),
        {'schema': 'public'}
    )

    pillar_key: Mapped[str] = mapped_column(String(60), primary_key=True)
    axis_key: Mapped[str] = mapped_column(Enum('safety', 'compliance', 'provenance', name='trust_axis'), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)


class TrustEvaluationAudit(Base):
    __tablename__ = 'trust_evaluation_audit'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='trust_evaluation_audit_pkey'),
        Index('ix_trust_eval_audit_ev', 'evaluation_id', 'at'),
        {'schema': 'public'}
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    evaluation_id: Mapped[str] = mapped_column(Text, nullable=False)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    actor: Mapped[Optional[str]] = mapped_column(Text)
    details_json: Mapped[Optional[dict]] = mapped_column(JSONB)


class TrustEvaluations(Base):
    __tablename__ = 'trust_evaluations'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='trust_evaluations_pkey'),
        Index('ix_trust_eval_project', 'project_slug', 'evaluated_at'),
        {'schema': 'public'}
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    project_slug: Mapped[str] = mapped_column(Text, nullable=False)
    axis_scores: Mapped[dict] = mapped_column(JSONB, nullable=False)
    tol_level: Mapped[str] = mapped_column(Text, nullable=False)
    evaluated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
"""
"""
t_v_pillar_overrides_history_enriched = Table(
    'v_pillar_overrides_history_enriched', Base.metadata,
    Column('score_pct', Double(53)),
    Column('maturity', Integer),
    Column('updated_at', DateTime(True)),
    Column('id', String),
    Column('project_id', String),
    Column('pillar_key', String(60)),
    Column('pillar_name', String(120)),
    Column('audit_id', Uuid),
    Column('audit_action', Text),
    Column('audit_ts', DateTime(True)),
    Column('audit_user', Text),
    Column('audit_txid', BigInteger),
    Column('audit_reason', Text),
    Column('audit_source', Text),
    Column('project_slug', String(120)),
    Column('project_name', String(200)),
    schema='public'
)


t_v_project_pillars_kpis = Table(
    'v_project_pillars_kpis', Base.metadata,
    Column('project_name', String(200)),
    Column('pillar_name', String(120)),
    Column('kpi_name', Text),
    Column('kpi_description', Text),
    Column('kpi_evidence_source', Text),
    Column('kpi_example', Text),
    schema='public'
)
"""
"""
class Assessments(Base):
    __tablename__ = 'assessments'
    __table_args__ = (
        ForeignKeyConstraint(['project_id'], ['public.entity_projects.id'], ondelete='CASCADE', name='assessments_project_id_fkey'),
        PrimaryKeyConstraint('id', name='assessments_pkey'),
        {'schema': 'public'}
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    frozen: Mapped[bool] = mapped_column(Boolean, nullable=False)

    project: Mapped['Projects'] = relationship('Projects', back_populates='assessments')


class ControlValues(Base):
    __tablename__ = 'control_values'
    __table_args__ = (
        ForeignKeyConstraint(['control_id'], ['public.controls.id'], ondelete='CASCADE', name='control_values_control_id_fkey'),
        PrimaryKeyConstraint('project_slug', 'control_id', name='control_values_pkey'),
        {'schema': 'public'}
    )

    project_slug: Mapped[str] = mapped_column(Text, primary_key=True)
    kpi_key: Mapped[str] = mapped_column(Text, nullable=False)
    raw_value: Mapped[float] = mapped_column(Double(53), nullable=False)
    normalized_pct: Mapped[float] = mapped_column(Double(53), nullable=False, server_default=text('0'))
    observed_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    control_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    target_text: Mapped[Optional[str]] = mapped_column(Text)
    target_numeric: Mapped[Optional[int]] = mapped_column(Integer)
    evidence_source: Mapped[Optional[str]] = mapped_column(Text)
    owner_role: Mapped[Optional[str]] = mapped_column(Text)
    frequency: Mapped[Optional[int]] = mapped_column(Integer)
    failure_action: Mapped[Optional[int]] = mapped_column(Integer)
    maturity_anchor_l3: Mapped[Optional[int]] = mapped_column(Integer)
    current_value: Mapped[Optional[int]] = mapped_column(Integer)
    as_of: Mapped[Optional[int]] = mapped_column(Integer)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    kpi_score: Mapped[Optional[int]] = mapped_column(Integer)

    control: Mapped['Controls'] = relationship('Controls', back_populates='control_values')
    evidence: Mapped[list['Evidence']] = relationship('Evidence', back_populates='control_values')


class Kpis(Base):
    __tablename__ = 'kpis'
    __table_args__ = (
        ForeignKeyConstraint(['pillar_id'], ['public.pillars.id'], ondelete='CASCADE', name='fk_kpis_pillar'),
        ForeignKeyConstraint(['pillar_id'], ['public.pillars.id'], ondelete='CASCADE', name='kpis_pillar_id_fkey'),
        PrimaryKeyConstraint('id', name='kpis_pkey'),
        UniqueConstraint('key', name='kpis_key_unique'),
        Index('ix_kpis_key', 'key', unique=True),
        {'schema': 'public'}
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    key: Mapped[str] = mapped_column(String(120), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    pillar_id: Mapped[str] = mapped_column(String, nullable=False)
    unit: Mapped[str] = mapped_column(String(40), nullable=False)
    weight: Mapped[float] = mapped_column(Double(53), nullable=False)
    invert: Mapped[bool] = mapped_column(Boolean, nullable=False)
    min_ideal: Mapped[Optional[float]] = mapped_column(Double(53))
    max_ideal: Mapped[Optional[float]] = mapped_column(Double(53))
    description: Mapped[Optional[str]] = mapped_column(Text)
    example: Mapped[Optional[str]] = mapped_column(Text)

    pillar: Mapped['Pillars'] = relationship('Pillars', foreign_keys=[pillar_id], back_populates='kpis')
    pillar_: Mapped['Pillars'] = relationship('Pillars', foreign_keys=[pillar_id], back_populates='kpis_')
    kpi_definition: Mapped['KpiDefinition'] = relationship('KpiDefinition', uselist=False, foreign_keys='[KpiDefinition.kpi_key]', back_populates='kpis')


class PillarOverrides(Base):
    __tablename__ = 'pillar_overrides'
    __table_args__ = (
        CheckConstraint('score_pct >= 0::double precision AND score_pct <= 100::double precision', name='pillar_overrides_score_pct_check'),
        ForeignKeyConstraint(['pillar_key'], ['public.pillars.key'], ondelete='CASCADE', name='fk_pillar_overrides_pillar'),
        ForeignKeyConstraint(['project_id'], ['public.entity_projects.id'], ondelete='CASCADE', name='fk_pillar_overrides_project'),
        PrimaryKeyConstraint('id', name='pillar_overrides_pkey'),
        UniqueConstraint('project_id', 'pillar_key', name='uq_pillar_overrides_project_pillar'),
        Index('ix_pillar_overrides_project_id', 'project_id'),
        Index('ux_pillar_overrides_project_pillar', 'project_id', 'pillar_key', unique=True),
        {'schema': 'public'}
    )

    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(String, nullable=False)
    pillar_key: Mapped[str] = mapped_column(String(60), nullable=False)
    pillar_name: Mapped[str] = mapped_column(String(120), nullable=False)
    weight: Mapped[float] = mapped_column(Double(53), nullable=False)
    score_pct: Mapped[Optional[float]] = mapped_column(Double(53))
    maturity: Mapped[Optional[int]] = mapped_column(Integer)

    pillars: Mapped['Pillars'] = relationship('Pillars', back_populates='pillar_overrides')
    project: Mapped['Projects'] = relationship('Projects', back_populates='pillar_overrides')


class ProvenanceDatasets(Base):
    __tablename__ = 'provenance_datasets'
    __table_args__ = (
        ForeignKeyConstraint(['artifact_id'], ['public.provenance_artifacts.id'], ondelete='SET NULL', name='provenance_datasets_artifact_id_fkey'),
        PrimaryKeyConstraint('id', name='provenance_datasets_pkey'),
        Index('ix_provenance_datasets_project', 'project_slug'),
        {'schema': 'public'}
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_slug: Mapped[str] = mapped_column(String(120), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    description: Mapped[Optional[str]] = mapped_column(Text)
    artifact_id: Mapped[Optional[str]] = mapped_column(String)
    created_by: Mapped[Optional[str]] = mapped_column(String(120))

    artifact: Mapped[Optional['ProvenanceArtifacts']] = relationship('ProvenanceArtifacts', back_populates='provenance_datasets')


class ProvenanceEvidence(Base):
    __tablename__ = 'provenance_evidence'
    __table_args__ = (
        ForeignKeyConstraint(['artifact_id'], ['public.provenance_artifacts.id'], ondelete='SET NULL', name='provenance_evidence_artifact_id_fkey'),
        PrimaryKeyConstraint('id', name='provenance_evidence_pkey'),
        Index('ix_provenance_evidence_project', 'project_slug'),
        {'schema': 'public'}
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_slug: Mapped[str] = mapped_column(String(120), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    description: Mapped[Optional[str]] = mapped_column(Text)
    artifact_id: Mapped[Optional[str]] = mapped_column(String)
    created_by: Mapped[Optional[str]] = mapped_column(String(120))

    artifact: Mapped[Optional['ProvenanceArtifacts']] = relationship('ProvenanceArtifacts', back_populates='provenance_evidence')


class ProvenanceModels(Base):
    __tablename__ = 'provenance_models'
    __table_args__ = (
        ForeignKeyConstraint(['artifact_id'], ['public.provenance_artifacts.id'], ondelete='SET NULL', name='provenance_models_artifact_id_fkey'),
        PrimaryKeyConstraint('id', name='provenance_models_pkey'),
        Index('ix_provenance_models_project', 'project_slug'),
        {'schema': 'public'}
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_slug: Mapped[str] = mapped_column(String(120), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    version: Mapped[Optional[str]] = mapped_column(String(120))
    framework: Mapped[Optional[str]] = mapped_column(String(120))
    description: Mapped[Optional[str]] = mapped_column(Text)
    artifact_id: Mapped[Optional[str]] = mapped_column(String)
    created_by: Mapped[Optional[str]] = mapped_column(String(120))

    artifact: Mapped[Optional['ProvenanceArtifacts']] = relationship('ProvenanceArtifacts', back_populates='provenance_models')


class Evidence(Base):
    __tablename__ = 'evidence'
    __table_args__ = (
        ForeignKeyConstraint(['project_slug', 'control_id'], ['public.control_values.project_slug', 'public.control_values.control_id'], ondelete='CASCADE', name='fk_evidence_control_values'),
        PrimaryKeyConstraint('id', name='evidence_pkey'),
        Index('ix_evidence_proj_control', 'project_slug', 'control_id'),
        Index('ix_evidence_sha', 'sha256'),
        {'schema': 'public'}
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    project_slug: Mapped[str] = mapped_column(Text, nullable=False)
    control_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    uri: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'pending'::text"))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    mime: Mapped[Optional[str]] = mapped_column(Text)
    size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger)
    sha256: Mapped[Optional[str]] = mapped_column(CHAR(64))
    created_by: Mapped[Optional[str]] = mapped_column(Text)

    control_values: Mapped['ControlValues'] = relationship('ControlValues', back_populates='evidence')
    evidence_audit: Mapped[list['EvidenceAudit']] = relationship('EvidenceAudit', back_populates='evidence')

"""
"""
class KpiDefinition(Kpis):
    __tablename__ = 'kpi_definition'
    __table_args__ = (
        ForeignKeyConstraint(['kpi_id'], ['public.kpis.id'], name='fk_kpi_definition_kpis_id'),
        ForeignKeyConstraint(['kpi_key'], ['public.kpis.key'], name='fk_kpi_definition_kpis_key'),
        ForeignKeyConstraint(['pillar_id'], ['public.pillars.id'], ondelete='CASCADE', name='fk_kpi_definition_pillar'),
        PrimaryKeyConstraint('kpi_id', name='kpi_definition_pkey'),
        UniqueConstraint('kpi_key', name='kpi_definition_kpi_key_unique'),
        Index('ix_kpi_definition_kpi_key', 'kpi_key', unique=True),
        {'schema': 'public'}
    )

    kpi_id: Mapped[str] = mapped_column(String, primary_key=True)
    kpi_key: Mapped[str] = mapped_column(String(120), nullable=False)
    kpi_name: Mapped[str] = mapped_column(String(200), nullable=False)
    pillar_id: Mapped[str] = mapped_column(String, nullable=False)
    unit: Mapped[str] = mapped_column(String(40), nullable=False)
    weight: Mapped[float] = mapped_column(Double(53), nullable=False)
    invert: Mapped[bool] = mapped_column(Boolean, nullable=False)
    min_ideal: Mapped[Optional[float]] = mapped_column(Double(53))
    max_ideal: Mapped[Optional[float]] = mapped_column(Double(53))
    description: Mapped[Optional[str]] = mapped_column(Text)
    example: Mapped[Optional[str]] = mapped_column(Text)
    definition: Mapped[Optional[str]] = mapped_column(Text)
    iso_42001_clause: Mapped[Optional[str]] = mapped_column(Text)
    euaiact_clause: Mapped[Optional[str]] = mapped_column(Text)
    euaiact_chapter: Mapped[Optional[str]] = mapped_column(Text)
    euaiact_section: Mapped[Optional[str]] = mapped_column(Text)
    nist_clause: Mapped[Optional[str]] = mapped_column(Text)
    iso_42001_chapter: Mapped[Optional[str]] = mapped_column(Text)
    coverage_category: Mapped[Optional[str]] = mapped_column(Text)
    regulatory_link: Mapped[Optional[str]] = mapped_column(Text)
    requirement_summary: Mapped[Optional[str]] = mapped_column(Text)

    kpis: Mapped['Kpis'] = relationship('Kpis', foreign_keys=[kpi_key], back_populates='kpi_definition')
    pillar: Mapped['Pillars'] = relationship('Pillars', back_populates='kpi_definition')
"""
"""
class Nistairmf(Base):
    __tablename__ = 'nistairmf'
    __table_args__ = (
        PrimaryKeyConstraint('subcategory', name='nistairmf_pkey'),
        Index('ix_nistairmf_category', 'category'),
        Index('ix_nistairmf_function', 'function'),
        {'schema': 'public'}
    )

    function: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    subcategory: Mapped[str] = mapped_column(Text, primary_key=True)
    statement: Mapped[Optional[str]] = mapped_column(Text)
    references: Mapped[Optional[str]] = mapped_column(Text)

"""
"""
class EvidenceAudit(Base):
    __tablename__ = 'evidence_audit'
    __table_args__ = (
        ForeignKeyConstraint(['evidence_id'], ['public.evidence.id'], ondelete='CASCADE', name='evidence_audit_evidence_id_fkey'),
        PrimaryKeyConstraint('id', name='evidence_audit_pkey'),
        Index('ix_evaudit_action_at', 'action', 'at'),
        Index('ix_evaudit_ev_at', 'evidence_id', 'at'),
        {'schema': 'public'}
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    evidence_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    actor: Mapped[Optional[str]] = mapped_column(Text)
    details_json: Mapped[Optional[dict]] = mapped_column(JSONB)

    evidence: Mapped['Evidence'] = relationship('Evidence', back_populates='evidence_audit')
"""
