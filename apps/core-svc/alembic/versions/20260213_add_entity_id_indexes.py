"""Create indexes on entity_id columns

Revision ID: add_entity_id_indexes_v1
Revises: add_entity_id_to_other_tables_v1
Create Date: 2026-02-13

Creates indexes on entity_id columns for all tables that have it.
Also creates composite indexes where entity_id + other columns are frequently queried together.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "add_entity_id_indexes_v1"
down_revision = "add_entity_id_to_other_tables_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    
    # Core tables
    op.create_index("ix_entity_projects_entity_id", "entity_projects", ["entity_id"])
    op.create_index("ix_aims_scope_entity_id", "aims_scope", ["entity_id"])
    op.create_index("ix_policies_entity_id", "policies", ["entity_id"])
    op.create_index("ix_audit_events_entity_id", "audit_events", ["entity_id"])
    
    # Project-dependent tables
    op.create_index("ix_assessments_entity_id", "assessments", ["entity_id"])
    op.create_index("ix_pillar_overrides_entity_id", "pillar_overrides", ["entity_id"])
    op.create_index("ix_project_translations_entity_id", "project_translations", ["entity_id"])
    op.create_index("ix_project_pillar_scores_entity_id", "project_pillar_scores", ["entity_id"])
    
    # Control & Evidence tables
    op.create_index("ix_control_values_entity_id", "control_values", ["entity_id"])
    op.create_index("ix_control_values_history_entity_id", "control_values_history", ["entity_id"])
    op.create_index("ix_evidence_entity_id", "evidence", ["entity_id"])
    op.create_index("ix_evidence_audit_entity_id", "evidence_audit", ["entity_id"])
    
    # Composite indexes for frequently queried combinations
    op.create_index("ix_control_values_entity_project", "control_values", ["entity_id", "project_slug"])
    op.create_index("ix_evidence_entity_project", "evidence", ["entity_id", "project_slug"])
    op.create_index("ix_project_pillar_scores_entity_project", "project_pillar_scores", ["entity_id", "project_id", "pillar_key"])
    
    # Provenance tables
    if "provenance_artifacts" in inspector.get_table_names():
        op.create_index("ix_provenance_artifacts_entity_id", "provenance_artifacts", ["entity_id"])
        op.create_index("ix_provenance_artifacts_entity_project", "provenance_artifacts", ["entity_id", "project_slug"])
    
    if "provenance_datasets" in inspector.get_table_names():
        op.create_index("ix_provenance_datasets_entity_id", "provenance_datasets", ["entity_id"])
    
    if "provenance_models" in inspector.get_table_names():
        op.create_index("ix_provenance_models_entity_id", "provenance_models", ["entity_id"])
    
    if "provenance_evidence" in inspector.get_table_names():
        op.create_index("ix_provenance_evidence_entity_id", "provenance_evidence", ["entity_id"])
    
    if "provenance_lineage" in inspector.get_table_names():
        op.create_index("ix_provenance_lineage_entity_id", "provenance_lineage", ["entity_id"])
        op.create_index("ix_provenance_lineage_entity_project", "provenance_lineage", ["entity_id", "project_slug"])
    
    if "provenance_evaluations" in inspector.get_table_names():
        op.create_index("ix_provenance_evaluations_entity_id", "provenance_evaluations", ["entity_id"])
        op.create_index("ix_provenance_evaluations_entity_project", "provenance_evaluations", ["entity_id", "project_slug"])
    
    if "provenance_manifest_facts" in inspector.get_table_names():
        op.create_index("ix_provenance_manifest_facts_entity_id", "provenance_manifest_facts", ["entity_id"])
    
    # Trust tables
    if "trust_evaluations" in inspector.get_table_names():
        op.create_index("ix_trust_evaluations_entity_id", "trust_evaluations", ["entity_id"])
        op.create_index("ix_trust_evaluations_entity_project", "trust_evaluations", ["entity_id", "project_slug", "evaluated_at"])
    
    if "trust_evaluation_audit" in inspector.get_table_names():
        op.create_index("ix_trust_evaluation_audit_entity_id", "trust_evaluation_audit", ["entity_id"])
    
    if "trustmarks" in inspector.get_table_names():
        op.create_index("ix_trustmarks_entity_id", "trustmarks", ["entity_id"])
        op.create_index("ix_trustmarks_entity_project", "trustmarks", ["entity_id", "project_id", "issued_at"])
    
    if "trust_monitoring_signals" in inspector.get_table_names():
        op.create_index("ix_trust_monitoring_signals_entity_id", "trust_monitoring_signals", ["entity_id"])
    
    if "trust_decay_events" in inspector.get_table_names():
        op.create_index("ix_trust_decay_events_entity_id", "trust_decay_events", ["entity_id"])
    
    # Other tables
    if "llm_report_cache" in inspector.get_table_names():
        op.create_index("ix_llm_report_cache_entity_id", "llm_report_cache", ["entity_id"])
        op.create_index("ix_llm_report_cache_entity_project", "llm_report_cache", ["entity_id", "project_slug", "provider"])
    
    if "ai_system_registry" in inspector.get_table_names():
        op.create_index("ix_ai_system_registry_entity_id", "ai_system_registry", ["entity_id"])
    
    if "policy_versions" in inspector.get_table_names():
        op.create_index("ix_policy_versions_entity_id", "policy_versions", ["entity_id"])
    
    if "policy_alerts" in inspector.get_table_names():
        op.create_index("ix_policy_alerts_entity_id", "policy_alerts", ["entity_id"])
    
    if "jira_configs" in inspector.get_table_names():
        op.create_index("ix_jira_configs_entity_id", "jira_configs", ["entity_id"])
    
    if "jira_sync_history" in inspector.get_table_names():
        op.create_index("ix_jira_sync_history_entity_id", "jira_sync_history", ["entity_id"])
    
    if "euaiact_entity_definitions" in inspector.get_table_names():
        op.create_index("ix_euaiact_entity_definitions_entity_id", "euaiact_entity_definitions", ["entity_id"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    
    # Drop indexes in reverse order
    if "euaiact_entity_definitions" in inspector.get_table_names():
        op.drop_index("ix_euaiact_entity_definitions_entity_id", table_name="euaiact_entity_definitions")
    
    if "jira_sync_history" in inspector.get_table_names():
        op.drop_index("ix_jira_sync_history_entity_id", table_name="jira_sync_history")
    
    if "jira_configs" in inspector.get_table_names():
        op.drop_index("ix_jira_configs_entity_id", table_name="jira_configs")
    
    if "policy_alerts" in inspector.get_table_names():
        op.drop_index("ix_policy_alerts_entity_id", table_name="policy_alerts")
    
    if "policy_versions" in inspector.get_table_names():
        op.drop_index("ix_policy_versions_entity_id", table_name="policy_versions")
    
    if "ai_system_registry" in inspector.get_table_names():
        op.drop_index("ix_ai_system_registry_entity_id", table_name="ai_system_registry")
    
    if "llm_report_cache" in inspector.get_table_names():
        op.drop_index("ix_llm_report_cache_entity_project", table_name="llm_report_cache")
        op.drop_index("ix_llm_report_cache_entity_id", table_name="llm_report_cache")
    
    if "trust_decay_events" in inspector.get_table_names():
        op.drop_index("ix_trust_decay_events_entity_id", table_name="trust_decay_events")
    
    if "trust_monitoring_signals" in inspector.get_table_names():
        op.drop_index("ix_trust_monitoring_signals_entity_id", table_name="trust_monitoring_signals")
    
    if "trustmarks" in inspector.get_table_names():
        op.drop_index("ix_trustmarks_entity_project", table_name="trustmarks")
        op.drop_index("ix_trustmarks_entity_id", table_name="trustmarks")
    
    if "trust_evaluation_audit" in inspector.get_table_names():
        op.drop_index("ix_trust_evaluation_audit_entity_id", table_name="trust_evaluation_audit")
    
    if "trust_evaluations" in inspector.get_table_names():
        op.drop_index("ix_trust_evaluations_entity_project", table_name="trust_evaluations")
        op.drop_index("ix_trust_evaluations_entity_id", table_name="trust_evaluations")
    
    if "provenance_manifest_facts" in inspector.get_table_names():
        op.drop_index("ix_provenance_manifest_facts_entity_id", table_name="provenance_manifest_facts")
    
    if "provenance_evaluations" in inspector.get_table_names():
        op.drop_index("ix_provenance_evaluations_entity_project", table_name="provenance_evaluations")
        op.drop_index("ix_provenance_evaluations_entity_id", table_name="provenance_evaluations")
    
    if "provenance_lineage" in inspector.get_table_names():
        op.drop_index("ix_provenance_lineage_entity_project", table_name="provenance_lineage")
        op.drop_index("ix_provenance_lineage_entity_id", table_name="provenance_lineage")
    
    if "provenance_evidence" in inspector.get_table_names():
        op.drop_index("ix_provenance_evidence_entity_id", table_name="provenance_evidence")
    
    if "provenance_models" in inspector.get_table_names():
        op.drop_index("ix_provenance_models_entity_id", table_name="provenance_models")
    
    if "provenance_datasets" in inspector.get_table_names():
        op.drop_index("ix_provenance_datasets_entity_id", table_name="provenance_datasets")
    
    if "provenance_artifacts" in inspector.get_table_names():
        op.drop_index("ix_provenance_artifacts_entity_project", table_name="provenance_artifacts")
        op.drop_index("ix_provenance_artifacts_entity_id", table_name="provenance_artifacts")
    
    op.drop_index("ix_evidence_entity_project", table_name="evidence")
    op.drop_index("ix_evidence_entity_id", table_name="evidence")
    op.drop_index("ix_control_values_entity_project", table_name="control_values")
    op.drop_index("ix_control_values_history_entity_id", table_name="control_values_history")
    op.drop_index("ix_control_values_entity_id", table_name="control_values")
    op.drop_index("ix_project_pillar_scores_entity_project", table_name="project_pillar_scores")
    op.drop_index("ix_project_pillar_scores_entity_id", table_name="project_pillar_scores")
    op.drop_index("ix_project_translations_entity_id", table_name="project_translations")
    op.drop_index("ix_pillar_overrides_entity_id", table_name="pillar_overrides")
    op.drop_index("ix_assessments_entity_id", table_name="assessments")
    op.drop_index("ix_audit_events_entity_id", table_name="audit_events")
    op.drop_index("ix_policies_entity_id", table_name="policies")
    op.drop_index("ix_aims_scope_entity_id", table_name="aims_scope")
    op.drop_index("ix_entity_projects_entity_id", table_name="entity_projects")
