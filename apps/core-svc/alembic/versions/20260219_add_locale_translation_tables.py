"""add locale translation tables for entities, systems, policies, reports

Revision ID: 20260219_add_locale_translation_tables
Revises: 20260218_add_project_translation_fields
Create Date: 2026-02-19
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260219_add_locale_translation_tables"
down_revision = "20260218_add_project_translation_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "entity_translations",
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("locale", sa.String(length=10), nullable=False),
        sa.Column("full_legal_name", sa.Text(), nullable=True),
        sa.Column("legal_form", sa.Text(), nullable=True),
        sa.Column("regions_other", sa.Text(), nullable=True),
        sa.Column("sector_other", sa.Text(), nullable=True),
        sa.Column("employee_count", sa.Text(), nullable=True),
        sa.Column("annual_turnover", sa.Text(), nullable=True),
        sa.Column("decision_trace", sa.Text(), nullable=True),
        sa.Column("authorized_representative_name", sa.Text(), nullable=True),
        sa.Column("ai_compliance_officer_name", sa.Text(), nullable=True),
        sa.Column("executive_sponsor_name", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("entity_id", "locale", name="entity_translations_pkey"),
        sa.ForeignKeyConstraint(["entity_id"], ["entity.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_entity_translations_locale", "entity_translations", ["locale"], unique=False)

    op.create_table(
        "ai_system_translations",
        sa.Column("system_id", sa.Text(), nullable=False),
        sa.Column("locale", sa.String(length=10), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("owner", sa.Text(), nullable=True),
        sa.Column("business_unit", sa.Text(), nullable=True),
        sa.Column("vendor", sa.Text(), nullable=True),
        sa.Column("provider_type", sa.Text(), nullable=True),
        sa.Column("intended_use", sa.Text(), nullable=True),
        sa.Column("intended_users", sa.Text(), nullable=True),
        sa.Column("system_boundary", sa.Text(), nullable=True),
        sa.Column("model_type", sa.Text(), nullable=True),
        sa.Column("model_version", sa.Text(), nullable=True),
        sa.Column("deployment_environment", sa.Text(), nullable=True),
        sa.Column("lifecycle_stage", sa.Text(), nullable=True),
        sa.Column("training_data_sources", sa.Text(), nullable=True),
        sa.Column("risk_tier", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=True),
        sa.Column("region_scope", sa.Text(), nullable=True),
        sa.Column("data_sensitivity", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("system_id", "locale", name="ai_system_translations_pkey"),
        sa.ForeignKeyConstraint(["system_id"], ["ai_system_registry.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_ai_system_translations_locale", "ai_system_translations", ["locale"], unique=False)

    op.create_table(
        "policy_translations",
        sa.Column("policy_id", sa.Text(), nullable=False),
        sa.Column("locale", sa.String(length=10), nullable=False),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("policy_id", "locale", name="policy_translations_pkey"),
        sa.ForeignKeyConstraint(["policy_id"], ["policies.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_policy_translations_locale", "policy_translations", ["locale"], unique=False)

    op.create_table(
        "policy_version_translations",
        sa.Column("version_id", sa.Text(), nullable=False),
        sa.Column("locale", sa.String(length=10), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("version_id", "locale", name="policy_version_translations_pkey"),
        sa.ForeignKeyConstraint(["version_id"], ["policy_versions.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_policy_version_translations_locale", "policy_version_translations", ["locale"], unique=False)

    op.create_table(
        "report_translations",
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_slug", sa.Text(), nullable=False),
        sa.Column("report_type", sa.Text(), nullable=False),
        sa.Column("locale", sa.String(length=10), nullable=False),
        sa.Column("report_md", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint(
            "entity_id",
            "project_slug",
            "report_type",
            "locale",
            name="report_translations_pkey",
        ),
        sa.ForeignKeyConstraint(["entity_id"], ["entity.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_report_translations_locale", "report_translations", ["locale"], unique=False)
    op.create_index(
        "ix_report_translations_entity_project",
        "report_translations",
        ["entity_id", "project_slug"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_report_translations_entity_project", table_name="report_translations")
    op.drop_index("ix_report_translations_locale", table_name="report_translations")
    op.drop_table("report_translations")

    op.drop_index("ix_policy_version_translations_locale", table_name="policy_version_translations")
    op.drop_table("policy_version_translations")

    op.drop_index("ix_policy_translations_locale", table_name="policy_translations")
    op.drop_table("policy_translations")

    op.drop_index("ix_ai_system_translations_locale", table_name="ai_system_translations")
    op.drop_table("ai_system_translations")

    op.drop_index("ix_entity_translations_locale", table_name="entity_translations")
    op.drop_table("entity_translations")
