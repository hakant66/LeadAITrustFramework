"""Merge override tables migration into latest head

Revision ID: merge_override_tables_v1
Revises: backfill_entity_blueprint_v1, add_entity_override_tables_v1
Create Date: 2026-02-13

This merge revision connects the override tables migration to the current head.
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "merge_override_tables_v1"
down_revision: Union[str, Sequence[str], None] = (
    "backfill_entity_blueprint_v1",
    "add_entity_override_tables_v1",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
