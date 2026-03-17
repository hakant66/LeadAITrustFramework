"""Insert policy KPIs into kpi_definition

Revision ID: ea1b2c3d4e5f
Revises: e9b0c1d2e3f4
Create Date: 2026-02-16
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "ea1b2c3d4e5f"
down_revision = "e9b0c1d2e3f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    statements = [
        {
            "pillar": "AI-as-a-Product Governance",
            "kpi_key": "jailbreak_resilience_rate",
            "kpi_name": "AI Safety & Robustness Policy",
            "unit": "%",
            "description": 'Measures the effectiveness of the system’s safety filters in blocking adversarial "jailbreak" prompts (attempts to bypass ethical or safety guardrails).',
            "example": "98%: Out of 500 simulated adversarial attacks, 490 were successfully neutralized by the guardrail layer.",
        },
        {
            "pillar": "Pre-GTM Trust Certification",
            "kpi_key": "critical_vulnerability_density",
            "kpi_name": "AI Testing & Validation Policy",
            "unit": "#",
            "description": "Quantifies the presence of high-severity safety flaws (e.g., PII leakage, prompt injection) discovered relative to the depth of testing effort.",
            "example": "0.02: Only 2 critical vulnerabilities were discovered during 100 person-hours of intensive red-teaming.",
        },
        {
            "pillar": "Human-Centered Resilience",
            "kpi_key": "staff_certification_rate",
            "kpi_name": "AI Workforce Training Policy",
            "unit": "%",
            "description": "Tracks the completion of mandatory AI Literacy training and ethics exams for all employees operating or managing the AI system.",
            "example": "94%: 171 out of 182 in-scope employees have completed their training and passed the final competency assessment.",
        },
        {
            "pillar": "Data Value & Responsible Sourcing",
            "kpi_key": "demographic_parity_delta",
            "kpi_name": "AI Fairness & Bias Policy",
            "unit": "%",
            "description": "Measures the statistical variance in AI outcomes (e.g., hiring recommendations) between different protected groups to identify potential bias.",
            "example": '2%: The difference in "highly recommended" scores between male and female candidates was within the allowed ±5% tolerance.',
        },
        {
            "pillar": "Pre-GTM Trust Certification",
            "kpi_key": "aisia_completion_rate",
            "kpi_name": "AI System Impact Assessment Policy",
            "unit": "%",
            "description": "Ensures that every AI project has undergone a formal AI System Impact Assessment before being deployed into production.",
            "example": "100%: All 12 AI models currently in production have signed and archived Impact Assessments in the GRC system.",
        },
    ]

    for row in statements:
        op.execute(
            f"""
            WITH pillar AS (
                SELECT id FROM pillars WHERE name = '{row["pillar"].replace("'", "''")}'
            ),
            inserted AS (
                INSERT INTO kpis (id, key, name, pillar_id, unit, weight, invert, description, example)
                SELECT gen_random_uuid(), '{row["kpi_key"]}', '{row["kpi_name"].replace("'", "''")}',
                       pillar.id, '{row["unit"]}', 1, false,
                       '{row["description"].replace("'", "''")}',
                       '{row["example"].replace("'", "''")}'
                FROM pillar
                ON CONFLICT (key) DO NOTHING
                RETURNING id
            ),
            kpi_row AS (
                SELECT id FROM inserted
                UNION ALL
                SELECT id FROM kpis WHERE key = '{row["kpi_key"]}' LIMIT 1
            )
            INSERT INTO kpi_definition (
                kpi_id, kpi_key, kpi_name, pillar_id, unit, weight, invert, description, example
            )
            SELECT kpi_row.id, '{row["kpi_key"]}', '{row["kpi_name"].replace("'", "''")}',
                   pillar.id, '{row["unit"]}', 1, false,
                   '{row["description"].replace("'", "''")}',
                   '{row["example"].replace("'", "''")}'
            FROM kpi_row, pillar
            ON CONFLICT (kpi_key) DO NOTHING;
            """
        )


def downgrade() -> None:
    keys = [
        "jailbreak_resilience_rate",
        "critical_vulnerability_density",
        "staff_certification_rate",
        "demographic_parity_delta",
        "aisia_completion_rate",
    ]
    for key in keys:
        op.execute(
            f"DELETE FROM kpi_definition WHERE kpi_key = '{key}';"
        )
        op.execute(
            f"DELETE FROM kpis WHERE key = '{key}';"
        )
