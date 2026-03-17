"""add policy review reminder tracking

Revision ID: 20260222_add_policy_review_reminder_tracking
Revises: 20260222_add_policy_execution_tables
Create Date: 2026-02-22
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260222_add_policy_review_reminder_tracking"
down_revision = "20260222_add_policy_execution_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "policy_review_tasks",
        sa.Column("last_reminded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "policy_review_tasks",
        sa.Column("remind_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("policy_review_tasks", "remind_count")
    op.drop_column("policy_review_tasks", "last_reminded_at")
