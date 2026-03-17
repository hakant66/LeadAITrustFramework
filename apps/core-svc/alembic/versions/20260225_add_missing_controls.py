"""Add missing controls from docs/missing_controls.csv

Revision ID: 20260225_add_missing_controls
Revises: 20260225_staff_cert_control
Create Date: 2026-02-25
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260225_add_missing_controls"
down_revision = "20260225_staff_cert_control"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    controls = [
        {
            "kpi_key": "aisia_completion_rate",
            "name": "Pre-deployment Impact Assessment",
            "pillar": "Pre-GTM Trust Certification",
            "unit": "%",
            "norm_min": 0,
            "norm_max": 100,
            "higher_is_better": True,
            "weight": 1.0,
            "target_numeric": 100,
            "target_text": "100% completion before production",
            "evidence_source": "GRC System / Impact Registry",
            "owner_role": "AI Officer / PCL",
            "frequency": 1,
            "failure_action": 0,
            "description": (
                "Percentage of active AI projects with a signed and archived AI Impact "
                "Assessment (AIIA) prior to deployment."
            ),
            "example": "100% (All 12 models in production have signed AIIAs in the repository).",
        },
        {
            "kpi_key": "critical_vulnerability_density",
            "name": "AI Security Vulnerability Density",
            "pillar": "Continuous Regulatory Alignment",
            "unit": "#",
            "norm_min": 0,
            "norm_max": 0.05,
            "higher_is_better": False,
            "weight": 1.0,
            "target_numeric": None,
            "target_text": "< 0.05 per 100 testing hours",
            "evidence_source": "Red-Teaming Reports / SAST-DAST Logs",
            "owner_role": "Security Lead",
            "frequency": 30,
            "failure_action": 0,
            "description": (
                "The number of high-severity safety flaws discovered relative to the depth "
                "of testing effort."
            ),
            "example": "0.02 (Only 2 critical vulnerabilities found in 100 person-hours of testing).",
        },
        {
            "kpi_key": "jailbreak_resilience_rate",
            "name": "Adversarial Guardrail Effectiveness",
            "pillar": "Human-Centered Resilience",
            "unit": "%",
            "norm_min": 0,
            "norm_max": 100,
            "higher_is_better": True,
            "weight": 1.0,
            "target_numeric": 95,
            "target_text": "≥ 95% resilience rate",
            "evidence_source": "Adversarial Test Suite Logs (e.g., Giskard)",
            "owner_role": "ML Safety Engineer",
            "frequency": 7,
            "failure_action": 0,
            "description": (
                "Effectiveness of safety filters in blocking adversarial \"jailbreak\" "
                "prompts designed to bypass guardrails."
            ),
            "example": "98% (490 of 500 simulated adversarial attacks were successfully neutralized).",
        },
        {
            "kpi_key": "demographic_parity_delta",
            "name": "Bias & Fairness Variance",
            "pillar": "Data Value & Responsible Sourcing",
            "unit": "%",
            "norm_min": 0,
            "norm_max": 5,
            "higher_is_better": False,
            "weight": 1.0,
            "target_numeric": 5,
            "target_text": "< 5% statistical variance",
            "evidence_source": "Model Evaluation Reports / Fairness Dashboard",
            "owner_role": "Data Scientist / Data Steward",
            "frequency": 30,
            "failure_action": 0,
            "description": (
                "Statistical variance in AI outcomes between different protected groups "
                "to identify potential bias."
            ),
            "example": "2% (The difference in recommendation scores between groups was within tolerance).",
        },
    ]

    insert_sql = sa.text(
        """
        INSERT INTO controls (
            id,
            kpi_key,
            name,
            pillar,
            unit,
            norm_min,
            norm_max,
            higher_is_better,
            weight,
            target_text,
            target_numeric,
            evidence_source,
            owner_role,
            frequency,
            failure_action,
            description,
            example
        )
        SELECT
            gen_random_uuid(),
            :kpi_key,
            :name,
            :pillar,
            :unit,
            :norm_min,
            :norm_max,
            :higher_is_better,
            :weight,
            :target_text,
            :target_numeric,
            :evidence_source,
            :owner_role,
            :frequency,
            :failure_action,
            :description,
            :example
        WHERE NOT EXISTS (
            SELECT 1 FROM controls WHERE kpi_key = :kpi_key
        )
        """
    )

    for row in controls:
        conn.execute(insert_sql, row)

    # Backfill control_values for all existing projects for these controls.
    conn.execute(
        sa.text(
            """
            INSERT INTO control_values (
              entity_id, entity_slug, project_slug, control_id, kpi_key,
              raw_value, normalized_pct, updated_at,
              target_text, target_numeric, evidence_source, owner_role, frequency,
              failure_action, maturity_anchor_l3, current_value, as_of, notes, kpi_score
            )
            SELECT p.entity_id,
                   e.slug,
                   p.slug,
                   c.id,
                   c.kpi_key,
                   0,
                   CASE
                     WHEN c.norm_min IS NULL OR c.norm_max IS NULL OR c.norm_min = c.norm_max
                       THEN LEAST(GREATEST(0, 0), 100)
                     WHEN c.higher_is_better
                       THEN LEAST(GREATEST( ((0 - c.norm_min) / NULLIF(c.norm_max - c.norm_min, 0)) * 100, 0), 100)
                     ELSE LEAST(GREATEST( ((c.norm_max - 0) / NULLIF(c.norm_max - c.norm_min, 0)) * 100, 0), 100)
                   END,
                   NOW(),
                   c.target_text,
                   c.target_numeric,
                   c.evidence_source,
                   c.owner_role,
                   c.frequency,
                   c.failure_action,
                   c.maturity_anchor_l3,
                   c.current_value,
                   c.as_of,
                   c.notes,
                   c.kpi_score
            FROM entity_projects p
            JOIN entity e ON e.id = p.entity_id
            JOIN controls c ON c.kpi_key IN (
              'aisia_completion_rate',
              'critical_vulnerability_density',
              'jailbreak_resilience_rate',
              'demographic_parity_delta'
            )
            ON CONFLICT (project_slug, control_id)
            DO NOTHING
            """
        )
    )

    # Backfill existing control_values rows (if any) with metadata from controls.
    conn.execute(
        sa.text(
            """
            UPDATE control_values v
            SET target_text = COALESCE(v.target_text, c.target_text),
                target_numeric = COALESCE(v.target_numeric, c.target_numeric),
                evidence_source = COALESCE(v.evidence_source, c.evidence_source),
                owner_role = COALESCE(v.owner_role, c.owner_role),
                frequency = COALESCE(v.frequency, c.frequency),
                failure_action = COALESCE(v.failure_action, c.failure_action)
            FROM controls c
            WHERE v.control_id = c.id
              AND c.kpi_key IN (
                'aisia_completion_rate',
                'critical_vulnerability_density',
                'jailbreak_resilience_rate',
                'demographic_parity_delta'
              )
            """
        )
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM controls
        WHERE kpi_key IN (
            'aisia_completion_rate',
            'critical_vulnerability_density',
            'jailbreak_resilience_rate',
            'demographic_parity_delta'
        )
        """
    )
