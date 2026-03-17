"""Add governance fields to ai_system_registry

Revision ID: 20260218_add_ai_system_registry_governance_fields
Revises: backfill_entity_blueprint_v1
Create Date: 2026-02-18
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260218_add_ai_system_registry_governance_fields"
down_revision = "backfill_entity_blueprint_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ai_system_registry",
        sa.Column("system_owner_email", sa.Text(), nullable=True),
    )
    op.add_column(
        "ai_system_registry",
        sa.Column("risk_owner_role", sa.Text(), nullable=True),
    )
    op.add_column(
        "ai_system_registry",
        sa.Column("decision_authority", sa.Text(), nullable=True),
    )
    op.add_column(
        "ai_system_registry",
        sa.Column("intended_use", sa.Text(), nullable=True),
    )
    op.add_column(
        "ai_system_registry",
        sa.Column("intended_users", sa.Text(), nullable=True),
    )
    op.add_column(
        "ai_system_registry",
        sa.Column("system_boundary", sa.Text(), nullable=True),
    )
    op.add_column(
        "ai_system_registry",
        sa.Column("model_type", sa.Text(), nullable=True),
    )
    op.add_column(
        "ai_system_registry",
        sa.Column("model_version", sa.Text(), nullable=True),
    )
    op.add_column(
        "ai_system_registry",
        sa.Column("deployment_environment", sa.Text(), nullable=True),
    )
    op.add_column(
        "ai_system_registry",
        sa.Column("lifecycle_stage", sa.Text(), nullable=True),
    )
    op.add_column(
        "ai_system_registry",
        sa.Column("training_data_sources", sa.Text(), nullable=True),
    )
    op.add_column(
        "ai_system_registry",
        sa.Column("personal_data_flag", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "ai_system_registry",
        sa.Column("sensitive_attributes_flag", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ai_system_registry", "sensitive_attributes_flag")
    op.drop_column("ai_system_registry", "personal_data_flag")
    op.drop_column("ai_system_registry", "training_data_sources")
    op.drop_column("ai_system_registry", "lifecycle_stage")
    op.drop_column("ai_system_registry", "deployment_environment")
    op.drop_column("ai_system_registry", "model_version")
    op.drop_column("ai_system_registry", "model_type")
    op.drop_column("ai_system_registry", "system_boundary")
    op.drop_column("ai_system_registry", "intended_users")
    op.drop_column("ai_system_registry", "intended_use")
    op.drop_column("ai_system_registry", "decision_authority")
    op.drop_column("ai_system_registry", "risk_owner_role")
    op.drop_column("ai_system_registry", "system_owner_email")
