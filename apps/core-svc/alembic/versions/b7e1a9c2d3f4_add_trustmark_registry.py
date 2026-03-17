"""add trustmark registry

Revision ID: b7e1a9c2d3f4
Revises: a1b2c3d4e5f6
Create Date: 2026-01-28 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b7e1a9c2d3f4"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trustmarks",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("project_id", sa.Text, nullable=False),
        sa.Column("project_slug", sa.String(length=120), nullable=False),
        sa.Column("tol_level", sa.Text, nullable=False),
        sa.Column("axis_scores", postgresql.JSONB, nullable=False),
        sa.Column("axis_levels", postgresql.JSONB, nullable=False),
        sa.Column("payload_json", postgresql.JSONB, nullable=False),
        sa.Column("signature", sa.Text, nullable=False),
        sa.Column("public_key", sa.Text, nullable=False),
        sa.Column("key_id", sa.Text, nullable=True),
        sa.Column("evaluation_id", sa.Text, nullable=True),
        sa.Column(
            "issued_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("expires_at", postgresql.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default=sa.text("'active'")),
        sa.Column("revoked_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("revoked_reason", sa.Text, nullable=True),
    )
    op.create_index("ix_trustmarks_project", "trustmarks", ["project_slug", "issued_at"])
    op.create_index("ix_trustmarks_status", "trustmarks", ["status"])


def downgrade() -> None:
    op.drop_index("ix_trustmarks_status", table_name="trustmarks")
    op.drop_index("ix_trustmarks_project", table_name="trustmarks")
    op.drop_table("trustmarks")
