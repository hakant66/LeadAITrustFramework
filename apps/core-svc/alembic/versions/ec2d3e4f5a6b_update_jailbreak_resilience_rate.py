"""Update jailbreak_resilience_rate KPI mappings

Revision ID: ec2d3e4f5a6b
Revises: eb1c2d3e4f5a
Create Date: 2026-02-16
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "ec2d3e4f5a6b"
down_revision = "eb1c2d3e4f5a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE kpi_definition
        SET definition = $$
Jailbreak Resilience Rate:
1. Core Objective
Measures the system’s resilience against adversarial “jailbreak” prompts that attempt to bypass safety guardrails.

2. Key Performance Indicators (KPIs)
Definition
- Percentage of adversarial prompts that are blocked or safely handled.
Calculation & Target
- Formula: Score = (Blocked Adversarial Prompts / Total Adversarial Prompts) * 100.
- Example: 98% (490/500 adversarial prompts blocked).

3. Required Evidence
- Red-team/adversarial test suite and results
- Guardrail policy configuration and change logs
- Security testing reports and remediation notes

4. Ownership & Timeline
- Owners: AI Safety / Security / Product Compliance
- Timeline: Pre‑GTM and periodic regression testing
$$,
            iso_42001_clause = 'Validation; A.6.2.6 AI-System Operation and Monitoring; A.8.29 Security Testing; 9.1 Measurement & evaluation',
            iso_42001_chapter = NULL,
            euaiact_clause = 'Art 15 Accuracy/robustness/cybersecurity; Art 9 Risk management',
            euaiact_chapter = 'Ch III: High-Risk AI Systems',
            nist_clause = 'MEASURE 2.6; MEASURE 2.7'
        WHERE kpi_key = 'jailbreak_resilience_rate'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE kpi_definition
        SET definition = NULL,
            iso_42001_clause = NULL,
            iso_42001_chapter = NULL,
            euaiact_clause = NULL,
            euaiact_chapter = NULL,
            nist_clause = NULL
        WHERE kpi_key = 'jailbreak_resilience_rate'
        """
    )
