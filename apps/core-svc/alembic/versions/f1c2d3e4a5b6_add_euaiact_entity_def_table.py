"""add euaiact_entity_def table

Revision ID: f1c2d3e4a5b6
Revises: e2c7a1b4d5f8
Create Date: 2026-02-06
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "f1c2d3e4a5b6"
down_revision = "e2c7a1b4d5f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "euaiact_entity_def",
        sa.Column("role", sa.Text(), primary_key=True),
        sa.Column("legaldefinition", sa.Text(), nullable=True),
        sa.Column("keyobligation", sa.Text(), nullable=True),
        sa.Column("commonexample", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("euaiact_entity_def")
