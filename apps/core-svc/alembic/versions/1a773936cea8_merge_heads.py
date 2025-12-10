"""merge heads

Revision ID: 1a773936cea8
Revises: 7fdc91018843
Create Date: 2025-12-08 16:58:29.289134

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1a773936cea8'
down_revision: Union[str, Sequence[str], None] = '7fdc91018843'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
