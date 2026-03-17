"""add data classification tables

Revision ID: 9e1c7f2a4b11
Revises: 7c2e1a9b5d10
Create Date: 2026-02-03
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "9e1c7f2a4b11"
down_revision = "7c2e1a9b5d10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "data_classification_tags",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("tag_name", sa.Text(), nullable=False, unique=True),
        sa.Column("sensitivity_tier", sa.Text(), nullable=True),
        sa.Column("pii_flag", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("allowed_usage", sa.Text(), nullable=True),
        sa.Column("retention_class", sa.Text(), nullable=True),
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
        "data_classification_assignments",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("connector_id", sa.Text(), nullable=False),
        sa.Column("schema_name", sa.Text(), nullable=True),
        sa.Column("table_name", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("id_number", sa.Text(), nullable=True),
        sa.Column("tag_id", sa.Text(), nullable=False),
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
            ["connector_id"],
            ["data_source_connectors.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tag_id"],
            ["data_classification_tags.id"],
            ondelete="CASCADE",
        ),
    )


def downgrade() -> None:
    op.drop_table("data_classification_assignments")
    op.drop_table("data_classification_tags")
