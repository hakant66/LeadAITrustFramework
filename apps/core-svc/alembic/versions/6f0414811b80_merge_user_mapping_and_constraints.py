"""merge_user_mapping_and_constraints

Revision ID: 6f0414811b80
Revises: create_user_mapping_v1, update_composite_unique_constraints_v1
Create Date: 2026-02-12 15:25:06.053075

Merge heads: create_user_mapping_v1 and update_composite_unique_constraints_v1.
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "6f0414811b80"
down_revision: Union[str, Sequence[str], None] = (
    "create_user_mapping_v1",
    "update_composite_unique_constraints_v1",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
