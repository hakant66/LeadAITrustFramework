"""backfill entity_policy_register iso fields by title match

Revision ID: 20260220_backfill_entity_policy_register_iso_by_title
Revises: 20260220_backfill_entity_policy_register_iso_fields
Create Date: 2026-02-20
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260220_backfill_entity_policy_register_iso_by_title"
down_revision = "20260220_backfill_entity_policy_register_iso_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE entity_policy_register epr
            SET iso42001_requirements = p.iso42001_requirement,
                iso42001_status = p.iso42001_status,
                comment = p.comment,
                action = p.action
            FROM policies p
            WHERE p.title = epr.policy_title
            """
        )
    )


def downgrade() -> None:
    # No-op: previous migration already backfilled these columns.
    pass
