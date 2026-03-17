"""add kpi_keys to entity_policy_register

Revision ID: 20260222_add_entity_policy_register_kpi_keys
Revises: 20260222_add_policy_review_reminder_tracking
Create Date: 2026-02-22
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260222_add_entity_policy_register_kpi_keys"
down_revision = "20260222_add_policy_review_reminder_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "entity_policy_register",
        sa.Column("kpi_keys", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("entity_policy_register", "kpi_keys")
