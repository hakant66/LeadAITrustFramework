"""Add entity_id to other tables (llm_report_cache, ai_system_registry, policy_versions, etc.)

Revision ID: add_entity_id_to_other_tables_v1
Revises: add_entity_id_to_trust_tables_v1
Create Date: 2026-02-13

Adds entity_id to remaining tables: llm_report_cache, ai_system_registry, policy_versions,
policy_alerts, jira_sync_history. Entity_id will be derived from project/policy relationships.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "add_entity_id_to_other_tables_v1"
down_revision = "add_entity_id_to_trust_tables_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    
    # Add entity_id to llm_report_cache (via project relationship)
    if "llm_report_cache" in inspector.get_table_names():
        op.add_column("llm_report_cache", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to ai_system_registry (via project relationship)
    if "ai_system_registry" in inspector.get_table_names():
        op.add_column("ai_system_registry", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to policy_versions (via policy relationship)
    if "policy_versions" in inspector.get_table_names():
        op.add_column("policy_versions", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to policy_alerts (via policy relationship)
    if "policy_alerts" in inspector.get_table_names():
        op.add_column("policy_alerts", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to jira_sync_history (via jira_configs relationship)
    if "jira_sync_history" in inspector.get_table_names():
        op.add_column("jira_sync_history", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to jira_sync_metadata (via project relationship)
    if "jira_sync_metadata" in inspector.get_table_names():
        op.add_column("jira_sync_metadata", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to jira_risk_register (via project relationship)
    if "jira_risk_register" in inspector.get_table_names():
        op.add_column("jira_risk_register", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to ai_requirement_register (via project relationship)
    if "ai_requirement_register" in inspector.get_table_names():
        op.add_column("ai_requirement_register", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add entity_id to ai_readiness_results (if exists and entity-scoped)
    if "ai_readiness_results" in inspector.get_table_names():
        # Check if this table should be entity-scoped - may be global
        # For now, add column but may remain NULL if global
        op.add_column("ai_readiness_results", sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    
    if "ai_readiness_results" in inspector.get_table_names():
        op.drop_column("ai_readiness_results", "entity_id")
    
    if "ai_requirement_register" in inspector.get_table_names():
        op.drop_column("ai_requirement_register", "entity_id")
    
    if "jira_risk_register" in inspector.get_table_names():
        op.drop_column("jira_risk_register", "entity_id")
    
    if "jira_sync_metadata" in inspector.get_table_names():
        op.drop_column("jira_sync_metadata", "entity_id")
    
    if "jira_sync_history" in inspector.get_table_names():
        op.drop_column("jira_sync_history", "entity_id")
    
    if "policy_alerts" in inspector.get_table_names():
        op.drop_column("policy_alerts", "entity_id")
    
    if "policy_versions" in inspector.get_table_names():
        op.drop_column("policy_versions", "entity_id")
    
    if "ai_system_registry" in inspector.get_table_names():
        op.drop_column("ai_system_registry", "entity_id")
    
    if "llm_report_cache" in inspector.get_table_names():
        op.drop_column("llm_report_cache", "entity_id")
