"""backfill entity_policy_register iso fields from policies

Revision ID: 20260220_backfill_entity_policy_register_iso_fields
Revises: 20260220_add_policy_iso42001_status
Create Date: 2026-02-20
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260220_backfill_entity_policy_register_iso_fields"
down_revision = "20260220_add_policy_iso42001_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "entity_policy_register",
        sa.Column("iso42001_requirements", sa.Text(), nullable=True),
    )
    op.add_column(
        "entity_policy_register",
        sa.Column("iso42001_status", sa.Text(), nullable=True),
    )
    op.add_column(
        "entity_policy_register",
        sa.Column("comment", sa.Text(), nullable=True),
    )
    op.add_column(
        "entity_policy_register",
        sa.Column("action", sa.Text(), nullable=True),
    )

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
            WHERE p.id = epr.policy_id
              AND p.entity_id = epr.entity_id
            """
        )
    )


def downgrade() -> None:
    op.drop_column("entity_policy_register", "action")
    op.drop_column("entity_policy_register", "comment")
    op.drop_column("entity_policy_register", "iso42001_status")
    op.drop_column("entity_policy_register", "iso42001_requirements")
