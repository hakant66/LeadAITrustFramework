"""Backfill control_values metadata from controls by kpi_key

Revision ID: 20260303_backfill_control_values_from_controls
Revises: 20260303_add_unit_to_control_values
Create Date: 2026-02-25
"""
from __future__ import annotations

from alembic import op


revision = "20260303_backfill_control_values_from_controls"
down_revision = "20260303_add_unit_to_control_values"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE control_values v
        SET target_text = c.target_text,
            target_numeric = c.target_numeric,
            evidence_source = c.evidence_source,
            frequency = c.frequency,
            unit = c.unit
        FROM controls c
        WHERE v.kpi_key = c.kpi_key
        """
    )

    op.execute(
        """
        UPDATE control_values_history h
        SET target_text = c.target_text,
            target_numeric = c.target_numeric,
            evidence_source = c.evidence_source,
            frequency = c.frequency,
            unit = c.unit
        FROM controls c
        WHERE h.kpi_key = c.kpi_key
        """
    )


def downgrade() -> None:
    # No safe downgrade for data backfill.
    pass
