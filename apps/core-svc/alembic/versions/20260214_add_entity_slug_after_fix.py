"""Add entity_slug to tables that now have entity_id

Revision ID: add_entity_slug_after_fix_v1
Revises: fix_missing_entity_id_v1
Create Date: 2026-02-14

After fix_missing_entity_id_v1 added entity_id columns, add entity_slug to those tables
that should have it but don't yet (because add_entity_slug_remaining_v1 ran before entity_id existed).
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "add_entity_slug_after_fix_v1"
down_revision = "fix_missing_entity_id_v1"
branch_labels = None
depends_on = None

# Tables that should have entity_slug if they have entity_id
TABLES_TO_CHECK = [
    "control_values",
    "control_values_history",
    "evidence",
    "evidence_audit",
    "trust_evaluations",
    "trust_evaluation_audit",
    "trustmarks",
    "trust_monitoring_signals",
    "trust_decay_events",
    "llm_report_cache",
    "ai_system_registry",
    "policy_versions",
    "policy_alerts",
    "jira_configs",
    "jira_sync_history",
    "jira_sync_metadata",
    "jira_risk_register",
    "ai_requirement_register",
    "ai_readiness_results",
    "provenance_artifacts",
    "provenance_datasets",
    "provenance_models",
    "provenance_evidence",
    "provenance_lineage",
    "provenance_evaluations",
    "provenance_manifest_facts",
    "assessments",
    "pillar_overrides",
    "project_translations",
    "project_pillar_scores",
    "policies",
    "audit_events",
    "pillar_overrides_history",
    "euaiact_entity_definitions",
]


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()

    # Add entity_slug column and index where missing
    for table_name in TABLES_TO_CHECK:
        if table_name not in tables:
            continue
        columns = [col["name"] for col in inspector.get_columns(table_name)]
        if "entity_id" not in columns or "entity_slug" in columns:
            continue  # Skip if no entity_id or already has entity_slug

        op.add_column(
            table_name,
            sa.Column("entity_slug", sa.Text(), nullable=True),
        )
        op.create_index(
            f"ix_{table_name}_entity_slug",
            table_name,
            ["entity_slug"],
        )
        print(f"Added entity_slug column and index to {table_name}")

    # Backfill entity_slug from entity table (for tables with entity_id)
    conn = op.get_bind()
    for table_name in TABLES_TO_CHECK:
        if table_name not in tables:
            continue
        columns = [col["name"] for col in inspector.get_columns(table_name)]
        if "entity_id" not in columns or "entity_slug" not in columns:
            continue

        # Backfill via entity_id -> entity.slug
        conn.execute(sa.text(f"""
            UPDATE {table_name} t
            SET entity_slug = e.slug
            FROM entity e
            WHERE t.entity_id = e.id AND (t.entity_slug IS NULL OR t.entity_slug = '')
        """))
        print(f"Backfilled entity_slug for {table_name}")


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()

    for table_name in reversed(TABLES_TO_CHECK):
        if table_name not in tables:
            continue
        columns = [col["name"] for col in inspector.get_columns(table_name)]
        if "entity_slug" not in columns:
            continue

        indexes = [idx["name"] for idx in inspector.get_indexes(table_name)]
        if f"ix_{table_name}_entity_slug" in indexes:
            op.drop_index(f"ix_{table_name}_entity_slug", table_name=table_name)
        op.drop_column(table_name, "entity_slug")
