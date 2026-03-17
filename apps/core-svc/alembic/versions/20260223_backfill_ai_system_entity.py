"""backfill ai_system_registry entity columns

Revision ID: 20260223_backfill_ai_system_entity
Revises: 20260222_add_ai_system_helper_tooltips
Create Date: 2026-02-23
"""
from __future__ import annotations

from alembic import op

revision = "20260223_backfill_ai_system_entity"
down_revision = "20260222_add_ai_system_helper_tooltips"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE ai_system_registry s
        SET entity_id = p.entity_id,
            entity_slug = e.slug
        FROM entity_projects p
        JOIN entity e ON e.id = p.entity_id
        WHERE s.entity_id IS NULL
          AND s.project_slug IS NOT NULL
          AND s.project_slug = p.slug
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE ai_system_registry s
        SET entity_id = NULL,
            entity_slug = NULL
        WHERE s.project_slug IS NOT NULL
        """
    )
