"""Add euaiact_requirement_scope mapping table

Revision ID: f0d8a2c1b3e4
Revises: e2f7c1a9b4d0
Create Date: 2026-02-14
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "f0d8a2c1b3e4"
down_revision = "e2f7c1a9b4d0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "euaiact_requirement_scope",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("article", sa.Text(), nullable=False),
        sa.Column("coverage", sa.Text(), nullable=False),
        sa.Column("primary_role", sa.Text(), nullable=False),
        sa.Column("risk_classification", sa.Text(), nullable=False),
        sa.Column("condition", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["article", "coverage"],
            ["euaiact_requirements.article", "euaiact_requirements.coverage"],
            name="fk_euaiact_scope_requirement",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "article",
            "coverage",
            "primary_role",
            "risk_classification",
            "condition",
            name="uq_euaiact_scope",
        ),
    )

    # Backfill from existing columns on euaiact_requirements
    op.execute(
        """
        INSERT INTO euaiact_requirement_scope
            (article, coverage, primary_role, risk_classification, condition)
        SELECT article, coverage, primary_role, risk_classification, condition
        FROM euaiact_requirements
        WHERE primary_role IS NOT NULL
           OR risk_classification IS NOT NULL
           OR condition IS NOT NULL
        """
    )


def downgrade():
    op.drop_table("euaiact_requirement_scope")
