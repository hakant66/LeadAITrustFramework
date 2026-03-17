"""Backfill empty entity_id and entity_slug with Blueprint entity

Revision ID: backfill_entity_blueprint_v1
Revises: ensure_user_entity_access_v1
Create Date: 2026-02-17

Sets NULL entity_id to Blueprint entity (acfd8ccd-29d3-4109-990f-6d71ce8c588e)
and NULL/empty entity_slug to 'blueprint-limited' for all tables that have
these columns. Skips user_entity_access (entity_id there is user-to-entity
assignment, not data ownership).
Idempotent: only updates WHERE entity_id IS NULL / entity_slug IS NULL OR = ''.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "backfill_entity_blueprint_v1"
down_revision = "ensure_user_entity_access_v1"
branch_labels = None
depends_on = None

BLUEPRINT_ENTITY_ID = "acfd8ccd-29d3-4109-990f-6d71ce8c588e"
BLUEPRINT_ENTITY_SLUG = "blueprint-limited"

# Do not backfill entity_id in these tables
SKIP_ENTITY_ID_BACKFILL = frozenset({
    "user_entity_access", "user_mapping",  # entity_id = user-to-entity assignment
    "provenance_artifacts",  # immutable trigger
    "control_values", "control_values_history",  # audit trigger / history table
})
# Do not UPDATE these tables (triggers or schema mismatch would break)
SKIP_ALL_BACKFILL = frozenset({
    "provenance_artifacts",  # immutable trigger
    "control_values",  # audit trigger INSERT assumes column order; updating breaks it
    "control_values_history",  # history table; avoid direct UPDATE
})


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    for table_name in tables:
        columns = [c["name"] for c in insp.get_columns(table_name)]

        if "entity_id" in columns and table_name not in SKIP_ENTITY_ID_BACKFILL:
            # Use literal ::uuid so PostgreSQL gets correct type (bindparam sent as varchar otherwise)
            bind.execute(
                sa.text(
                    f"UPDATE \"{table_name}\" SET entity_id = '{BLUEPRINT_ENTITY_ID}'::uuid WHERE entity_id IS NULL"
                )
            )

        if "entity_slug" in columns and table_name not in SKIP_ALL_BACKFILL:
            bind.execute(
                sa.text(
                    f"""UPDATE "{table_name}" SET entity_slug = :slug
                    WHERE entity_slug IS NULL OR entity_slug = ''"""
                ).bindparams(slug=BLUEPRINT_ENTITY_SLUG)
            )


def downgrade() -> None:
    # No automatic downgrade: we don't know which rows were backfilled by this
    # migration vs already set. Manual revert would require a snapshot.
    pass
