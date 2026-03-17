"""add llm report cache table

Revision ID: e1b2c3d4f5a6
Revises: c9f3a2b1d4e5
Create Date: 2026-02-10
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "e1b2c3d4f5a6"
down_revision = "c9f3a2b1d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "llm_report_cache",
        sa.Column("project_slug", sa.Text(), nullable=False, primary_key=True),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("model", sa.Text(), nullable=False),
        sa.Column("report_md", sa.Text(), nullable=False),
        sa.Column("pillar_scores", postgresql.JSONB, nullable=False),
        sa.Column("overall_score", sa.Float(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column(
            "data_hash",
            sa.Text(),
            nullable=False,
            comment="Hash of KPI data used to generate report",
        ),
        sa.Column(
            "generated_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "expires_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=True,
            comment="Optional expiration time for cache entry",
        ),
    )
    op.create_index(
        "ix_llm_report_cache_project_slug",
        "llm_report_cache",
        ["project_slug"],
        unique=True,
    )
    op.create_index(
        "ix_llm_report_cache_data_hash",
        "llm_report_cache",
        ["data_hash"],
        unique=False,
    )
    op.create_index(
        "ix_llm_report_cache_expires_at",
        "llm_report_cache",
        ["expires_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_llm_report_cache_expires_at", table_name="llm_report_cache")
    op.drop_index("ix_llm_report_cache_data_hash", table_name="llm_report_cache")
    op.drop_index("ix_llm_report_cache_project_slug", table_name="llm_report_cache")
    op.drop_table("llm_report_cache")
