"""rename maturity_anchor_L3 -> maturity_anchor_l3 (controls, control_values, control_values_history)

Revision ID: 85ea2ba8269f
Revises: 9394b510e86a
Create Date: 2025-11-10 13:15:04.849431

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '85ea2ba8269f'
down_revision: Union[str, Sequence[str], None] = '9394b510e86a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.alter_column("controls", "maturity_anchor_L3", new_column_name="maturity_anchor_l3", schema="public")
    op.alter_column("control_values", "maturity_anchor_L3", new_column_name="maturity_anchor_l3", schema="public")
    op.alter_column("control_values_history", "maturity_anchor_L3", new_column_name="maturity_anchor_l3", schema="public")

def downgrade():
    op.alter_column("controls", "maturity_anchor_l3", new_column_name="maturity_anchor_L3", schema="public")
    op.alter_column("control_values", "maturity_anchor_l3", new_column_name="maturity_anchor_L3", schema="public")
    op.alter_column("control_values_history", "maturity_anchor_l3", new_column_name="maturity_anchor_L3", schema="public")