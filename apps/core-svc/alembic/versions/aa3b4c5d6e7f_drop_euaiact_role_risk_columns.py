"""Drop role/risk/condition columns from euaiact_requirements

Revision ID: aa3b4c5d6e7f
Revises: f0d8a2c1b3e4
Create Date: 2026-02-14
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "aa3b4c5d6e7f"
down_revision = "f0d8a2c1b3e4"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("euaiact_requirements", "condition")
    op.drop_column("euaiact_requirements", "risk_classification")
    op.drop_column("euaiact_requirements", "primary_role")


def downgrade():
    op.add_column("euaiact_requirements", op.Column("primary_role", op.Text(), nullable=True))
    op.add_column(
        "euaiact_requirements", op.Column("risk_classification", op.Text(), nullable=True)
    )
    op.add_column("euaiact_requirements", op.Column("condition", op.Text(), nullable=True))
