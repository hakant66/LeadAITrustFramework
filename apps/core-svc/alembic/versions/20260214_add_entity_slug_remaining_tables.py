"""Add entity_slug to remaining entity-scoped tables

Revision ID: add_entity_slug_remaining_v1
Revises: 27f85b05996e
Create Date: 2026-02-14

Adds entity_slug column (and index, backfill) to tables that have entity_id but were
not included in add_entity_slug_to_tables: trust_*, llm_report_cache, ai_system_registry,
policy_versions, policy_alerts, jira_configs, jira_sync_history, ai_readiness_results,
and conditionally pillar_overrides_history, euaiact_entity_definitions.
Idempotent: skips tables that already have entity_slug.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "add_entity_slug_remaining_v1"
down_revision = "27f85b05996e"
branch_labels = None
depends_on = None

# Tables that have entity_id and should get entity_slug (same pattern as add_entity_slug_to_tables)
TABLES_WITH_ENTITY_ID = [
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
    "ai_readiness_results",
]

# Conditional tables (add entity_slug only if table exists and has entity_id)
CONDITIONAL_TABLES = [
    "pillar_overrides_history",
    "euaiact_entity_definitions",
]


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()

    for table_name in TABLES_WITH_ENTITY_ID + CONDITIONAL_TABLES:
        if table_name not in tables:
            continue
        columns = [col["name"] for col in inspector.get_columns(table_name)]
        if "entity_id" not in columns or "entity_slug" in columns:
            continue

        op.add_column(
            table_name,
            sa.Column("entity_slug", sa.Text(), nullable=True),
        )
        op.create_index(
            f"ix_{table_name}_entity_slug",
            table_name,
            ["entity_slug"],
        )

    # Backfill entity_slug from entity table
    for table_name in TABLES_WITH_ENTITY_ID + CONDITIONAL_TABLES:
        if table_name not in tables:
            continue
        columns = [col["name"] for col in inspector.get_columns(table_name)]
        if "entity_id" not in columns or "entity_slug" not in columns:
            continue

        op.execute(
            sa.text(f"""
                UPDATE {table_name} t
                SET entity_slug = e.slug
                FROM entity e
                WHERE t.entity_id = e.id AND (t.entity_slug IS NULL OR t.entity_slug = '')
            """)
        )


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()

    for table_name in reversed(TABLES_WITH_ENTITY_ID + CONDITIONAL_TABLES):
        if table_name not in tables:
            continue
        columns = [col["name"] for col in inspector.get_columns(table_name)]
        if "entity_slug" not in columns:
            continue

        indexes = [idx["name"] for idx in inspector.get_indexes(table_name)]
        if f"ix_{table_name}_entity_slug" in indexes:
            op.drop_index(f"ix_{table_name}_entity_slug", table_name=table_name)
        op.drop_column(table_name, "entity_slug")
