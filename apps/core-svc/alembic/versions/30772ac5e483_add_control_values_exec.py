"""add_control_values_exec

Revision ID: 30772ac5e483
Revises: 20260216_add_knowledge_table_registry
Create Date: 2026-02-16 00:54:36.488216

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "30772ac5e483"
down_revision: Union[str, Sequence[str], None] = "20260216_add_knowledge_table_registry"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "control_values_exec",
        sa.Column("entity_slug", sa.Text(), nullable=False),
        sa.Column("project_slug", sa.Text(), nullable=False),
        sa.Column("kpi_key", sa.Text(), nullable=False),
        sa.Column("control_id", sa.Uuid(), nullable=False),
        sa.Column("owner_role", sa.Text(), nullable=True),
        sa.Column("designated_owner_name", sa.Text(), nullable=True),
        sa.Column("designated_owner_email", sa.Text(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("frequency", sa.Integer(), nullable=True),
        sa.Column("reminder_day", sa.Integer(), nullable=True),
        sa.Column("reminder_count", sa.Integer(), nullable=True),
        sa.Column("designated_owner_manager_email", sa.Text(), nullable=True),
        sa.Column("provide_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_slug", "control_id"],
            ["control_values.project_slug", "control_values.control_id"],
            ondelete="CASCADE",
            name="control_values_exec_control_values_fkey",
        ),
        sa.PrimaryKeyConstraint(
            "entity_slug",
            "project_slug",
            "control_id",
            name="control_values_exec_pkey",
        ),
    )
    op.create_index(
        "ix_control_values_exec_entity_project",
        "control_values_exec",
        ["entity_slug", "project_slug"],
    )


def downgrade() -> None:
    op.drop_index("ix_control_values_exec_entity_project", table_name="control_values_exec")
    op.drop_table("control_values_exec")
