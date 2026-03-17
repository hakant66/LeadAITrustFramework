"""Add new sectors to entity_sector_lookup table

Revision ID: add_new_sectors_v1
Revises: rename_entity_tables_v1
Create Date: 2026-02-12

Adds new sectors: Automotive, Biometrics, Cybersecurity, Government & Public Service,
Hiring, Insurance, Justice, Law Enforcement, Migration & Border Control.
Also updates existing 'Public Services' to 'Government & Public Service' if present.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "add_new_sectors_v1"
down_revision = "rename_entity_tables_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Insert new sectors (using INSERT ... ON CONFLICT DO NOTHING to avoid duplicates)
    new_sectors = [
        "Automotive",
        "Biometrics",
        "Consumer Services",
        "Cybersecurity",
        "Government & Public Service",
        "Hiring",
        "Insurance",
        "Justice",
        "Law Enforcement",
        "Manufacturing",
        "Migration & Border Control",
        "Retail",
    ]
    
    # Insert each new sector
    for sector in new_sectors:
        op.execute(
            sa.text(
                "INSERT INTO entity_sector_lookup (name) VALUES (:name) ON CONFLICT (name) DO NOTHING"
            ).bindparams(name=sector)
        )
    
    # Update existing 'Public Services' to 'Government & Public Service' if it exists
    # First check if 'Public Services' exists and 'Government & Public Service' doesn't
    op.execute(
        sa.text("""
            UPDATE entity_sector_lookup
            SET name = 'Government & Public Service'
            WHERE name = 'Public Services'
            AND NOT EXISTS (
                SELECT 1 FROM entity_sector_lookup WHERE name = 'Government & Public Service'
            )
        """)
    )
    
    # Update entity_sector junction table to point to the new name
    op.execute(
        sa.text("""
            UPDATE entity_sector es
            SET sector_id = (
                SELECT id FROM entity_sector_lookup WHERE name = 'Government & Public Service'
            )
            WHERE es.sector_id IN (
                SELECT id FROM entity_sector_lookup WHERE name = 'Public Services'
            )
            AND EXISTS (
                SELECT 1 FROM entity_sector_lookup WHERE name = 'Government & Public Service'
            )
        """)
    )
    
    # Delete old 'Public Services' entry if it was replaced
    op.execute(
        sa.text("""
            DELETE FROM entity_sector_lookup
            WHERE name = 'Public Services'
            AND EXISTS (
                SELECT 1 FROM entity_sector_lookup WHERE name = 'Government & Public Service'
            )
        """)
    )


def downgrade() -> None:
    # Reverse: Update 'Government & Public Service' back to 'Public Services' if needed
    op.execute(
        sa.text("""
            UPDATE entity_sector_lookup
            SET name = 'Public Services'
            WHERE name = 'Government & Public Service'
            AND NOT EXISTS (
                SELECT 1 FROM entity_sector_lookup WHERE name = 'Public Services'
            )
        """)
    )
    
    # Update entity_sector junction table
    op.execute(
        sa.text("""
            UPDATE entity_sector es
            SET sector_id = (
                SELECT id FROM entity_sector_lookup WHERE name = 'Public Services'
            )
            WHERE es.sector_id IN (
                SELECT id FROM entity_sector_lookup WHERE name = 'Government & Public Service'
            )
            AND EXISTS (
                SELECT 1 FROM entity_sector_lookup WHERE name = 'Public Services'
            )
        """)
    )
    
    # Delete new sectors (only if no entities reference them)
    new_sectors = [
        "Automotive",
        "Biometrics",
        "Consumer Services",
        "Cybersecurity",
        "Government & Public Service",
        "Hiring",
        "Insurance",
        "Justice",
        "Law Enforcement",
        "Manufacturing",
        "Migration & Border Control",
        "Retail",
    ]
    
    for sector in new_sectors:
        op.execute(
            sa.text("""
                DELETE FROM entity_sector_lookup
                WHERE name = :name
                AND NOT EXISTS (
                    SELECT 1 FROM entity_sector WHERE sector_id = entity_sector_lookup.id
                )
            """).bindparams(name=sector)
        )
