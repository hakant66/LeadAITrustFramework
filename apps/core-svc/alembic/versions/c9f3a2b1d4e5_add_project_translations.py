"""add project translations table

Revision ID: c9f3a2b1d4e5
Revises: d9c7b5a3f1e2
Create Date: 2026-02-09
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "c9f3a2b1d4e5"
down_revision = "d9c7b5a3f1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_translations",
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("locale", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=True),
        sa.Column("risk_level", sa.String(length=50), nullable=True),
        sa.Column("priority", sa.String(length=50), nullable=True),
        sa.Column("sponsor", sa.String(length=100), nullable=True),
        sa.Column("owner", sa.String(length=100), nullable=True),
        sa.PrimaryKeyConstraint("project_id", "locale", name="project_translations_pkey"),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            ondelete="CASCADE",
            name="project_translations_project_id_fkey",
        ),
    )
    op.create_index(
        "ix_project_translations_locale",
        "project_translations",
        ["locale"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_project_translations_locale", table_name="project_translations")
    op.drop_table("project_translations")
