"""Backfill provider/non-high and GPAI scope mappings

Revision ID: b1c2d3e4f5a6
Revises: aa3b4c5d6e7f
Create Date: 2026-02-14
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "b1c2d3e4f5a6"
down_revision = "aa3b4c5d6e7f"
branch_labels = None
depends_on = None


def upgrade():
    # Article 4 - AI literacy (provider, non-high)
    op.execute(
        """
        INSERT INTO euaiact_requirement_scope
            (article, coverage, primary_role, risk_classification, condition)
        SELECT r.article, r.coverage, 'provider', 'non-high',
               'applies to providers to ensure AI literacy for staff and operators'
        FROM euaiact_requirements r
        WHERE r.article = 'Article 4'
          AND r.coverage = 'all-obligations'
          AND NOT EXISTS (
            SELECT 1 FROM euaiact_requirement_scope s
            WHERE s.article = r.article
              AND s.coverage = r.coverage
              AND s.primary_role = 'provider'
              AND s.risk_classification = 'non-high'
              AND s.condition = 'applies to providers to ensure AI literacy for staff and operators'
          )
        """
    )

    # Article 5 - Prohibited practices (provider, non-high)
    op.execute(
        """
        INSERT INTO euaiact_requirement_scope
            (article, coverage, primary_role, risk_classification, condition)
        SELECT r.article, r.coverage, 'provider', 'non-high',
               'must not place on the market or put into service prohibited AI practices (Article 5)'
        FROM euaiact_requirements r
        WHERE r.article = 'Article 5'
          AND r.coverage = 'all-obligations'
          AND NOT EXISTS (
            SELECT 1 FROM euaiact_requirement_scope s
            WHERE s.article = r.article
              AND s.coverage = r.coverage
              AND s.primary_role = 'provider'
              AND s.risk_classification = 'non-high'
              AND s.condition = 'must not place on the market or put into service prohibited AI practices (Article 5)'
          )
        """
    )

    # Article 50(1) - direct interaction disclosure (provider, non-high)
    op.execute(
        """
        INSERT INTO euaiact_requirement_scope
            (article, coverage, primary_role, risk_classification, condition)
        SELECT r.article, r.coverage, 'provider', 'non-high',
               'applies if AI system interacts directly with natural persons (Article 50(1))'
        FROM euaiact_requirements r
        WHERE r.article = 'Article 50'
          AND r.coverage = 'all-obligations'
          AND NOT EXISTS (
            SELECT 1 FROM euaiact_requirement_scope s
            WHERE s.article = r.article
              AND s.coverage = r.coverage
              AND s.primary_role = 'provider'
              AND s.risk_classification = 'non-high'
              AND s.condition = 'applies if AI system interacts directly with natural persons (Article 50(1))'
          )
        """
    )

    # Article 50(2) - synthetic content marking (provider, non-high)
    op.execute(
        """
        INSERT INTO euaiact_requirement_scope
            (article, coverage, primary_role, risk_classification, condition)
        SELECT r.article, r.coverage, 'provider', 'non-high',
               'applies if system generates synthetic audio/image/video/text; outputs must be marked/detectable (Article 50(2))'
        FROM euaiact_requirements r
        WHERE r.article = 'Article 50'
          AND r.coverage = 'all-obligations'
          AND NOT EXISTS (
            SELECT 1 FROM euaiact_requirement_scope s
            WHERE s.article = r.article
              AND s.coverage = r.coverage
              AND s.primary_role = 'provider'
              AND s.risk_classification = 'non-high'
              AND s.condition = 'applies if system generates synthetic audio/image/video/text; outputs must be marked/detectable (Article 50(2))'
          )
        """
    )

    # GPAI Chapter V clauses (provider, non-high)
    op.execute(
        """
        INSERT INTO euaiact_requirement_scope
            (article, coverage, primary_role, risk_classification, condition)
        SELECT r.article, r.coverage, 'provider', 'non-high',
               'provider of a general-purpose AI model (GPAI)'
        FROM euaiact_requirements r
        WHERE r.article IN ('Article 51','Article 52','Article 53','Article 54','Article 55','Article 56')
        AND NOT EXISTS (
            SELECT 1 FROM euaiact_requirement_scope s
            WHERE s.article = r.article
              AND s.coverage = r.coverage
              AND s.primary_role = 'provider'
              AND s.risk_classification = 'non-high'
              AND s.condition = 'provider of a general-purpose AI model (GPAI)'
        )
        """
    )


def downgrade():
    op.execute(
        """
        DELETE FROM euaiact_requirement_scope
        WHERE primary_role = 'provider'
          AND risk_classification = 'non-high'
          AND (
            condition IN (
              'applies to providers to ensure AI literacy for staff and operators',
              'must not place on the market or put into service prohibited AI practices (Article 5)',
              'applies if AI system interacts directly with natural persons (Article 50(1))',
              'applies if system generates synthetic audio/image/video/text; outputs must be marked/detectable (Article 50(2))',
              'provider of a general-purpose AI model (GPAI)'
            )
          )
        """
    )
