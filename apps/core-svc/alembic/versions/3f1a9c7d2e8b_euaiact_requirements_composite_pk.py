# apps/core-svc/alembic/versions/20260202_euaiact_requirements_composite_pk.py
from __future__ import annotations

from alembic import op

# --- Alembic identifiers ---
revision = "3f1a9c7d2e8b"
down_revision = "8b7c2d1e4f90"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("euaiact_requirements_pkey", "euaiact_requirements", type_="primary")
    op.create_primary_key(
        "euaiact_requirements_pkey",
        "euaiact_requirements",
        ["article", "coverage"],
    )


def downgrade():
    op.drop_constraint("euaiact_requirements_pkey", "euaiact_requirements", type_="primary")
    op.create_primary_key(
        "euaiact_requirements_pkey",
        "euaiact_requirements",
        ["article"],
    )
