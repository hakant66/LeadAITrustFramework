"""Add table for AI legal standing submissions without entity context

Revision ID: 20260310_add_ai_legal_standing_submissions
Revises: 20260304_add_system_email_settings
Create Date: 2026-03-10 12:05:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260310_add_ai_legal_standing_submissions"
down_revision = "20260304_add_system_email_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "ai_legal_standing_submissions" not in table_names:
        op.create_table(
            "ai_legal_standing_submissions",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("first_name", sa.Text(), nullable=False),
            sa.Column("last_name", sa.Text(), nullable=False),
            sa.Column("email", sa.Text(), nullable=False),
            sa.Column("company", sa.Text(), nullable=True),
            sa.Column("answers", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.ForeignKeyConstraint(["entity_id"], ["entity.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )

    index_names = {
        index["name"] for index in inspector.get_indexes("ai_legal_standing_submissions")
    }
    if "ix_ai_legal_standing_submissions_created_at" not in index_names:
        op.create_index(
            "ix_ai_legal_standing_submissions_created_at",
            "ai_legal_standing_submissions",
            ["created_at"],
            unique=False,
        )
    if "ix_ai_legal_standing_submissions_email" not in index_names:
        op.create_index(
            "ix_ai_legal_standing_submissions_email",
            "ai_legal_standing_submissions",
            ["email"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index(
        "ix_ai_legal_standing_submissions_email",
        table_name="ai_legal_standing_submissions",
    )
    op.drop_index(
        "ix_ai_legal_standing_submissions_created_at",
        table_name="ai_legal_standing_submissions",
    )
    op.drop_table("ai_legal_standing_submissions")
