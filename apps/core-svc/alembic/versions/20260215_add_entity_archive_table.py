"""Add entity_archive table for archived entities

Revision ID: add_entity_archive_v1
Revises: add_entity_slug_after_fix_v1
Create Date: 2026-02-15

Creates entity_archive table with same columns as entity plus action, archived_by, archived_at.
Used when archiving an entity from the master admin page.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "add_entity_archive_v1"
down_revision = "add_entity_slug_after_fix_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "entity_archive",
        # Same columns as entity (no FK to entity_country etc. to allow archive after lookups may change)
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("full_legal_name", sa.Text(), nullable=False),
        sa.Column("legal_form", sa.Text(), nullable=True),
        sa.Column("company_registration_number", sa.Text(), nullable=True),
        sa.Column("headquarters_country_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("website", sa.Text(), nullable=True),
        sa.Column("regions_other", sa.Text(), nullable=True),
        sa.Column("sector_other", sa.Text(), nullable=True),
        sa.Column("employee_count", sa.Text(), nullable=True),
        sa.Column("annual_turnover", sa.Text(), nullable=True),
        sa.Column("primary_role_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("risk_classification_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decision_trace", sa.Text(), nullable=True),
        sa.Column("authorized_representative_name", sa.Text(), nullable=True),
        sa.Column("authorized_representative_email", sa.Text(), nullable=True),
        sa.Column("authorized_representative_phone", sa.Text(), nullable=True),
        sa.Column("ai_compliance_officer_name", sa.Text(), nullable=True),
        sa.Column("ai_compliance_officer_email", sa.Text(), nullable=True),
        sa.Column("executive_sponsor_name", sa.Text(), nullable=True),
        sa.Column("executive_sponsor_email", sa.Text(), nullable=True),
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
        sa.Column("slug", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=True),
        # Archive-specific columns
        sa.Column("action", sa.Text(), nullable=False, server_default="archived"),
        sa.Column("archived_by", sa.Text(), nullable=True),
        sa.Column("archived_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_entity_archive_slug", "entity_archive", ["slug"])
    op.create_index("ix_entity_archive_archived_at", "entity_archive", ["archived_at"])
    op.create_index("ix_entity_archive_archived_by", "entity_archive", ["archived_by"])


def downgrade() -> None:
    op.drop_index("ix_entity_archive_archived_by", table_name="entity_archive")
    op.drop_index("ix_entity_archive_archived_at", table_name="entity_archive")
    op.drop_index("ix_entity_archive_slug", table_name="entity_archive")
    op.drop_table("entity_archive")
