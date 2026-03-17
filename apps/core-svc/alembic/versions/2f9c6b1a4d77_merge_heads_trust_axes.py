"""merge heads for trust axes

Revision ID: 2f9c6b1a4d77
Revises: 9294fe872fae, b5c2a6f0b7d1, 4782379f39f7
Create Date: 2026-01-24 00:25:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "2f9c6b1a4d77"
down_revision: Union[str, Sequence[str], None] = (
    "9294fe872fae",
    "b5c2a6f0b7d1",
    "4782379f39f7",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
