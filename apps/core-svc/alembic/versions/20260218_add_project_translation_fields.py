"""add extra project translation fields

Revision ID: 20260218_add_project_translation_fields
Revises: 20260218_add_ui_translation_overrides
Create Date: 2026-02-18
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260218_add_project_translation_fields"
down_revision = "20260218_add_ui_translation_overrides"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("project_translations", sa.Column("status", sa.String(length=50), nullable=True))
    op.add_column(
        "project_translations",
        sa.Column("company_registration_number", sa.Text(), nullable=True),
    )
    op.add_column(
        "project_translations",
        sa.Column("headquarters_country", sa.Text(), nullable=True),
    )
    op.add_column(
        "project_translations",
        sa.Column("regions_of_operation", sa.Text(), nullable=True),
    )
    op.add_column(
        "project_translations",
        sa.Column("sectors", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("project_translations", "sectors")
    op.drop_column("project_translations", "regions_of_operation")
    op.drop_column("project_translations", "headquarters_country")
    op.drop_column("project_translations", "company_registration_number")
    op.drop_column("project_translations", "status")
