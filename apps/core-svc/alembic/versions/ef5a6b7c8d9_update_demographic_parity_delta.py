"""Update demographic_parity_delta KPI mappings

Revision ID: ef5a6b7c8d9
Revises: ee4d5e6f7a8
Create Date: 2026-02-16
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "ef5a6b7c8d9"
down_revision = "ee4d5e6f7a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE kpi_definition
        SET definition = $$
Demographic Parity Delta:
1. Core Objective
Monitors fairness by measuring differences in outcome rates between protected groups.

2. Key Performance Indicators (KPIs)
Definition
- Absolute difference in positive outcome rates across demographic groups.
Calculation & Target
- Formula: |Rate(Group A) – Rate(Group B)|.
- Example: 2% difference within ±5% tolerance.

3. Required Evidence
- Fairness evaluation reports
- Disaggregated performance metrics
- Dataset representativeness and bias checks

4. Ownership & Timeline
- Owners: Data Science / Ethics / Compliance
- Timeline: Pre‑GTM and ongoing monitoring
$$,
            iso_42001_clause = '6.1 Risk & opportunity planning; 8 Operation (lifecycle controls); 9.1 Measurement & evaluation',
            iso_42001_chapter = NULL,
            euaiact_clause = 'Art 10 Data & data governance; Art 9 Risk management',
            euaiact_chapter = 'Ch III: High-Risk AI Systems',
            nist_clause = 'MEASURE 2.11'
        WHERE kpi_key = 'demographic_parity_delta'
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
        WHERE kpi_key = 'demographic_parity_delta'
        """
    )
