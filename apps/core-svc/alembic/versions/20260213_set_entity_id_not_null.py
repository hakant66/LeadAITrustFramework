"""Set entity_id NOT NULL constraints

Revision ID: set_entity_id_not_null_v1
Revises: backfill_entity_id_v1
Create Date: 2026-02-13

After backfilling all entity_id values, enforce NOT NULL constraints.
This ensures data integrity going forward.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "set_entity_id_not_null_v1"
down_revision = "backfill_entity_id_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    
    # List of tables that should have entity_id NOT NULL
    # Core tables
    core_tables = [
        "entity_projects",
        "aims_scope",
        "policies",
        "audit_events",
    ]
    
    # Project-dependent tables
    project_tables = [
        "assessments",
        "pillar_overrides",
        "project_translations",
        "project_pillar_scores",
    ]
    
    # Control & evidence tables
    control_evidence_tables = [
        "control_values",
        "control_values_history",
        "evidence",
        "evidence_audit",
    ]
    
    # Provenance tables
    provenance_tables = [
        "provenance_artifacts",
        "provenance_datasets",
        "provenance_models",
        "provenance_evidence",
        "provenance_lineage",
        "provenance_evaluations",
        "provenance_manifest_facts",
    ]
    
    # Trust tables
    trust_tables = [
        "trust_evaluations",
        "trust_evaluation_audit",
        "trustmarks",
        "trust_monitoring_signals",
        "trust_decay_events",
    ]
    
    # Other tables
    other_tables = [
        "llm_report_cache",
        "ai_system_registry",
        "policy_versions",
        "policy_alerts",
        "jira_configs",
        "jira_sync_history",
        "ai_readiness_results",
    ]
    
    # Conditional tables (check existence first)
    conditional_tables = [
        "pillar_overrides_history",
        "euaiact_entity_definitions",
    ]
    
    all_tables = (
        core_tables +
        project_tables +
        control_evidence_tables +
        provenance_tables +
        trust_tables +
        other_tables +
        conditional_tables
    )
    
    # Set NOT NULL for each table that exists and has entity_id column
    for table_name in all_tables:
        if table_name not in tables:
            continue
            
        # Check if entity_id column exists
        columns = [col["name"] for col in inspector.get_columns(table_name)]
        if "entity_id" not in columns:
            continue
        
        # Verify no NULL values exist before setting NOT NULL
        result = conn.execute(sa.text(f"SELECT COUNT(*) FROM {table_name} WHERE entity_id IS NULL"))
        null_count = result.scalar()
        
        if null_count > 0:
            raise ValueError(
                f"Cannot set entity_id NOT NULL on {table_name}: "
                f"{null_count} rows still have NULL entity_id. "
                f"Run backfill migration first."
            )
        
        # Set NOT NULL constraint
        op.alter_column(
            table_name,
            "entity_id",
            nullable=False,
            existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        )


def downgrade() -> None:
    # Revert NOT NULL constraints back to nullable
    # This is safe as we're just allowing NULLs again
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    
    # Same list of tables as upgrade
    core_tables = [
        "entity_projects",
        "aims_scope",
        "policies",
        "audit_events",
    ]
    
    project_tables = [
        "assessments",
        "pillar_overrides",
        "project_translations",
        "project_pillar_scores",
    ]
    
    control_evidence_tables = [
        "control_values",
        "control_values_history",
        "evidence",
        "evidence_audit",
    ]
    
    provenance_tables = [
        "provenance_artifacts",
        "provenance_datasets",
        "provenance_models",
        "provenance_evidence",
        "provenance_lineage",
        "provenance_evaluations",
        "provenance_manifest_facts",
    ]
    
    trust_tables = [
        "trust_evaluations",
        "trust_evaluation_audit",
        "trustmarks",
        "trust_monitoring_signals",
        "trust_decay_events",
    ]
    
    other_tables = [
        "llm_report_cache",
        "ai_system_registry",
        "policy_versions",
        "policy_alerts",
        "jira_configs",
        "jira_sync_history",
        "ai_readiness_results",
    ]
    
    conditional_tables = [
        "pillar_overrides_history",
        "euaiact_entity_definitions",
    ]
    
    all_tables = (
        core_tables +
        project_tables +
        control_evidence_tables +
        provenance_tables +
        trust_tables +
        other_tables +
        conditional_tables
    )
    
    for table_name in all_tables:
        if table_name not in tables:
            continue
            
        columns = [col["name"] for col in inspector.get_columns(table_name)]
        if "entity_id" not in columns:
            continue
        
        op.alter_column(
            table_name,
            "entity_id",
            nullable=True,
            existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        )
