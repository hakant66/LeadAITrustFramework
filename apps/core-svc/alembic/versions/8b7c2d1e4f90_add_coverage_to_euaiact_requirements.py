# apps/core-svc/alembic/versions/20260202_add_coverage_to_euaiact_requirements.py
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# --- Alembic identifiers ---
revision = "8b7c2d1e4f90"
down_revision = "c6f4e2a9b1d3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "euaiact_requirements",
        sa.Column(
            "coverage",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'all-obligations'"),
        ),
    )
    op.execute(
        """
        UPDATE euaiact_requirements
        SET coverage = 'all-obligations'
        WHERE coverage IS NULL
        """
    )


def downgrade():
    op.drop_column("euaiact_requirements", "coverage")
