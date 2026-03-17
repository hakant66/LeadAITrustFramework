"""Update AISIA KPI mappings

Revision ID: eb1c2d3e4f5a
Revises: ea1b2c3d4e5f
Create Date: 2026-02-16
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "eb1c2d3e4f5a"
down_revision = "ea1b2c3d4e5f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE kpi_definition
        SET iso_42001_clause = '6.1.4 AI system impact assessment; 6.1.2 AI risk assessment',
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
        SET iso_42001_clause = NULL,
            iso_42001_chapter = NULL,
            euaiact_clause = NULL,
            euaiact_chapter = NULL,
            nist_clause = NULL
        WHERE kpi_key = 'aisia_completion_rate'
        """
    )
