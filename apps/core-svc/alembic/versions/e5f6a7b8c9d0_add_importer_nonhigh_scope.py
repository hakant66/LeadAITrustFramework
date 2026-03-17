"""Add importer non-high scope mappings

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-02-14
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade():
    # Article 23 - Obligations of importers (non-high: generally not applicable)
    op.execute(
        """
        INSERT INTO euaiact_requirement_scope
            (article, coverage, primary_role, risk_classification, condition)
        SELECT r.article, r.coverage, 'importer', 'non-high',
               'applies only when the imported AI system is classified as high-risk; otherwise Article 23 does not apply'
        FROM euaiact_requirements r
        WHERE r.article = 'Article 23'
        AND NOT EXISTS (
          SELECT 1 FROM euaiact_requirement_scope s
          WHERE s.article = r.article
            AND s.coverage = r.coverage
            AND s.primary_role = 'importer'
            AND s.risk_classification = 'non-high'
            AND s.condition = 'applies only when the imported AI system is classified as high-risk; otherwise Article 23 does not apply'
        )
        """
    )

    # Article 25 - Responsibilities along the AI value chain
    op.execute(
        """
        INSERT INTO euaiact_requirement_scope
            (article, coverage, primary_role, risk_classification, condition)
        SELECT r.article, r.coverage, 'importer', 'non-high',
               'applies if importer modifies, rebrands, or changes intended purpose and thus becomes provider'
        FROM euaiact_requirements r
        WHERE r.article = 'Article 25'
        AND NOT EXISTS (
          SELECT 1 FROM euaiact_requirement_scope s
          WHERE s.article = r.article
            AND s.coverage = r.coverage
            AND s.primary_role = 'importer'
            AND s.risk_classification = 'non-high'
            AND s.condition = 'applies if importer modifies, rebrands, or changes intended purpose and thus becomes provider'
        )
        """
    )


def downgrade():
    op.execute(
        """
        DELETE FROM euaiact_requirement_scope
        WHERE primary_role = 'importer'
          AND risk_classification = 'non-high'
          AND (article = 'Article 23' OR article = 'Article 25')
        """
    )
