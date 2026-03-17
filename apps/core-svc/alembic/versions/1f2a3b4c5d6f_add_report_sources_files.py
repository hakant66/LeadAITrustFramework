"""add file metadata columns to report_sources

Revision ID: 1f2a3b4c5d6f
Revises: 1f2a3b4c5d6e
Create Date: 2026-02-15 20:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "1f2a3b4c5d6f"
down_revision = "1f2a3b4c5d6e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("report_sources", sa.Column("object_key", sa.Text(), nullable=True))
    op.add_column("report_sources", sa.Column("file_name", sa.Text(), nullable=True))
    op.add_column("report_sources", sa.Column("file_mime", sa.Text(), nullable=True))
    op.add_column("report_sources", sa.Column("file_size", sa.BigInteger(), nullable=True))
    op.create_index(
        "ix_report_sources_object_key", "report_sources", ["object_key"]
    )


def downgrade() -> None:
    op.drop_index("ix_report_sources_object_key", table_name="report_sources")
    op.drop_column("report_sources", "file_size")
    op.drop_column("report_sources", "file_mime")
    op.drop_column("report_sources", "file_name")
    op.drop_column("report_sources", "object_key")
