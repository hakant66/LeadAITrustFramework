# apps/core-svc/alembic/versions/20260202_add_euaiact_requirements_table.py
from __future__ import annotations

import json
from pathlib import Path

from alembic import op
import sqlalchemy as sa

# --- Alembic identifiers ---
revision = "c6f4e2a9b1d3"
down_revision = "ab12cd34ef56"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "euaiact_requirements",
        sa.Column("chapter", sa.Text(), nullable=True),
        sa.Column("section", sa.Text(), nullable=True),
        sa.Column("article", sa.Text(), primary_key=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("links", sa.Text(), nullable=True),
    )

    data_path = (
        Path(__file__).resolve().parents[2]
        / "app"
        / "seed_data"
        / "eu_ai_act_requirements.json"
    )
    if not data_path.exists():
        return

    rows = json.loads(data_path.read_text(encoding="utf-8"))
    requirements = sa.table(
        "euaiact_requirements",
        sa.column("chapter", sa.Text()),
        sa.column("section", sa.Text()),
        sa.column("article", sa.Text()),
        sa.column("content", sa.Text()),
        sa.column("links", sa.Text()),
    )
    if rows:
        op.bulk_insert(requirements, rows)


def downgrade():
    op.drop_table("euaiact_requirements")
