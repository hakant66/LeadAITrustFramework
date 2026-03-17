"""add_missing_entity_id_and_slug_columns

Revision ID: 27f85b05996e
Revises: add_entity_slug_to_tables_v1
Create Date: 2026-02-12 15:51:00.000000

Adds missing entity_id and entity_slug columns to aims_scope and entity_projects tables.
This migration is idempotent and handles cases where columns may already exist.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision = "27f85b05996e"
down_revision = "add_entity_slug_to_tables_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()
    
    # Tables that need entity_id and entity_slug
    tables_to_update = {
        "aims_scope": {
            "entity_id": postgresql.UUID(as_uuid=True),
            "entity_slug": sa.Text(),
        },
        "entity_projects": {
            "entity_id": postgresql.UUID(as_uuid=True),
            "entity_slug": sa.Text(),
        },
    }
    
    # Add columns if they don't exist
    for table_name, columns in tables_to_update.items():
        if table_name not in tables:
            continue
            
        existing_columns = [col["name"] for col in inspector.get_columns(table_name)]
        
        # Add entity_id if missing
        if "entity_id" not in existing_columns:
            op.add_column(
                table_name,
                sa.Column("entity_id", columns["entity_id"], nullable=True)
            )
            print(f"Added entity_id column to {table_name}")
        else:
            print(f"entity_id column already exists in {table_name}")
        
        # Add entity_slug if missing
        if "entity_slug" not in existing_columns:
            op.add_column(
                table_name,
                sa.Column("entity_slug", columns["entity_slug"], nullable=True)
            )
            print(f"Added entity_slug column to {table_name}")
        else:
            print(f"entity_slug column already exists in {table_name}")
    
    # Create indexes if they don't exist
    for table_name in tables_to_update.keys():
        if table_name not in tables:
            continue
            
        # Check if index exists
        indexes = [idx["name"] for idx in inspector.get_indexes(table_name)]
        
        if f"ix_{table_name}_entity_slug" not in indexes:
            op.create_index(
                f"ix_{table_name}_entity_slug",
                table_name,
                ["entity_slug"]
            )
            print(f"Created index ix_{table_name}_entity_slug")
        else:
            print(f"Index ix_{table_name}_entity_slug already exists")
    
    # Backfill entity_slug from entity table (only for rows with entity_id)
    conn = op.get_bind()
    
    for table_name in tables_to_update.keys():
        if table_name not in tables:
            continue
            
        existing_columns = [col["name"] for col in inspector.get_columns(table_name)]
        
        # Only backfill if both columns exist
        if "entity_id" in existing_columns and "entity_slug" in existing_columns:
            result = conn.execute(sa.text(f"""
                UPDATE {table_name} t
                SET entity_slug = e.slug
                FROM entity e
                WHERE t.entity_id = e.id 
                  AND t.entity_slug IS NULL
                  AND t.entity_id IS NOT NULL
            """))
            updated_count = result.rowcount
            print(f"Backfilled {updated_count} rows in {table_name}")


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    tables = inspector.get_table_names()
    
    tables_to_update = ["aims_scope", "entity_projects"]
    
    # Drop indexes first
    for table_name in tables_to_update:
        if table_name not in tables:
            continue
            
        indexes = [idx["name"] for idx in inspector.get_indexes(table_name)]
        if f"ix_{table_name}_entity_slug" in indexes:
            op.drop_index(f"ix_{table_name}_entity_slug", table_name=table_name)
    
    # Drop columns
    for table_name in tables_to_update:
        if table_name not in tables:
            continue
            
        existing_columns = [col["name"] for col in inspector.get_columns(table_name)]
        
        if "entity_slug" in existing_columns:
            op.drop_column(table_name, "entity_slug")
        
        if "entity_id" in existing_columns:
            op.drop_column(table_name, "entity_id")
