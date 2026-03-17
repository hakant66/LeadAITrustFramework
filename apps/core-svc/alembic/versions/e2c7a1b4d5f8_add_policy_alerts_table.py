"""add policy alerts table

Revision ID: e2c7a1b4d5f8
Revises: b3c4d5e6f7a8
Create Date: 2026-02-04
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = "e2c7a1b4d5f8"
down_revision = "b3c4d5e6f7a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "policy_alerts",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("policy_id", sa.Text(), nullable=False),
        sa.Column("policy_title", sa.Text(), nullable=False),
        sa.Column(
            "project_slug",
            sa.Text(),
            nullable=True,
            server_default=sa.text("'global'"),
        ),
        sa.Column("alert_type", sa.Text(), nullable=False),
        sa.Column("severity", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("source_type", sa.Text(), nullable=True),
        sa.Column("source_key", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="open"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("details_json", JSONB(), nullable=True),
        sa.ForeignKeyConstraint(
            ["policy_id"],
            ["policies.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "policy_id",
            "alert_type",
            "source_type",
            "source_key",
            "project_slug",
            name="ux_policy_alerts_unique",
        ),
    )
    op.create_index(
        "ix_policy_alerts_status",
        "policy_alerts",
        ["status"],
    )
    op.create_index(
        "ix_policy_alerts_project",
        "policy_alerts",
        ["project_slug"],
    )


def downgrade() -> None:
    op.drop_index("ix_policy_alerts_project", table_name="policy_alerts")
    op.drop_index("ix_policy_alerts_status", table_name="policy_alerts")
    op.drop_table("policy_alerts")
