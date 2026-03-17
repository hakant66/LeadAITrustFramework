"""add_manager_to_control_values_exec

Revision ID: 4e889ff3d073
Revises: 30772ac5e483
Create Date: 2026-02-16 07:40:55.411195

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4e889ff3d073"
down_revision: Union[str, Sequence[str], None] = "30772ac5e483"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "control_values_exec",
        sa.Column("designated_owner_manager", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("control_values_exec", "designated_owner_manager")
