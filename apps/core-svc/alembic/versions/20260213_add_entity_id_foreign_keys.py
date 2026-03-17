"""Add foreign key constraints for entity_id columns

Revision ID: add_entity_id_foreign_keys_v1
Revises: add_entity_id_indexes_v1
Create Date: 2026-02-13

Adds foreign key constraints for all entity_id columns pointing to entity.id.
Uses CASCADE delete for dependent tables, SET NULL for optional relationships.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "add_entity_id_foreign_keys_v1"
down_revision = "add_entity_id_indexes_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    
    # Core tables - CASCADE delete (entity deletion removes all data)
    op.create_foreign_key(
        "fk_entity_projects_entity_id",
        "entity_projects", "entity",
        ["entity_id"], ["id"],
        ondelete="CASCADE"
    )
    
    op.create_foreign_key(
        "fk_aims_scope_entity_id",
        "aims_scope", "entity",
        ["entity_id"], ["id"],
        ondelete="CASCADE"
    )
    
    op.create_foreign_key(
        "fk_policies_entity_id",
        "policies", "entity",
        ["entity_id"], ["id"],
        ondelete="CASCADE"
    )
    
    op.create_foreign_key(
        "fk_audit_events_entity_id",
        "audit_events", "entity",
        ["entity_id"], ["id"],
        ondelete="CASCADE"
    )
    
    if "euaiact_entity_definitions" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_euaiact_entity_definitions_entity_id",
            "euaiact_entity_definitions", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    if "jira_configs" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_jira_configs_entity_id",
            "jira_configs", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    # Project-dependent tables - CASCADE (via project relationship)
    op.create_foreign_key(
        "fk_assessments_entity_id",
        "assessments", "entity",
        ["entity_id"], ["id"],
        ondelete="CASCADE"
    )
    
    op.create_foreign_key(
        "fk_pillar_overrides_entity_id",
        "pillar_overrides", "entity",
        ["entity_id"], ["id"],
        ondelete="CASCADE"
    )
    
    if "pillar_overrides_history" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_pillar_overrides_history_entity_id",
            "pillar_overrides_history", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    op.create_foreign_key(
        "fk_project_translations_entity_id",
        "project_translations", "entity",
        ["entity_id"], ["id"],
        ondelete="CASCADE"
    )
    
    op.create_foreign_key(
        "fk_project_pillar_scores_entity_id",
        "project_pillar_scores", "entity",
        ["entity_id"], ["id"],
        ondelete="CASCADE"
    )
    
    # Control & Evidence tables - CASCADE
    op.create_foreign_key(
        "fk_control_values_entity_id",
        "control_values", "entity",
        ["entity_id"], ["id"],
        ondelete="CASCADE"
    )
    
    op.create_foreign_key(
        "fk_control_values_history_entity_id",
        "control_values_history", "entity",
        ["entity_id"], ["id"],
        ondelete="CASCADE"
    )
    
    op.create_foreign_key(
        "fk_evidence_entity_id",
        "evidence", "entity",
        ["entity_id"], ["id"],
        ondelete="CASCADE"
    )
    
    op.create_foreign_key(
        "fk_evidence_audit_entity_id",
        "evidence_audit", "entity",
        ["entity_id"], ["id"],
        ondelete="CASCADE"
    )
    
    # Provenance tables - CASCADE
    if "provenance_artifacts" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_provenance_artifacts_entity_id",
            "provenance_artifacts", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    if "provenance_datasets" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_provenance_datasets_entity_id",
            "provenance_datasets", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    if "provenance_models" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_provenance_models_entity_id",
            "provenance_models", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    if "provenance_evidence" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_provenance_evidence_entity_id",
            "provenance_evidence", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    if "provenance_lineage" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_provenance_lineage_entity_id",
            "provenance_lineage", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    if "provenance_evaluations" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_provenance_evaluations_entity_id",
            "provenance_evaluations", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    if "provenance_manifest_facts" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_provenance_manifest_facts_entity_id",
            "provenance_manifest_facts", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    # Trust tables - CASCADE
    if "trust_evaluations" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_trust_evaluations_entity_id",
            "trust_evaluations", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    if "trust_evaluation_audit" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_trust_evaluation_audit_entity_id",
            "trust_evaluation_audit", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    if "trustmarks" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_trustmarks_entity_id",
            "trustmarks", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    if "trust_monitoring_signals" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_trust_monitoring_signals_entity_id",
            "trust_monitoring_signals", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    if "trust_decay_events" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_trust_decay_events_entity_id",
            "trust_decay_events", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    # Other tables
    if "llm_report_cache" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_llm_report_cache_entity_id",
            "llm_report_cache", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    if "ai_system_registry" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_ai_system_registry_entity_id",
            "ai_system_registry", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    if "policy_versions" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_policy_versions_entity_id",
            "policy_versions", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    if "policy_alerts" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_policy_alerts_entity_id",
            "policy_alerts", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )
    
    if "jira_sync_history" in inspector.get_table_names():
        op.create_foreign_key(
            "fk_jira_sync_history_entity_id",
            "jira_sync_history", "entity",
            ["entity_id"], ["id"],
            ondelete="CASCADE"
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    
    # Drop foreign keys in reverse order
    if "jira_sync_history" in inspector.get_table_names():
        op.drop_constraint("fk_jira_sync_history_entity_id", "jira_sync_history", type_="foreignkey")
    
    if "policy_alerts" in inspector.get_table_names():
        op.drop_constraint("fk_policy_alerts_entity_id", "policy_alerts", type_="foreignkey")
    
    if "policy_versions" in inspector.get_table_names():
        op.drop_constraint("fk_policy_versions_entity_id", "policy_versions", type_="foreignkey")
    
    if "ai_system_registry" in inspector.get_table_names():
        op.drop_constraint("fk_ai_system_registry_entity_id", "ai_system_registry", type_="foreignkey")
    
    if "llm_report_cache" in inspector.get_table_names():
        op.drop_constraint("fk_llm_report_cache_entity_id", "llm_report_cache", type_="foreignkey")
    
    if "trust_decay_events" in inspector.get_table_names():
        op.drop_constraint("fk_trust_decay_events_entity_id", "trust_decay_events", type_="foreignkey")
    
    if "trust_monitoring_signals" in inspector.get_table_names():
        op.drop_constraint("fk_trust_monitoring_signals_entity_id", "trust_monitoring_signals", type_="foreignkey")
    
    if "trustmarks" in inspector.get_table_names():
        op.drop_constraint("fk_trustmarks_entity_id", "trustmarks", type_="foreignkey")
    
    if "trust_evaluation_audit" in inspector.get_table_names():
        op.drop_constraint("fk_trust_evaluation_audit_entity_id", "trust_evaluation_audit", type_="foreignkey")
    
    if "trust_evaluations" in inspector.get_table_names():
        op.drop_constraint("fk_trust_evaluations_entity_id", "trust_evaluations", type_="foreignkey")
    
    if "provenance_manifest_facts" in inspector.get_table_names():
        op.drop_constraint("fk_provenance_manifest_facts_entity_id", "provenance_manifest_facts", type_="foreignkey")
    
    if "provenance_evaluations" in inspector.get_table_names():
        op.drop_constraint("fk_provenance_evaluations_entity_id", "provenance_evaluations", type_="foreignkey")
    
    if "provenance_lineage" in inspector.get_table_names():
        op.drop_constraint("fk_provenance_lineage_entity_id", "provenance_lineage", type_="foreignkey")
    
    if "provenance_evidence" in inspector.get_table_names():
        op.drop_constraint("fk_provenance_evidence_entity_id", "provenance_evidence", type_="foreignkey")
    
    if "provenance_models" in inspector.get_table_names():
        op.drop_constraint("fk_provenance_models_entity_id", "provenance_models", type_="foreignkey")
    
    if "provenance_datasets" in inspector.get_table_names():
        op.drop_constraint("fk_provenance_datasets_entity_id", "provenance_datasets", type_="foreignkey")
    
    if "provenance_artifacts" in inspector.get_table_names():
        op.drop_constraint("fk_provenance_artifacts_entity_id", "provenance_artifacts", type_="foreignkey")
    
    op.drop_constraint("fk_evidence_audit_entity_id", "evidence_audit", type_="foreignkey")
    op.drop_constraint("fk_evidence_entity_id", "evidence", type_="foreignkey")
    op.drop_constraint("fk_control_values_history_entity_id", "control_values_history", type_="foreignkey")
    op.drop_constraint("fk_control_values_entity_id", "control_values", type_="foreignkey")
    op.drop_constraint("fk_project_pillar_scores_entity_id", "project_pillar_scores", type_="foreignkey")
    op.drop_constraint("fk_project_translations_entity_id", "project_translations", type_="foreignkey")
    
    if "pillar_overrides_history" in inspector.get_table_names():
        op.drop_constraint("fk_pillar_overrides_history_entity_id", "pillar_overrides_history", type_="foreignkey")
    
    op.drop_constraint("fk_pillar_overrides_entity_id", "pillar_overrides", type_="foreignkey")
    op.drop_constraint("fk_assessments_entity_id", "assessments", type_="foreignkey")
    
    if "jira_configs" in inspector.get_table_names():
        op.drop_constraint("fk_jira_configs_entity_id", "jira_configs", type_="foreignkey")
    
    if "euaiact_entity_definitions" in inspector.get_table_names():
        op.drop_constraint("fk_euaiact_entity_definitions_entity_id", "euaiact_entity_definitions", type_="foreignkey")
    
    op.drop_constraint("fk_audit_events_entity_id", "audit_events", type_="foreignkey")
    op.drop_constraint("fk_policies_entity_id", "policies", type_="foreignkey")
    op.drop_constraint("fk_aims_scope_entity_id", "aims_scope", type_="foreignkey")
    op.drop_constraint("fk_entity_projects_entity_id", "entity_projects", type_="foreignkey")
