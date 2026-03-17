"""Add role and risk columns to euaiact_requirements

Revision ID: c7d3a1f2b9e0
Revises: b3f2c9e7a1d4
Create Date: 2026-02-13
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c7d3a1f2b9e0"
down_revision = "b3f2c9e7a1d4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "euaiact_requirements",
        sa.Column("primary_role", sa.Text(), nullable=True),
    )
    op.add_column(
        "euaiact_requirements",
        sa.Column("risk_classification", sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column("euaiact_requirements", "risk_classification")
    op.drop_column("euaiact_requirements", "primary_role")
