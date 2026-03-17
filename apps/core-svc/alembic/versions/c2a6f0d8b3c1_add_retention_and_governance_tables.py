"""add retention and governance tables

Revision ID: c2a6f0d8b3c1
Revises: 9e1c7f2a4b11
Create Date: 2026-02-03
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "c2a6f0d8b3c1"
down_revision = "9e1c7f2a4b11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "data_retention_policies",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("retention_class", sa.Text(), nullable=False, unique=True),
        sa.Column("archive_after_days", sa.Integer(), nullable=True),
        sa.Column("delete_after_days", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
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
    )

    op.create_table(
        "data_retention_records",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("assignment_id", sa.Text(), nullable=False),
        sa.Column("retention_class", sa.Text(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("last_accessed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="active"),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["assignment_id"],
            ["data_classification_assignments.id"],
            ondelete="CASCADE",
        ),
    )

    op.create_table(
        "data_usage_records",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("assignment_id", sa.Text(), nullable=False),
        sa.Column("usage_type", sa.Text(), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=True),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["assignment_id"],
            ["data_classification_assignments.id"],
            ondelete="CASCADE",
        ),
    )

    op.create_table(
        "data_governance_warnings",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("assignment_id", sa.Text(), nullable=False),
        sa.Column("warning_type", sa.Text(), nullable=False),
        sa.Column("severity", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["assignment_id"],
            ["data_classification_assignments.id"],
            ondelete="CASCADE",
        ),
    )


def downgrade() -> None:
    op.drop_table("data_governance_warnings")
    op.drop_table("data_usage_records")
    op.drop_table("data_retention_records")
    op.drop_table("data_retention_policies")
