"""add report_sources table for knowledge vault

Revision ID: 1f2a3b4c5d6e
Revises: 1e2f3a4b5c6d
Create Date: 2026-02-15 19:10:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "1f2a3b4c5d6e"
down_revision = "1e2f3a4b5c6d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "report_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_slug", sa.Text(), nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("source_type", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_by", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.ForeignKeyConstraint(["entity_id"], ["entity.id"], name="report_sources_entity_id_fkey"),
    )
    op.create_index(
        "ix_report_sources_entity_id",
        "report_sources",
        ["entity_id"],
    )
    op.create_index(
        "ix_report_sources_project_slug",
        "report_sources",
        ["project_slug"],
    )


def downgrade() -> None:
    op.drop_index("ix_report_sources_project_slug", table_name="report_sources")
    op.drop_index("ix_report_sources_entity_id", table_name="report_sources")
    op.drop_table("report_sources")
