"""Add entity_id to project-dependent tables

Revision ID: add_entity_id_to_project_tables_v1
Revises: add_entity_id_to_core_tables_v1
Create Date: 2026-02-13

Adds entity_id to tables that reference projects (assessments, pillar_overrides, etc.).
Entity_id will be derived from project relationship via JOIN in data migration.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "add_entity_id_to_project_tables_v1"
down_revision = "add_entity_id_to_core_tables_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add entity_id to assessments (via project relationship)
    op.add_column("assessments", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to pillar_overrides (via project relationship)
    op.add_column("pillar_overrides", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to pillar_overrides_history (via project relationship)
    inspector = sa.inspect(op.get_bind())
    if "pillar_overrides_history" in inspector.get_table_names():
        op.add_column("pillar_overrides_history", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to project_translations (via project relationship)
    op.add_column("project_translations", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to project_pillar_scores (via project relationship)
    op.add_column("project_pillar_scores", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    
    op.drop_column("project_pillar_scores", "entity_id")
    op.drop_column("project_translations", "entity_id")
    
    if "pillar_overrides_history" in inspector.get_table_names():
        op.drop_column("pillar_overrides_history", "entity_id")
    
    op.drop_column("pillar_overrides", "entity_id")
    op.drop_column("assessments", "entity_id")
