"""add policy execution tables

Revision ID: 20260222_add_policy_execution_tables
Revises: 20260221_add_entity_legal_standing_result
Create Date: 2026-02-22
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "20260222_add_policy_execution_tables"
down_revision = "20260221_add_entity_legal_standing_result"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "policy_control_map",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("entity_id", PG_UUID(as_uuid=True), sa.ForeignKey("entity.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("policy_id", sa.Text(), nullable=False),
        sa.Column("project_slug", sa.Text(), nullable=False),
        sa.Column("control_id", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("entity_id", "policy_id", "project_slug", "control_id", name="uq_policy_control_map"),
    )

    op.create_table(
        "policy_review_tasks",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("entity_id", PG_UUID(as_uuid=True), sa.ForeignKey("entity.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("policy_id", sa.Text(), nullable=False),
        sa.Column("policy_title", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'open'")),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("entity_id", "policy_id", name="uq_policy_review_tasks_entity_policy"),
    )


def downgrade() -> None:
    op.drop_table("policy_review_tasks")
    op.drop_table("policy_control_map")
