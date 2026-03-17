"""add report_next_steps table

Revision ID: 20260224_add_report_next_steps
Revises: 20260222_add_ai_system_helper_tooltips
Create Date: 2026-02-24 08:25:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260224_add_report_next_steps"
down_revision = "20260222_add_ai_system_helper_tooltips"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "report_next_steps",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("report_key", sa.Text(), nullable=False, server_default="board-level-report"),
        sa.Column("priority", sa.Text(), nullable=False, server_default="medium"),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("owner", sa.Text(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["entity_id"], ["entity.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_report_next_steps_entity_report",
        "report_next_steps",
        ["entity_id", "report_key", "sort_order"],
    )


def downgrade() -> None:
    op.drop_index("ix_report_next_steps_entity_report", table_name="report_next_steps")
    op.drop_table("report_next_steps")
