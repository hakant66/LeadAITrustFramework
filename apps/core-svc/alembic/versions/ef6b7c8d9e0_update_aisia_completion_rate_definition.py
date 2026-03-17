"""Update aisia_completion_rate KPI definition

Revision ID: ef6b7c8d9e0
Revises: ef5a6b7c8d9
Create Date: 2026-02-16
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "ef6b7c8d9e0"
down_revision = "ef5a6b7c8d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE kpi_definition
        SET definition = $$
AI System Impact Assessment Completion Rate:
1. Core Objective
Ensures that AI systems complete formal impact assessments before deployment.

2. Key Performance Indicators (KPIs)
Definition
- Percentage of AI projects with a completed impact assessment on file.
Calculation & Target
- Formula: (Projects with Approved AISIA / Total Projects) * 100.
- Example: 100% (12 of 12).

3. Required Evidence
- Signed impact assessment documents
- Review/approval records
- Identified mitigations and follow-up actions

4. Ownership & Timeline
- Owners: Risk / Legal / Governance
- Timeline: Pre‑GTM and major changes
$$,
            iso_42001_clause = '6.1.4 AI system impact assessment; 6.1.2 AI risk assessment',
            iso_42001_chapter = NULL,
            euaiact_clause = 'Art 27 Fundamental rights impact assessment',
            euaiact_chapter = 'Ch III: High-Risk AI Systems',
            nist_clause = 'MAP 5.1'
        WHERE kpi_key = 'aisia_completion_rate'
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
        WHERE kpi_key = 'aisia_completion_rate'
        """
    )
