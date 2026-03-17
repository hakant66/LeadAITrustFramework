"""merge policy template and kpi definition branches

Revision ID: 37e28a23096b
Revises: 20260220_policy_template_uuid, ef6b7c8d9e0
Create Date: 2026-02-20 15:09:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "37e28a23096b"
down_revision = ("20260220_policy_template_uuid", "ef6b7c8d9e0")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
