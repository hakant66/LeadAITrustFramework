"""drop kpi_values and add kpi_definition

Revision ID: 7fdc91018843
Revises: 93714713f947
Create Date: 2025-12-08 16:26:07.333159

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7fdc91018843'
down_revision: Union[str, Sequence[str], None] = '93714713f947'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
