"""Add slug and status to entity table for multi-entity support

Revision ID: add_entity_slug_status_v1
Revises: add_new_sectors_v1
Create Date: 2026-02-13

Adds slug and status fields to entity table to support multi-entity architecture.
Slug will be used for URL routing and must be unique.
Status will track entity state (active/inactive).
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "add_entity_slug_status_v1"
down_revision = "add_new_sectors_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add slug column (nullable initially, will be populated from full_legal_name)
    op.add_column("entity", sa.Column("slug", sa.Text(), nullable=True))
    
    # Generate slug from full_legal_name for existing entities
    op.execute(sa.text("""
        UPDATE entity
        SET slug = LOWER(REGEXP_REPLACE(full_legal_name, '[^a-zA-Z0-9]+', '-', 'g'))
        WHERE slug IS NULL
    """))
    
    # Handle duplicate slugs by appending numbers
    op.execute(sa.text("""
        WITH numbered_slugs AS (
            SELECT 
                id,
                slug,
                ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) as rn
            FROM entity
            WHERE slug IS NOT NULL
        ),
        updated_slugs AS (
            SELECT 
                id,
                CASE 
                    WHEN rn = 1 THEN slug
                    ELSE slug || '-' || (rn - 1)::text
                END as new_slug
            FROM numbered_slugs
        )
        UPDATE entity e
        SET slug = us.new_slug
        FROM updated_slugs us
        WHERE e.id = us.id AND e.slug != us.new_slug
    """))
    
    # Add status column with default 'active'
    op.add_column("entity", sa.Column("status", sa.Text(), nullable=False, server_default="active"))
    
    # Create unique index on slug
    op.create_index("ix_entity_slug", "entity", ["slug"], unique=True)
    
    # Create index on status
    op.create_index("ix_entity_status", "entity", ["status"])


def downgrade() -> None:
    op.drop_index("ix_entity_status", table_name="entity")
    op.drop_index("ix_entity_slug", table_name="entity")
    op.drop_column("entity", "status")
    op.drop_column("entity", "slug")
