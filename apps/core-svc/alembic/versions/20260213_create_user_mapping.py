"""Create user_mapping table to map NextAuth user IDs to backend UUIDs

Revision ID: create_user_mapping_v1
Revises: create_user_entity_access_v1
Create Date: 2026-02-13

Creates user_mapping table to map NextAuth user IDs (cuid strings) to backend UUIDs.
This enables integration between NextAuth authentication and backend authorization.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "create_user_mapping_v1"
down_revision = "create_user_entity_access_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create user_mapping table
    op.create_table(
        "user_mapping",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("nextauth_user_id", sa.Text(), nullable=False, unique=True),  # cuid from auth.User table
        sa.Column("backend_user_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True),  # UUID for backend
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nextauth_user_id", name="uq_user_mapping_nextauth_id"),
        sa.UniqueConstraint("backend_user_id", name="uq_user_mapping_backend_id"),
    )
    
    # Create indexes
    op.create_index("ix_user_mapping_nextauth_user_id", "user_mapping", ["nextauth_user_id"])
    op.create_index("ix_user_mapping_backend_user_id", "user_mapping", ["backend_user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_mapping_backend_user_id", table_name="user_mapping")
    op.drop_index("ix_user_mapping_nextauth_user_id", table_name="user_mapping")
    op.drop_table("user_mapping")
