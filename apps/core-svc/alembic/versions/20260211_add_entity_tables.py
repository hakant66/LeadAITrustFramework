"""Add entity, country, sector, market tables for entity profile

Revision ID: entity_tables_v1
Revises: jira_integration_v1
Create Date: 2026-02-11

Stores data captured at /entity: core identifiers, operational scope (regions, sectors),
company size, and compliance personnel. Country/sector/market are lookup tables;
entity references them and uses junction tables for many-to-many (regions, sectors).
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "entity_tables_v1"
down_revision = "merge_20260211"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Lookup: country (headquarters + regions of operation)
    op.create_table(
        "country",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_country_name", "country", ["name"], unique=True)

    # Lookup: sector / industry
    op.create_table(
        "sector",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sector_name", "sector", ["name"], unique=True)

    # Lookup: market role (Provider, Deployer, Importer, Distributor)
    op.create_table(
        "market",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_market_name", "market", ["name"], unique=True)

    # Main entity table (data from /entity form)
    op.create_table(
        "entity",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("full_legal_name", sa.Text(), nullable=False),
        sa.Column("legal_form", sa.Text(), nullable=True),
        sa.Column("company_registration_number", sa.Text(), nullable=True),
        sa.Column("headquarters_country_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("website", sa.Text(), nullable=True),
        sa.Column("regions_other", sa.Text(), nullable=True),
        sa.Column("sector_other", sa.Text(), nullable=True),
        sa.Column("employee_count", sa.Text(), nullable=True),
        sa.Column("annual_turnover", sa.Text(), nullable=True),
        sa.Column("market_role_id", postgresql.UUID(as_uuid=True), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["headquarters_country_id"], ["country.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["market_role_id"], ["market.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_entity_full_legal_name", "entity", ["full_legal_name"])
    op.create_index("ix_entity_headquarters_country_id", "entity", ["headquarters_country_id"])
    op.create_index("ix_entity_market_role_id", "entity", ["market_role_id"])

    # Junction: entity <-> country (regions of operation)
    op.create_table(
        "entity_region",
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("country_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.PrimaryKeyConstraint("entity_id", "country_id"),
        sa.ForeignKeyConstraint(["entity_id"], ["entity.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["country_id"], ["country.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_entity_region_entity_id", "entity_region", ["entity_id"])
    op.create_index("ix_entity_region_country_id", "entity_region", ["country_id"])

    # Junction: entity <-> sector (multiple sectors)
    op.create_table(
        "entity_sector",
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sector_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.PrimaryKeyConstraint("entity_id", "sector_id"),
        sa.ForeignKeyConstraint(["entity_id"], ["entity.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sector_id"], ["sector.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_entity_sector_entity_id", "entity_sector", ["entity_id"])
    op.create_index("ix_entity_sector_sector_id", "entity_sector", ["sector_id"])


def downgrade() -> None:
    op.drop_index("ix_entity_sector_sector_id", table_name="entity_sector")
    op.drop_index("ix_entity_sector_entity_id", table_name="entity_sector")
    op.drop_table("entity_sector")

    op.drop_index("ix_entity_region_country_id", table_name="entity_region")
    op.drop_index("ix_entity_region_entity_id", table_name="entity_region")
    op.drop_table("entity_region")

    op.drop_index("ix_entity_market_role_id", table_name="entity")
    op.drop_index("ix_entity_headquarters_country_id", table_name="entity")
    op.drop_index("ix_entity_full_legal_name", table_name="entity")
    op.drop_table("entity")

    op.drop_index("ix_market_name", table_name="market")
    op.drop_table("market")

    op.drop_index("ix_sector_name", table_name="sector")
    op.drop_table("sector")

    op.drop_index("ix_country_name", table_name="country")
    op.drop_table("country")
