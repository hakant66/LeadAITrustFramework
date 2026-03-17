"""Rename country, primaryrole, sector, projects to entity_* prefixed names

Revision ID: rename_entity_tables_v1
Revises: entity_primaryrole_risk_v1
Create Date: 2026-02-12

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "rename_entity_tables_v1"
down_revision = "entity_primaryrole_risk_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Rename country -> entity_country
    op.rename_table("country", "entity_country")
    op.drop_index("ix_country_name", table_name="entity_country")
    op.create_index("ix_entity_country_name", "entity_country", ["name"], unique=True)
    
    # Update FK constraints referencing country
    op.drop_constraint("entity_headquarters_country_id_fkey", "entity", type_="foreignkey")
    op.create_foreign_key(
        "entity_headquarters_country_id_fkey",
        "entity",
        "entity_country",
        ["headquarters_country_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.drop_constraint("entity_region_country_id_fkey", "entity_region", type_="foreignkey")
    op.create_foreign_key(
        "entity_region_country_id_fkey",
        "entity_region",
        "entity_country",
        ["country_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 2. Rename primaryrole -> entity_primary_role
    op.rename_table("primaryrole", "entity_primary_role")
    op.drop_index("ix_primaryrole_name", table_name="entity_primary_role")
    op.create_index("ix_entity_primary_role_name", "entity_primary_role", ["name"], unique=True)
    
    # Update FK constraint referencing primaryrole
    op.drop_constraint("entity_primary_role_id_fkey", "entity", type_="foreignkey")
    op.create_foreign_key(
        "entity_primary_role_id_fkey",
        "entity",
        "entity_primary_role",
        ["primary_role_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 3. Rename sector -> entity_sector_lookup (to avoid conflict with junction table entity_sector)
    op.rename_table("sector", "entity_sector_lookup")
    op.drop_index("ix_sector_name", table_name="entity_sector_lookup")
    op.create_index("ix_entity_sector_lookup_name", "entity_sector_lookup", ["name"], unique=True)
    
    # Update FK constraint referencing sector
    op.drop_constraint("entity_sector_sector_id_fkey", "entity_sector", type_="foreignkey")
    op.create_foreign_key(
        "entity_sector_sector_id_fkey",
        "entity_sector",
        "entity_sector_lookup",
        ["sector_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 4. Rename projects -> entity_projects
    # PostgreSQL automatically updates FK constraints when table is renamed
    op.rename_table("projects", "entity_projects")
    # Update indexes
    op.drop_index("ix_projects_slug", table_name="entity_projects")
    op.create_index("ix_entity_projects_slug", "entity_projects", ["slug"], unique=True)


def downgrade() -> None:
    # Reverse order: projects, sector, primaryrole, country
    
    # 4. Revert projects (PostgreSQL auto-updates FK references)
    op.drop_index("ix_entity_projects_slug", table_name="entity_projects")
    op.rename_table("entity_projects", "projects")
    op.create_index("ix_projects_slug", "projects", ["slug"], unique=True)

    # 3. Revert sector
    op.drop_constraint("entity_sector_sector_id_fkey", "entity_sector", type_="foreignkey")
    op.create_foreign_key(
        "entity_sector_sector_id_fkey",
        "entity_sector",
        "sector",
        ["sector_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_index("ix_entity_sector_lookup_name", table_name="entity_sector_lookup")
    op.rename_table("entity_sector_lookup", "sector")
    op.create_index("ix_sector_name", "sector", ["name"], unique=True)

    # 2. Revert primaryrole
    op.drop_constraint("entity_primary_role_id_fkey", "entity", type_="foreignkey")
    op.create_foreign_key(
        "entity_primary_role_id_fkey",
        "entity",
        "primaryrole",
        ["primary_role_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.drop_index("ix_entity_primary_role_name", table_name="entity_primary_role")
    op.rename_table("entity_primary_role", "primaryrole")
    op.create_index("ix_primaryrole_name", "primaryrole", ["name"], unique=True)

    # 1. Revert country
    op.drop_constraint("entity_region_country_id_fkey", "entity_region", type_="foreignkey")
    op.create_foreign_key(
        "entity_region_country_id_fkey",
        "entity_region",
        "country",
        ["country_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint("entity_headquarters_country_id_fkey", "entity", type_="foreignkey")
    op.create_foreign_key(
        "entity_headquarters_country_id_fkey",
        "entity",
        "country",
        ["headquarters_country_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.drop_index("ix_entity_country_name", table_name="entity_country")
    op.rename_table("entity_country", "country")
    op.create_index("ix_country_name", "country", ["name"], unique=True)
