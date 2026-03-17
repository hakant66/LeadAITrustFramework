"""Add entity_id to core tables (entity_projects, aims_scope, policies, audit_events, etc.)

Revision ID: add_entity_id_to_core_tables_v1
Revises: create_user_entity_access_v1
Create Date: 2026-02-13

Adds entity_id column to core tenant-scoped tables. Columns are nullable initially
and will be backfilled in a later migration before being set to NOT NULL.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "add_entity_id_to_core_tables_v1"
down_revision = "create_user_entity_access_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add entity_id to entity_projects
    op.add_column("entity_projects", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to aims_scope
    op.add_column("aims_scope", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to policies
    op.add_column("policies", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to audit_events
    op.add_column("audit_events", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to euaiact_entity_definitions (if table exists)
    # Check if table exists first
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "euaiact_entity_definitions" in inspector.get_table_names():
        op.add_column("euaiact_entity_definitions", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to jira_configs (if table exists)
    if "jira_configs" in inspector.get_table_names():
        op.add_column("jira_configs", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    
    if "jira_configs" in inspector.get_table_names():
        op.drop_column("jira_configs", "entity_id")
    
    if "euaiact_entity_definitions" in inspector.get_table_names():
        op.drop_column("euaiact_entity_definitions", "entity_id")
    
    op.drop_column("audit_events", "entity_id")
    op.drop_column("policies", "entity_id")
    op.drop_column("aims_scope", "entity_id")
    op.drop_column("entity_projects", "entity_id")
