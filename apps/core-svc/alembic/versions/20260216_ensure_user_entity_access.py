"""Ensure user_entity_access table exists

Revision ID: ensure_user_entity_access_v1
Revises: add_entity_archive_v1
Create Date: 2026-02-16

Creates user_entity_access if missing (e.g. DB was at a head that skipped the original migration).
Idempotent: no-op if table already exists.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "ensure_user_entity_access_v1"
down_revision = "add_entity_archive_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "user_entity_access" in insp.get_table_names():
        return
    op.create_table(
        "user_entity_access",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.Text(), nullable=False, server_default="viewer"),
        sa.Column("granted_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("granted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "entity_id", name="uq_user_entity_access_user_entity"),
    )
    op.create_index("ix_user_entity_access_user_id", "user_entity_access", ["user_id"])
    op.create_index("ix_user_entity_access_entity_id", "user_entity_access", ["entity_id"])
    op.create_index("ix_user_entity_access_role", "user_entity_access", ["role"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "user_entity_access" not in insp.get_table_names():
        return
    op.drop_index("ix_user_entity_access_role", table_name="user_entity_access")
    op.drop_index("ix_user_entity_access_entity_id", table_name="user_entity_access")
    op.drop_index("ix_user_entity_access_user_id", table_name="user_entity_access")
    op.drop_table("user_entity_access")
