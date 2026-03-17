"""add user profile fields

Revision ID: 20260224_add_user_profile_fields
Revises: 20260224_merge_report_next_steps_heads
Create Date: 2026-02-24 08:35:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260224_add_user_profile_fields"
down_revision = "20260224_merge_report_next_steps_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("User", sa.Column("department", sa.Text(), nullable=True), schema="auth")
    op.add_column("User", sa.Column("role", sa.Text(), nullable=True), schema="auth")
    op.add_column("User", sa.Column("status", sa.Text(), nullable=True), schema="auth")


def downgrade() -> None:
    op.drop_column("User", "status", schema="auth")
    op.drop_column("User", "role", schema="auth")
    op.drop_column("User", "department", schema="auth")
