"""add comment_text to control_values_exec

Revision ID: e8a9b7c6d5e4
Revises: d7e8f9a0b1c2
Create Date: 2026-02-16
"""
from alembic import op
import sqlalchemy as sa

revision = "e8a9b7c6d5e4"
down_revision = "d7e8f9a0b1c2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "control_values_exec",
        sa.Column("comment_text", sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column("control_values_exec", "comment_text")
