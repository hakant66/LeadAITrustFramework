"""Backfill provider high-risk scope mappings

Revision ID: c3d4e5f6a7b8
Revises: b1c2d3e4f5a6
Create Date: 2026-02-14
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "c3d4e5f6a7b8"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        INSERT INTO euaiact_requirement_scope
            (article, coverage, primary_role, risk_classification, condition)
        SELECT r.article,
               r.coverage,
               'provider',
               'high',
               CASE
                 WHEN r.article = 'Article 22'
                   THEN 'if provider established outside EU, appoint authorised representative'
                 WHEN r.article = 'Article 46'
                   THEN 'derogation only in exceptional public security or defence cases'
                 WHEN r.article = 'Article 50'
                   THEN 'applies if AI system interacts directly with natural persons or generates synthetic content'
                 WHEN r.article = 'Article 72'
                   THEN 'post-market monitoring plan for high-risk AI systems'
                 WHEN r.article = 'Article 73'
                   THEN 'report serious incidents and malfunctioning'
                 ELSE NULL
               END
        FROM euaiact_requirements r
        WHERE r.article IN (
          'Article 4','Article 5','Article 6','Article 8','Article 9','Article 10','Article 11',
          'Article 12','Article 13','Article 14','Article 15','Article 16','Article 17','Article 18',
          'Article 19','Article 20','Article 21','Article 22','Article 25','Article 40','Article 41',
          'Article 42','Article 43','Article 44','Article 45','Article 46','Article 47','Article 48',
          'Article 49','Article 50','Article 72','Article 73'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM euaiact_requirement_scope s
          WHERE s.article = r.article
            AND s.coverage = r.coverage
            AND s.primary_role = 'provider'
            AND s.risk_classification = 'high'
            AND (
              (s.condition IS NULL AND (
                 CASE
                   WHEN r.article = 'Article 22' THEN 'if provider established outside EU, appoint authorised representative'
                   WHEN r.article = 'Article 46' THEN 'derogation only in exceptional public security or defence cases'
                   WHEN r.article = 'Article 50' THEN 'applies if AI system interacts directly with natural persons or generates synthetic content'
                   WHEN r.article = 'Article 72' THEN 'post-market monitoring plan for high-risk AI systems'
                   WHEN r.article = 'Article 73' THEN 'report serious incidents and malfunctioning'
                   ELSE NULL
                 END
              ) IS NULL)
              OR s.condition = CASE
                   WHEN r.article = 'Article 22' THEN 'if provider established outside EU, appoint authorised representative'
                   WHEN r.article = 'Article 46' THEN 'derogation only in exceptional public security or defence cases'
                   WHEN r.article = 'Article 50' THEN 'applies if AI system interacts directly with natural persons or generates synthetic content'
                   WHEN r.article = 'Article 72' THEN 'post-market monitoring plan for high-risk AI systems'
                   WHEN r.article = 'Article 73' THEN 'report serious incidents and malfunctioning'
                   ELSE NULL
                 END
            )
        )
        """
    )


def downgrade():
    op.execute(
        """
        DELETE FROM euaiact_requirement_scope
        WHERE primary_role = 'provider'
          AND risk_classification = 'high'
        """
    )
