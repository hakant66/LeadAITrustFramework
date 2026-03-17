"""Add extended project metadata columns

Revision ID: 20251018_add_project_fields
Revises: 20251017_add_pillar_overrides
Create Date: 2025-10-18
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20251018_add_project_fields"
down_revision = "20251017_add_pillar_overrides"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("priority", sa.String(length=50), nullable=True))
    op.add_column("projects", sa.Column("sponsor", sa.String(length=100), nullable=True))
    op.add_column("projects", sa.Column("owner", sa.String(length=100), nullable=True))
    op.add_column(
        "projects",
        sa.Column("creation_date", sa.Date(), nullable=True, server_default=sa.text("CURRENT_DATE")),
    )
    op.add_column(
        "projects",
        sa.Column("update_date", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
    )

    op.execute(
        """
        UPDATE projects
        SET priority = COALESCE(priority, risk_level),
            creation_date = COALESCE(creation_date, CURRENT_DATE),
            update_date = COALESCE(update_date, NOW())
        """
    )


def downgrade() -> None:
    op.drop_column("projects", "update_date")
    op.drop_column("projects", "creation_date")
    op.drop_column("projects", "owner")
    op.drop_column("projects", "sponsor")
    op.drop_column("projects", "priority")
