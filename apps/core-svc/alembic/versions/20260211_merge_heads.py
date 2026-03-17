"""Merge jira_integration_v1 and e1b2c3d4f5a6 heads

Revision ID: merge_20260211
Revises: jira_integration_v1, e1b2c3d4f5a6
Create Date: 2026-02-11

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision = "merge_20260211"
down_revision: Union[str, Sequence[str], None] = ("jira_integration_v1", "e1b2c3d4f5a6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
