"""merge heads before weight column

Revision ID: 2470ecbec42a
Revises: be5a84fbe3e5, 4d182907cbc0
Create Date: 2025-11-08 20:30:12.881304

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2470ecbec42a'
down_revision: Union[str, Sequence[str], None] = ('be5a84fbe3e5', '4d182907cbc0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
