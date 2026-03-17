"""Backfill deployer high-risk role/risk/condition in euaiact_requirements

Revision ID: e2f7c1a9b4d0
Revises: d1a4b7c9e2f0
Create Date: 2026-02-14
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "e2f7c1a9b4d0"
down_revision = "d1a4b7c9e2f0"
branch_labels = None
depends_on = None


def upgrade():
    # Article 26: core deployer obligations for high-risk AI systems
    op.execute(
        """
        UPDATE euaiact_requirements
        SET primary_role = 'deployer',
            risk_classification = 'high',
            condition = 'applies to deployers of high-risk AI systems (Annex III)'
        WHERE article = 'Article 26'
        """
    )

    # Article 27: FRIA for certain high-risk deployments
    op.execute(
        """
        UPDATE euaiact_requirements
        SET primary_role = 'deployer',
            risk_classification = 'high',
            condition = 'required for public bodies/private entities providing public services and Annex III(5)(b)/(c) credit/insurance; exception for Annex III point 2'
        WHERE article = 'Article 27'
        """
    )


def downgrade():
    # Best-effort rollback: clear role/risk/condition for these articles
    op.execute(
        """
        UPDATE euaiact_requirements
        SET primary_role = NULL,
            risk_classification = NULL,
            condition = NULL
        WHERE article IN ('Article 26','Article 27')
        """
    )
