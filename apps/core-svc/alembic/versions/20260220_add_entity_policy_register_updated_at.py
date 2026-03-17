"""add updated_at to entity_policy_register and backfill

Revision ID: 20260220_add_entity_policy_register_updated_at
Revises: 20260220_backfill_entity_policy_register_iso_by_title
Create Date: 2026-02-20
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260220_add_entity_policy_register_updated_at"
down_revision = "20260220_backfill_entity_policy_register_iso_by_title"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "entity_policy_register",
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    conn = op.get_bind()
    # First, match on policy_id
    conn.execute(
        sa.text(
            """
            UPDATE entity_policy_register epr
            SET updated_at = p.updated_at
            FROM policies p
            WHERE p.id = epr.policy_id
            """
        )
    )
    # Fill remaining nulls by matching on policy title (best effort)
    conn.execute(
        sa.text(
            """
            UPDATE entity_policy_register epr
            SET updated_at = src.updated_at
            FROM (
                SELECT title, MAX(updated_at) AS updated_at
                FROM policies
                GROUP BY title
            ) src
            WHERE epr.updated_at IS NULL
              AND src.title = epr.policy_title
            """
        )
    )


def downgrade() -> None:
    op.drop_column("entity_policy_register", "updated_at")
