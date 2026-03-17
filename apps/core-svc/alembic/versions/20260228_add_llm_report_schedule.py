"""Add per-report schedule table for LLM reports

Revision ID: 20260228_add_llm_report_schedule
Revises: 20260227_add_llm_report_cache_report_type
Create Date: 2026-02-28
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260228_add_llm_report_schedule"
down_revision = "20260227_add_llm_report_cache_report_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "llm_report_schedule" not in tables:
        op.create_table(
            "llm_report_schedule",
            sa.Column("report_type", sa.Text(), primary_key=True),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("run_hour_utc", sa.Integer(), nullable=False, server_default="3"),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )

    op.execute(
        """
        INSERT INTO llm_report_schedule (report_type, enabled, run_hour_utc, updated_at)
        VALUES
            ('ai_summary_llm', true, 3, NOW()),
            ('governance_requirements_report', true, 3, NOW())
        ON CONFLICT (report_type) DO NOTHING
        """
    )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    if "llm_report_schedule" in tables:
        op.drop_table("llm_report_schedule")
