"""add project status

Revision ID: e1b2c3d4e5f6
Revises: d4b9f3a1c2f2
Create Date: 2026-02-03
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "e1b2c3d4e5f6"
down_revision = "d4b9f3a1c2f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("status", sa.Text(), nullable=True, server_default="Planned"),
    )
    op.execute("UPDATE projects SET status = 'Planned' WHERE status IS NULL")


def downgrade() -> None:
    op.drop_column("projects", "status")
