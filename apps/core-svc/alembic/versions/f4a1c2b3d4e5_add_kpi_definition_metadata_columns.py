"""add metadata columns to kpi_definition

Revision ID: f4a1c2b3d4e5
Revises: e1b2c3d4e5f6
Create Date: 2026-02-04 10:52:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f4a1c2b3d4e5"
down_revision: Union[str, Sequence[str], None] = "e1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "kpi_definition",
        sa.Column("eu_ai_act_chapter", sa.Text(), nullable=True),
    )
    op.add_column(
        "kpi_definition",
        sa.Column("iso_42001_chapter", sa.Text(), nullable=True),
    )
    op.add_column(
        "kpi_definition",
        sa.Column("coverage_category", sa.Text(), nullable=True),
    )
    op.add_column(
        "kpi_definition",
        sa.Column("regulatory_link", sa.Text(), nullable=True),
    )
    op.add_column(
        "kpi_definition",
        sa.Column("requirement_summary", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("kpi_definition", "requirement_summary")
    op.drop_column("kpi_definition", "regulatory_link")
    op.drop_column("kpi_definition", "coverage_category")
    op.drop_column("kpi_definition", "iso_42001_chapter")
    op.drop_column("kpi_definition", "eu_ai_act_chapter")
