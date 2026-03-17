"""add iso42001_status to policies and backfill

Revision ID: 20260220_add_policy_iso42001_status
Revises: 20260220_update_policy_iso42001_fields
Create Date: 2026-02-20
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260220_add_policy_iso42001_status"
down_revision = "20260220_update_policy_iso42001_fields"
branch_labels = None
depends_on = None


POLICY_STATUS_UPDATES = [
    {"title": "AI Governance Policy", "status": "Mandatory"},
    {"title": "AI Regulatory Compliance Policy", "status": "Mandatory"},
    {"title": "AI Requirements Register", "status": "Mandatory"},
    {"title": "AI Transparency and User Notice Policy", "status": "Mandatory"},
    {"title": "Model Approval and Release Policy", "status": "Mandatory"},
    {"title": "Responsible AI Principles", "status": "Expected"},
    {"title": "AI Ethical Use Charter", "status": "Expected"},
    {"title": "AI Documentation and Traceability Policy", "status": "Expected"},
    {"title": "AI Workforce Training and Literacy Policy", "status": "Expected"},
    {"title": "HR Hiring and Screening AI Policy", "status": "Considered"},
    {"title": "Shadow AI Detection and Reporting Policy", "status": "Considered"},
]


def upgrade() -> None:
    op.add_column("policies", sa.Column("iso42001_status", sa.Text(), nullable=True))
    conn = op.get_bind()
    for row in POLICY_STATUS_UPDATES:
        conn.execute(
            sa.text(
                """
                UPDATE policies
                SET iso42001_status = :status,
                    updated_at = NOW()
                WHERE title = :title
                """
            ),
            row,
        )


def downgrade() -> None:
    conn = op.get_bind()
    for row in POLICY_STATUS_UPDATES:
        conn.execute(
            sa.text(
                """
                UPDATE policies
                SET iso42001_status = NULL,
                    updated_at = NOW()
                WHERE title = :title
                """
            ),
            {"title": row["title"]},
        )
    op.drop_column("policies", "iso42001_status")
