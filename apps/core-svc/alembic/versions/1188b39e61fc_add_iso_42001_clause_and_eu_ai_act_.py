"""add iso_42001_clause and eu_ai_act_clause to kpi_definition

Revision ID: 1188b39e61fc
Revises: 6cadd6546779
Create Date: 2025-12-09 21:16:01.067632

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1188b39e61fc'
down_revision: Union[str, Sequence[str], None] = '6cadd6546779'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new text columns
    op.add_column(
        "kpi_definition",
        sa.Column("iso_42001_clause", sa.Text(), nullable=True),
    )

    op.add_column(
        "kpi_definition",
        sa.Column("eu_ai_act_clause", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    # Drop the columns if rollback
    op.drop_column("kpi_definition", "eu_ai_act_clause")
    op.drop_column("kpi_definition", "iso_42001_clause")
