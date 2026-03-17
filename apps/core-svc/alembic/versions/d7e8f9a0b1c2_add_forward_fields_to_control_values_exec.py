"""add forward fields to control_values_exec

Revision ID: d7e8f9a0b1c2
Revises: c2d3e4f5a6b7
Create Date: 2026-02-16
"""
from alembic import op
import sqlalchemy as sa

revision = "d7e8f9a0b1c2"
down_revision = "c2d3e4f5a6b7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "control_values_exec",
        sa.Column("forward_request", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "control_values_exec",
        sa.Column("forward_email", sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column("control_values_exec", "forward_email")
    op.drop_column("control_values_exec", "forward_request")
