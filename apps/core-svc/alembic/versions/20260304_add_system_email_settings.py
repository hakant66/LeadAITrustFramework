"""Add encrypted system email settings table

Revision ID: 20260304_add_system_email_settings
Revises: 20260303_add_entity_provider_artifacts
Create Date: 2026-03-04 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260304_add_system_email_settings"
down_revision = "20260303_add_entity_provider_artifacts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    op.create_table(
        "system_email_settings",
        sa.Column("singleton", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("smtp_url_enc", postgresql.BYTEA(), nullable=False),
        sa.Column("email_from", sa.Text(), nullable=False),
        sa.Column(
            "updated_by",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("singleton", name="pk_system_email_settings_singleton"),
        sa.CheckConstraint("singleton = true", name="ck_system_email_settings_singleton_true"),
    )


def downgrade() -> None:
    op.drop_table("system_email_settings")
