"""add_project_archive_fields

Revision ID: b3f2c9e7a1d4
Revises: 27f85b05996e
Create Date: 2026-02-13 22:00:00.000000

Adds soft-archive fields to entity_projects.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "b3f2c9e7a1d4"
down_revision = "merge_override_tables_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()
    if "entity_projects" not in tables:
        return

    existing_columns = [col["name"] for col in inspector.get_columns("entity_projects")]

    if "is_archived" not in existing_columns:
        op.add_column(
            "entity_projects",
            sa.Column(
                "is_archived",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )

    if "archived_at" not in existing_columns:
        op.add_column(
            "entity_projects",
            sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        )

    indexes = [idx["name"] for idx in inspector.get_indexes("entity_projects")]
    if "ix_entity_projects_entity_id_is_archived" not in indexes:
        op.create_index(
            "ix_entity_projects_entity_id_is_archived",
            "entity_projects",
            ["entity_id", "is_archived"],
        )


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()
    if "entity_projects" not in tables:
        return

    indexes = [idx["name"] for idx in inspector.get_indexes("entity_projects")]
    if "ix_entity_projects_entity_id_is_archived" in indexes:
        op.drop_index(
            "ix_entity_projects_entity_id_is_archived",
            table_name="entity_projects",
        )

    existing_columns = [col["name"] for col in inspector.get_columns("entity_projects")]
    if "archived_at" in existing_columns:
        op.drop_column("entity_projects", "archived_at")
    if "is_archived" in existing_columns:
        op.drop_column("entity_projects", "is_archived")
