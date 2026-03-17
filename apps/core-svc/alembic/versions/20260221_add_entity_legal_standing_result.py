"""add legal standing result to entity

Revision ID: 20260221_add_entity_legal_standing_result
Revises: 20260221_backfill_policy_euai_nist_by_title
Create Date: 2026-02-21
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260221_add_entity_legal_standing_result"
down_revision = "20260221_backfill_policy_euai_nist_by_title"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = {col["name"] for col in inspector.get_columns("entity")}
    if "legal_standing_result" not in cols:
        op.add_column(
            "entity",
            sa.Column("legal_standing_result", postgresql.JSONB(), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = {col["name"] for col in inspector.get_columns("entity")}
    if "legal_standing_result" in cols:
        op.drop_column("entity", "legal_standing_result")
