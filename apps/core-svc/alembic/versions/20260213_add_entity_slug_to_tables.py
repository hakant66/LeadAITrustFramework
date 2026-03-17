"""Add entity_slug to tables that need entity differentiation

Revision ID: add_entity_slug_to_tables_v1
Revises: 70263fbd24af
Create Date: 2026-02-13

Adds entity_slug column to tables that reference entities, similar to how project_slug
is used for projects. This enables human-readable entity identification in queries and URLs.
Entity_slug is derived from entity.slug via foreign key relationship.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "add_entity_slug_to_tables_v1"
down_revision = "6f0414811b80"  # merge_user_mapping_and_constraints
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()
    
    # Tables that have entity_id and should have entity_slug
    # Similar pattern to project_slug in tables like provenance_artifacts, etc.
    tables_with_entity_id = [
        "aims_scope",
        "policies",
        "audit_events",
        "entity_projects",  # Already has entity_id, add entity_slug for consistency
        "assessments",
        "pillar_overrides",
        "project_translations",
        "project_pillar_scores",
        "control_values",
        "control_values_history",
        "evidence",
        "evidence_audit",
        "jira_sync_metadata",
        "jira_risk_register",
        "ai_requirement_register",
    ]
    
    # Provenance tables that have project_slug - add entity_slug too
    provenance_tables = [
        "provenance_artifacts",
        "provenance_datasets",
        "provenance_models",
        "provenance_evidence",
        "provenance_lineage",
        "provenance_evaluations",
        "provenance_manifest_facts",
    ]
    
    # Add entity_slug to tables with entity_id
    for table_name in tables_with_entity_id:
        if table_name in tables:
            columns = [col["name"] for col in inspector.get_columns(table_name)]
            if "entity_id" in columns and "entity_slug" not in columns:
                op.add_column(
                    table_name,
                    sa.Column("entity_slug", sa.Text(), nullable=True)
                )
                # Create index for faster lookups
                op.create_index(
                    f"ix_{table_name}_entity_slug",
                    table_name,
                    ["entity_slug"]
                )
    
    # Add entity_slug to provenance tables (they have project_slug, add entity_slug)
    for table_name in provenance_tables:
        if table_name in tables:
            columns = [col["name"] for col in inspector.get_columns(table_name)]
            if "entity_slug" not in columns:
                op.add_column(
                    table_name,
                    sa.Column("entity_slug", sa.Text(), nullable=True)
                )
                # Create index
                op.create_index(
                    f"ix_{table_name}_entity_slug",
                    table_name,
                    ["entity_slug"]
                )
    
    # Backfill entity_slug from entity table
    # For tables with entity_id, join with entity table to get slug
    conn = op.get_bind()
    
    # Backfill entity_slug for tables with entity_id
    for table_name in tables_with_entity_id:
        if table_name in tables:
            columns = [col["name"] for col in inspector.get_columns(table_name)]
            if "entity_id" in columns and "entity_slug" in columns:
                op.execute(sa.text(f"""
                    UPDATE {table_name} t
                    SET entity_slug = e.slug
                    FROM entity e
                    WHERE t.entity_id = e.id AND t.entity_slug IS NULL
                """))
    
    # Backfill entity_slug for provenance tables via project relationship
    for table_name in provenance_tables:
        if table_name in tables:
            columns = [col["name"] for col in inspector.get_columns(table_name)]
            if "project_slug" in columns and "entity_slug" in columns:
                op.execute(sa.text(f"""
                    UPDATE {table_name} t
                    SET entity_slug = e.slug
                    FROM entity_projects p
                    JOIN entity e ON p.entity_id = e.id
                    WHERE t.project_slug = p.slug AND t.entity_slug IS NULL
                """))


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()
    
    # Drop indexes first
    for table_name in tables:
        columns = [col["name"] for col in inspector.get_columns(table_name)]
        if "entity_slug" in columns:
            try:
                op.drop_index(f"ix_{table_name}_entity_slug", table_name=table_name)
            except Exception:
                pass  # Index might not exist
    
    # Drop columns
    for table_name in tables:
        columns = [col["name"] for col in inspector.get_columns(table_name)]
        if "entity_slug" in columns:
            op.drop_column(table_name, "entity_slug")
