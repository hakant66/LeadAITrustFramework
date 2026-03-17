"""Add entity_id to provenance tables

Revision ID: add_entity_id_to_provenance_v1
Revises: add_entity_id_to_control_evidence_v1
Create Date: 2026-02-13

Adds entity_id to all provenance tables (provenance_artifacts, provenance_datasets, etc.).
Entity_id will be derived from project relationship via JOIN in data migration.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "add_entity_id_to_provenance_v1"
down_revision = "add_entity_id_to_control_evidence_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    
    # Add entity_id to provenance_artifacts (via project relationship)
    if "provenance_artifacts" in inspector.get_table_names():
        op.add_column("provenance_artifacts", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to provenance_datasets (via project relationship)
    if "provenance_datasets" in inspector.get_table_names():
        op.add_column("provenance_datasets", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to provenance_models (via project relationship)
    if "provenance_models" in inspector.get_table_names():
        op.add_column("provenance_models", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to provenance_evidence (via project relationship)
    if "provenance_evidence" in inspector.get_table_names():
        op.add_column("provenance_evidence", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to provenance_lineage (via project relationship)
    if "provenance_lineage" in inspector.get_table_names():
        op.add_column("provenance_lineage", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to provenance_evaluations (via project relationship)
    if "provenance_evaluations" in inspector.get_table_names():
        op.add_column("provenance_evaluations", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to provenance_manifest_facts (via project relationship)
    if "provenance_manifest_facts" in inspector.get_table_names():
        op.add_column("provenance_manifest_facts", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Note: provenance_audit is more complex - entity_id needs to be derived from entity_type/entity_id lookup
    # This will be handled in data migration script


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    
    if "provenance_manifest_facts" in inspector.get_table_names():
        op.drop_column("provenance_manifest_facts", "entity_id")
    
    if "provenance_evaluations" in inspector.get_table_names():
        op.drop_column("provenance_evaluations", "entity_id")
    
    if "provenance_lineage" in inspector.get_table_names():
        op.drop_column("provenance_lineage", "entity_id")
    
    if "provenance_evidence" in inspector.get_table_names():
        op.drop_column("provenance_evidence", "entity_id")
    
    if "provenance_models" in inspector.get_table_names():
        op.drop_column("provenance_models", "entity_id")
    
    if "provenance_datasets" in inspector.get_table_names():
        op.drop_column("provenance_datasets", "entity_id")
    
    if "provenance_artifacts" in inspector.get_table_names():
        op.drop_column("provenance_artifacts", "entity_id")
