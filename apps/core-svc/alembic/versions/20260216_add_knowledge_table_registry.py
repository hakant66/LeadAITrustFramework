"""add knowledge table registry and entity settings

Revision ID: 20260216_add_knowledge_table_registry
Revises: 1f2a3b4c5d6f
Create Date: 2026-02-16 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260216_add_knowledge_table_registry"
down_revision = "1f2a3b4c5d6f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "knowledge_table_registry",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("table_key", sa.Text(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.UniqueConstraint("table_key", name="uq_knowledge_table_registry_key"),
    )

    op.create_table(
        "entity_knowledge_table_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("table_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.ForeignKeyConstraint(["entity_id"], ["entity.id"], name="entity_knowledge_table_settings_entity_id_fkey", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["table_id"], ["knowledge_table_registry.id"], name="entity_knowledge_table_settings_table_id_fkey", ondelete="CASCADE"),
        sa.UniqueConstraint("entity_id", "table_id", name="uq_entity_knowledge_table_settings"),
    )

    op.execute(
        """
        INSERT INTO knowledge_table_registry (id, table_key, label, description, is_active, created_at, updated_at)
        VALUES
          (gen_random_uuid(), 'kpi_definition', 'KPI Definition', 'KPI definitions catalog', true, NOW(), NOW()),
          (gen_random_uuid(), 'nistairmf', 'NIST AI RMF', 'NIST AI RMF requirements', true, NOW(), NOW()),
          (gen_random_uuid(), 'iso42001', 'ISO 42001', 'ISO 42001 requirements', true, NOW(), NOW()),
          (gen_random_uuid(), 'euaiact_requirements', 'EU AI Act Requirements', 'EU AI Act requirements list', true, NOW(), NOW()),
          (gen_random_uuid(), 'euaiact_requirement_scope', 'EU AI Act Requirement Scope', 'Role/risk mapping for EU AI Act', true, NOW(), NOW())
        """
    )

    op.execute(
        """
        INSERT INTO entity_knowledge_table_settings (id, entity_id, table_id, enabled, created_at, updated_at)
        SELECT gen_random_uuid(), e.id, r.id, true, NOW(), NOW()
        FROM entity e
        JOIN knowledge_table_registry r
          ON r.table_key IN (
            'kpi_definition',
            'nistairmf',
            'iso42001',
            'euaiact_requirements',
            'euaiact_requirement_scope'
          )
        """
    )


def downgrade() -> None:
    op.drop_table("entity_knowledge_table_settings")
    op.drop_table("knowledge_table_registry")
