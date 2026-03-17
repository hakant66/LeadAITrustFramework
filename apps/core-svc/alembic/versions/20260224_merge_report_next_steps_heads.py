"""merge report next steps heads

Revision ID: 20260224_merge_report_next_steps_heads
Revises: 20260224_add_report_next_steps, 20260229_board_level_report_professional
Create Date: 2026-02-24 08:28:00.000000
"""

from alembic import op  # noqa: F401

# revision identifiers, used by Alembic.
revision = "20260224_merge_report_next_steps_heads"
down_revision = ("20260224_add_report_next_steps", "20260229_board_level_report_professional")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
