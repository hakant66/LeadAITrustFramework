"""Add unit to control_values and control_values_history and backfill metadata

Revision ID: 20260303_add_unit_to_control_values
Revises: 20260302_merge_heads
Create Date: 2026-02-25
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260303_add_unit_to_control_values"
down_revision = "20260302_merge_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("control_values", sa.Column("unit", sa.Text(), nullable=True))
    op.add_column("control_values_history", sa.Column("unit", sa.Text(), nullable=True))

    op.execute(
        """
        UPDATE control_values v
        SET unit = COALESCE(v.unit, c.unit),
            target_text = COALESCE(v.target_text, c.target_text),
            target_numeric = COALESCE(v.target_numeric, c.target_numeric),
            evidence_source = COALESCE(v.evidence_source, c.evidence_source),
            frequency = COALESCE(v.frequency, c.frequency)
        FROM controls c
        WHERE v.kpi_key = c.kpi_key
          AND (
            v.unit IS NULL
            OR v.target_text IS NULL
            OR v.target_numeric IS NULL
            OR v.evidence_source IS NULL
            OR v.frequency IS NULL
          )
        """
    )

    op.execute(
        """
        UPDATE control_values_history h
        SET unit = COALESCE(h.unit, c.unit),
            target_text = COALESCE(h.target_text, c.target_text),
            target_numeric = COALESCE(h.target_numeric, c.target_numeric),
            evidence_source = COALESCE(h.evidence_source, c.evidence_source),
            frequency = COALESCE(h.frequency, c.frequency)
        FROM controls c
        WHERE h.kpi_key = c.kpi_key
          AND (
            h.unit IS NULL
            OR h.target_text IS NULL
            OR h.target_numeric IS NULL
            OR h.evidence_source IS NULL
            OR h.frequency IS NULL
          )
        """
    )


def downgrade() -> None:
    op.drop_column("control_values_history", "unit")
    op.drop_column("control_values", "unit")
