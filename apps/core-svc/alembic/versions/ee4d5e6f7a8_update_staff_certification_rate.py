"""Update staff_certification_rate KPI mappings

Revision ID: ee4d5e6f7a8
Revises: ed3c4b5a6f7
Create Date: 2026-02-16
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "ee4d5e6f7a8"
down_revision = "ed3c4b5a6f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE kpi_definition
        SET definition = $$
AI Workforce Training (Staff Certification Rate):
1. Core Objective
Ensures sufficient AI literacy and competence for staff who operate or oversee AI systems.

2. Key Performance Indicators (KPIs)
Definition
- Percentage of in‑scope staff who have completed AI literacy training and passed required assessments.
Calculation & Target
- Formula: (Certified Staff / In‑Scope Staff) * 100.
- Example: 94% (171 of 182).

3. Required Evidence
- Training attendance logs
- Certification or test results
- Competence assessments and refresher schedules

4. Ownership & Timeline
- Owners: HR / Compliance / AI Governance
- Timeline: Quarterly and on‑boarding
$$,
            iso_42001_clause = '7.2 Competence; 7.3 Awareness',
            iso_42001_chapter = NULL,
            euaiact_clause = 'Art 4 AI literacy',
            euaiact_chapter = 'Ch I: General Provisions',
            nist_clause = 'GOVERN 2.1'
        WHERE kpi_key = 'staff_certification_rate'
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
        WHERE kpi_key = 'staff_certification_rate'
        """
    )
