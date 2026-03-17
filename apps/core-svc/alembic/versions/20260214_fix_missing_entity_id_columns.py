"""Fix missing entity_id columns

Revision ID: fix_missing_entity_id_v1
Revises: add_entity_slug_remaining_v1
Create Date: 2026-02-14

Idempotent migration to add missing entity_id columns to tables that should have them
but don't (e.g., if migrations were stamped without running, or DB restored from backup).
This migration checks for column existence before adding, so it's safe to run even if
some columns already exist.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision = "fix_missing_entity_id_v1"
down_revision = "add_entity_slug_remaining_v1"
branch_labels = None
depends_on = None

# Tables that should have entity_id (from the original entity_id migrations)
TABLES_WITH_ENTITY_ID = {
    # Core tables
    "entity_projects": None,  # Already has it, but check anyway
    "aims_scope": None,
    "policies": None,
    "audit_events": None,
    # Project-dependent tables
    "assessments": "project_id",
    "pillar_overrides": "project_id",
    "pillar_overrides_history": "project_id",  # Conditional
    "project_translations": "project_id",
    "project_pillar_scores": "project_id",
    # Control & evidence tables
    "control_values": "project_slug",
    "control_values_history": "project_slug",
    "evidence": "project_slug",
    "evidence_audit": "evidence_id",  # Via evidence relationship
    # Provenance tables
    "provenance_artifacts": "project_slug",
    "provenance_datasets": "project_slug",
    "provenance_models": "project_slug",
    "provenance_evidence": "project_slug",
    "provenance_lineage": "project_slug",
    "provenance_evaluations": "project_slug",
    "provenance_manifest_facts": "project_slug",
    # Trust tables
    "trust_evaluations": "project_slug",
    "trust_evaluation_audit": "evaluation_id",  # Via trust_evaluations
    "trustmarks": "project_slug",
    "trust_monitoring_signals": "project_slug",
    "trust_decay_events": "project_slug",
    # Other tables
    "llm_report_cache": "project_slug",
    "ai_system_registry": "project_slug",
    "policy_versions": "policy_id",  # Via policies
    "policy_alerts": "policy_id",  # Via policies
    "jira_configs": None,  # Entity-scoped directly
    "jira_sync_history": "config_id",  # Via jira_configs
    "jira_sync_metadata": "project_slug",
    "jira_risk_register": "project_slug",
    "ai_requirement_register": "project_slug",
    "ai_readiness_results": "project_slug",
    # Conditional tables
    "euaiact_entity_definitions": None,  # Entity-scoped directly
}


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()
    conn = op.get_bind()

    # Step 1: Add missing entity_id columns
    for table_name, relationship_col in TABLES_WITH_ENTITY_ID.items():
        if table_name not in tables:
            continue
        columns = [col["name"] for col in inspector.get_columns(table_name)]
        if "entity_id" in columns:
            continue  # Already has entity_id

        op.add_column(
            table_name,
            sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
        print(f"Added entity_id column to {table_name}")

    # Step 2: Backfill entity_id from relationships
    # Get default entity (or first entity)
    result = conn.execute(sa.text("SELECT id FROM entity LIMIT 1"))
    default_entity_row = result.fetchone()
    if not default_entity_row:
        # Create default entity if none exists
        conn.execute(sa.text("""
            INSERT INTO entity (id, full_legal_name, slug, status)
            VALUES (gen_random_uuid(), 'Default Entity', 'default-entity', 'active')
            RETURNING id
        """))
        result = conn.execute(sa.text("SELECT id FROM entity WHERE slug = 'default-entity'"))
        default_entity_id = result.fetchone()[0]
    else:
        default_entity_id = default_entity_row[0]

    # Backfill via project relationship (tables with project_slug or project_id)
    for table_name, relationship_col in TABLES_WITH_ENTITY_ID.items():
        if table_name not in tables:
            continue
        columns = [col["name"] for col in inspector.get_columns(table_name)]
        if "entity_id" not in columns:
            continue

        if relationship_col == "project_slug":
            # Backfill via entity_projects.project_slug
            conn.execute(sa.text(f"""
                UPDATE {table_name} t
                SET entity_id = p.entity_id
                FROM entity_projects p
                WHERE t.project_slug = p.slug AND t.entity_id IS NULL
            """))
            # Set default for any remaining NULLs
            conn.execute(sa.text(f"""
                UPDATE {table_name}
                SET entity_id = :entity_id
                WHERE entity_id IS NULL
            """).bindparams(entity_id=default_entity_id))
        elif relationship_col == "project_id":
            # Backfill via entity_projects.id
            conn.execute(sa.text(f"""
                UPDATE {table_name} t
                SET entity_id = p.entity_id
                FROM entity_projects p
                WHERE t.project_id = p.id AND t.entity_id IS NULL
            """))
            # Set default for any remaining NULLs
            conn.execute(sa.text(f"""
                UPDATE {table_name}
                SET entity_id = :entity_id
                WHERE entity_id IS NULL
            """).bindparams(entity_id=default_entity_id))
        elif relationship_col == "evidence_id":
            # Backfill via evidence.entity_id
            conn.execute(sa.text(f"""
                UPDATE {table_name} t
                SET entity_id = e.entity_id
                FROM evidence e
                WHERE t.evidence_id = e.id AND t.entity_id IS NULL
            """))
        elif relationship_col == "policy_id":
            # Backfill via policies.entity_id
            conn.execute(sa.text(f"""
                UPDATE {table_name} t
                SET entity_id = p.entity_id
                FROM policies p
                WHERE t.policy_id = p.id AND t.entity_id IS NULL
            """))
        elif relationship_col == "config_id":
            # Backfill via jira_configs.entity_id
            conn.execute(sa.text(f"""
                UPDATE {table_name} t
                SET entity_id = jc.entity_id
                FROM jira_configs jc
                WHERE t.config_id = jc.id AND t.entity_id IS NULL
            """))
        elif relationship_col == "evaluation_id":
            # Backfill via trust_evaluations.entity_id
            conn.execute(sa.text(f"""
                UPDATE {table_name} t
                SET entity_id = te.entity_id
                FROM trust_evaluations te
                WHERE t.evaluation_id = te.id AND t.entity_id IS NULL
            """))
        elif relationship_col is None:
            # Entity-scoped directly (aims_scope, policies, audit_events, jira_configs, euaiact_entity_definitions)
            # Set to default entity if NULL
            conn.execute(sa.text(f"""
                UPDATE {table_name}
                SET entity_id = :entity_id
                WHERE entity_id IS NULL
            """).bindparams(entity_id=default_entity_id))

    # Step 3: Add indexes on entity_id (if missing)
    for table_name in TABLES_WITH_ENTITY_ID.keys():
        if table_name not in tables:
            continue
        columns = [col["name"] for col in inspector.get_columns(table_name)]
        if "entity_id" not in columns:
            continue

        indexes = [idx["name"] for idx in inspector.get_indexes(table_name)]
        index_name = f"ix_{table_name}_entity_id"
        if index_name not in indexes:
            op.create_index(index_name, table_name, ["entity_id"])
            print(f"Created index {index_name}")

    # Step 4: Add foreign key constraints (if missing)
    for table_name in TABLES_WITH_ENTITY_ID.keys():
        if table_name not in tables:
            continue
        columns = [col["name"] for col in inspector.get_columns(table_name)]
        if "entity_id" not in columns:
            continue

        # Check if FK constraint exists
        fk_name = f"fk_{table_name}_entity_id"
        fks = [
            fk["name"]
            for fk in inspector.get_foreign_keys(table_name)
            if fk["name"] == fk_name
        ]
        if fk_name not in fks:
            op.create_foreign_key(
                fk_name,
                table_name,
                "entity",
                ["entity_id"],
                ["id"],
                ondelete="CASCADE",
            )
            print(f"Created foreign key {fk_name}")


def downgrade() -> None:
    # Don't remove entity_id columns - data would be orphaned
    # This migration is meant to fix missing columns, not remove them
    pass
