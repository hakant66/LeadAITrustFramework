"""Add entity policy register tables

Revision ID: e9b0c1d2e3f4
Revises: e8a9b7c6d5e4
Create Date: 2026-02-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "e9b0c1d2e3f4"
down_revision = "e8a9b7c6d5e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "entity_policy_register",
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("policy_id", sa.Text(), nullable=False),
        sa.Column("policy_title", sa.Text(), nullable=True),
        sa.Column("policy_status", sa.Text(), nullable=True),
        sa.Column("version_id", sa.Text(), nullable=True),
        sa.Column("version_label", sa.Text(), nullable=True),
        sa.Column("version_status", sa.Text(), nullable=True),
        sa.Column("captured_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("entity_id", "policy_id", name="pk_entity_policy_register"),
        sa.ForeignKeyConstraint(["entity_id"], ["entity.id"], name="fk_entity_policy_register_entity_id"),
    )
    op.create_index(
        "ix_entity_policy_register_entity_id",
        "entity_policy_register",
        ["entity_id"],
    )

    op.create_table(
        "entity_policy_register_status",
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="finalised"),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("entity_id", name="pk_entity_policy_register_status"),
        sa.ForeignKeyConstraint(["entity_id"], ["entity.id"], name="fk_entity_policy_register_status_entity_id"),
    )
    op.create_index(
        "ix_entity_policy_register_status_entity_id",
        "entity_policy_register_status",
        ["entity_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_entity_policy_register_status_entity_id", table_name="entity_policy_register_status")
    op.drop_table("entity_policy_register_status")
    op.drop_index("ix_entity_policy_register_entity_id", table_name="entity_policy_register")
    op.drop_table("entity_policy_register")
