"""Add entity_id to trust and evaluation tables

Revision ID: add_entity_id_to_trust_tables_v1
Revises: add_entity_id_to_provenance_v1
Create Date: 2026-02-13

Adds entity_id to trust_evaluations, trustmarks, trust_monitoring_signals, trust_decay_events.
Entity_id will be derived from project relationship via JOIN in data migration.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "add_entity_id_to_trust_tables_v1"
down_revision = "add_entity_id_to_provenance_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    
    # Add entity_id to trust_evaluations (via project relationship)
    if "trust_evaluations" in inspector.get_table_names():
        op.add_column("trust_evaluations", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to trust_evaluation_audit (via evaluation relationship)
    if "trust_evaluation_audit" in inspector.get_table_names():
        op.add_column("trust_evaluation_audit", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to trustmarks (via project relationship)
    if "trustmarks" in inspector.get_table_names():
        op.add_column("trustmarks", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to trust_monitoring_signals (via project relationship)
    if "trust_monitoring_signals" in inspector.get_table_names():
        op.add_column("trust_monitoring_signals", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to trust_decay_events (via project relationship)
    if "trust_decay_events" in inspector.get_table_names():
        op.add_column("trust_decay_events", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    
    if "trust_decay_events" in inspector.get_table_names():
        op.drop_column("trust_decay_events", "entity_id")
    
    if "trust_monitoring_signals" in inspector.get_table_names():
        op.drop_column("trust_monitoring_signals", "entity_id")
    
    if "trustmarks" in inspector.get_table_names():
        op.drop_column("trustmarks", "entity_id")
    
    if "trust_evaluation_audit" in inspector.get_table_names():
        op.drop_column("trust_evaluation_audit", "entity_id")
    
    if "trust_evaluations" in inspector.get_table_names():
        op.drop_column("trust_evaluations", "entity_id")
