"""fix legal_standing_result column type

Revision ID: 20260222_fix_entity_legal_standing_result_type
Revises: 20260222_add_entity_policy_register_kpi_keys
Create Date: 2026-02-22
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260222_fix_entity_legal_standing_result_type"
down_revision = "20260222_add_entity_policy_register_kpi_keys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = {col["name"]: col for col in inspector.get_columns("entity")}
    if "legal_standing_result" in cols:
        op.alter_column(
            "entity",
            "legal_standing_result",
            type_=postgresql.JSONB(),
            postgresql_using="legal_standing_result::jsonb",
        )


def downgrade() -> None:
    op.alter_column(
        "entity",
        "legal_standing_result",
        type_=sa.Text(),
        postgresql_using="legal_standing_result::text",
    )
