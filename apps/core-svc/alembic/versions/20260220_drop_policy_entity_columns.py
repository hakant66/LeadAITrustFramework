"""drop entity_id and entity_slug from policies

Revision ID: 20260220_drop_policy_entity_columns
Revises: 20260220_add_entity_policy_register_updated_at
Create Date: 2026-02-20
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260220_drop_policy_entity_columns"
down_revision = "20260220_add_entity_policy_register_updated_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    indexes = {idx["name"] for idx in inspector.get_indexes("policies")}
    if "ix_policies_entity_slug" in indexes:
        op.drop_index("ix_policies_entity_slug", table_name="policies")

    columns = {col["name"] for col in inspector.get_columns("policies")}
    if "entity_slug" in columns:
        op.drop_column("policies", "entity_slug")
    if "entity_id" in columns:
        op.drop_column("policies", "entity_id")


def downgrade() -> None:
    op.add_column("policies", sa.Column("entity_id", sa.UUID(), nullable=True))
    op.add_column("policies", sa.Column("entity_slug", sa.Text(), nullable=True))
    op.create_index("ix_policies_entity_slug", "policies", ["entity_slug"])
