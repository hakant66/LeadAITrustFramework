"""Add entity_id to control and evidence tables

Revision ID: add_entity_id_to_control_evidence_v1
Revises: add_entity_id_to_project_tables_v1
Create Date: 2026-02-13

Adds entity_id to control_values, control_values_history, evidence, and evidence_audit tables.
Entity_id will be derived from project relationship via JOIN in data migration.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "add_entity_id_to_control_evidence_v1"
down_revision = "add_entity_id_to_project_tables_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add entity_id to control_values (via project relationship)
    op.add_column("control_values", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to control_values_history (via project relationship)
    op.add_column("control_values_history", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to evidence (via project relationship)
    op.add_column("evidence", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to evidence_audit (via evidence relationship)
    op.add_column("evidence_audit", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    op.drop_column("evidence_audit", "entity_id")
    op.drop_column("evidence", "entity_id")
    op.drop_column("control_values_history", "entity_id")
    op.drop_column("control_values", "entity_id")
