"""Add condition column and backfill role/risk for EU AI Act requirements

Revision ID: d1a4b7c9e2f0
Revises: c7d3a1f2b9e0
Create Date: 2026-02-14
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d1a4b7c9e2f0"
down_revision = "c7d3a1f2b9e0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "euaiact_requirements",
        sa.Column("condition", sa.Text(), nullable=True),
    )

    # Backfill Article 4 (AI literacy)
    op.execute(
        """
        UPDATE euaiact_requirements
        SET primary_role = 'deployer',
            risk_classification = 'non-high'
        WHERE article = 'Article 4'
        """
    )

    # Backfill Article 50 (Transparency obligations)
    op.execute(
        """
        UPDATE euaiact_requirements
        SET primary_role = 'deployer',
            risk_classification = 'non-high',
            condition = 'applies only to certain AI system types (emotion recognition, biometric categorisation, deepfakes, public‑interest synthetic text)'
        WHERE article = 'Article 50'
        """
    )


def downgrade():
    op.drop_column("euaiact_requirements", "condition")
