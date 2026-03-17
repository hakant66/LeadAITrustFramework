"""Add missing control for staff_certification_rate (AI Workforce Training Policy)

The EU AI Act requirement "Art 4 AI literacy" maps to kpi_key staff_certification_rate.
This KPI exists in kpis and kpi_definition but had no row in the controls table, so
when control-values/sync runs for a project's required KPIs, only controls that exist
in the controls table get a control_value. The Control Register page shows only
control_values for the project, so the 4th required KPI never appeared.

This migration inserts the missing control so all four EU AI Act Deployer KPIs
(dsr_sla_days, explanation_latency_ms, xai_ui_coverage, staff_certification_rate)
can be synced and shown on the Control Register.

Revision ID: 20260225_staff_cert_control
Revises: 20260223_backfill_ai_system_entity
Create Date: 2026-02-25

"""
from __future__ import annotations

from alembic import op

revision = "20260225_staff_cert_control"
down_revision = "20260223_backfill_ai_system_entity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO controls (
            id, kpi_key, name, pillar, unit,
            norm_min, norm_max, higher_is_better, weight
        )
        SELECT
            gen_random_uuid(),
            'staff_certification_rate',
            'AI Workforce Training Policy',
            'human',
            '%',
            0,
            100,
            true,
            1.0
        WHERE NOT EXISTS (
            SELECT 1 FROM controls WHERE kpi_key = 'staff_certification_rate'
        )
        """
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM controls WHERE kpi_key = 'staff_certification_rate'"
    )
