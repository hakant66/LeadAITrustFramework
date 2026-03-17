"""merge heads

Revision ID: 6cadd6546779
Revises: 1a773936cea8
Create Date: 2025-12-09 20:58:38.379075

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6cadd6546779'
down_revision: Union[str, Sequence[str], None] = '1a773936cea8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
