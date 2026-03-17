"""Rename market to primaryrole; add entity_risk_class, entity.risk_classification_id, entity.decision_trace

Revision ID: entity_primaryrole_risk_v1
Revises: entity_tables_v1
Create Date: 2026-02-12

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "entity_primaryrole_risk_v1"
down_revision = "entity_tables_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Rename table market -> primaryrole
    op.rename_table("market", "primaryrole")
    op.drop_index("ix_market_name", table_name="primaryrole")
    op.create_index("ix_primaryrole_name", "primaryrole", ["name"], unique=True)

    # 2. Rename entity.market_role_id -> primary_role_id and update FK to primaryrole
    op.drop_constraint("entity_market_role_id_fkey", "entity", type_="foreignkey")
    op.alter_column(
        "entity",
        "market_role_id",
        new_column_name="primary_role_id",
        existing_type=postgresql.UUID(as_uuid=True),
    )
    op.create_foreign_key(
        "entity_primary_role_id_fkey",
        "entity",
        "primaryrole",
        ["primary_role_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.drop_index("ix_entity_market_role_id", table_name="entity")
    op.create_index("ix_entity_primary_role_id", "entity", ["primary_role_id"])

    # 3. Create entity_risk_class lookup (e.g. High-Risk, Non-High-Risk, Prohibited AI, Out of scope)
    op.create_table(
        "entity_risk_class",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_entity_risk_class_name", "entity_risk_class", ["name"], unique=True)

    # 4. Add entity.risk_classification_id and entity.decision_trace
    op.add_column(
        "entity",
        sa.Column("risk_classification_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("entity", sa.Column("decision_trace", sa.Text(), nullable=True))
    op.create_foreign_key(
        "entity_risk_classification_id_fkey",
        "entity",
        "entity_risk_class",
        ["risk_classification_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_entity_risk_classification_id", "entity", ["risk_classification_id"])


def downgrade() -> None:
    op.drop_index("ix_entity_risk_classification_id", table_name="entity")
    op.drop_constraint("entity_risk_classification_id_fkey", "entity", type_="foreignkey")
    op.drop_column("entity", "decision_trace")
    op.drop_column("entity", "risk_classification_id")

    op.drop_index("ix_entity_risk_class_name", table_name="entity_risk_class")
    op.drop_table("entity_risk_class")

    op.drop_index("ix_entity_primary_role_id", table_name="entity")
    op.drop_constraint("entity_primary_role_id_fkey", "entity", type_="foreignkey")
    op.alter_column(
        "entity",
        "primary_role_id",
        new_column_name="market_role_id",
        existing_type=postgresql.UUID(as_uuid=True),
    )

    op.drop_index("ix_primaryrole_name", table_name="primaryrole")
    op.rename_table("primaryrole", "market")
    op.create_foreign_key(
        "entity_market_role_id_fkey",
        "entity",
        "market",
        ["market_role_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_entity_market_role_id", "entity", ["market_role_id"])
    op.create_index("ix_market_name", "market", ["name"], unique=True)
