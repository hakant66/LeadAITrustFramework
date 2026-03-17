"""add requirement_code coverage helper view

Revision ID: d4b9f3a1c2f2
Revises: c2a6f0d8b3c1
Create Date: 2026-02-03
"""
from __future__ import annotations

from alembic import op

revision = "d4b9f3a1c2f2"
down_revision = "c2a6f0d8b3c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE VIEW euaiact_requirement_coverages AS
        SELECT DISTINCT coverage
        FROM euaiact_requirements
        WHERE coverage IS NOT NULL AND coverage <> ''
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS euaiact_requirement_coverages")
