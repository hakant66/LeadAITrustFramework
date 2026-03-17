"""Add entity KPI/control override tables

Revision ID: add_entity_override_tables_v1
Revises: 27f85b05996e
Create Date: 2026-02-13

Adds per-entity override tables for KPIs and Controls. These are intentionally
small tables that store only override fields, not full copies of the base
catalog tables.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "add_entity_override_tables_v1"
down_revision = "27f85b05996e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- entity_kpi_overrides ---
    op.create_table(
        "entity_kpi_overrides",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kpi_id", sa.Text(), nullable=False),
        sa.Column("name_override", sa.Text(), nullable=True),
        sa.Column("description_override", sa.Text(), nullable=True),
        sa.Column("unit_override", sa.Text(), nullable=True),
        sa.Column("weight_override", sa.Float(), nullable=True),
        sa.Column("min_ideal_override", sa.Float(), nullable=True),
        sa.Column("max_ideal_override", sa.Float(), nullable=True),
        sa.Column("invert_override", sa.Boolean(), nullable=True),
        sa.Column("example_override", sa.Text(), nullable=True),
        sa.Column("scoring_override_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status_override", sa.Text(), nullable=True),
        sa.Column("locale_override", sa.String(10), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_id", "kpi_id", name="uq_entity_kpi_overrides_entity_kpi"),
        sa.ForeignKeyConstraint(["entity_id"], ["entity.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["kpi_id"], ["kpis.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_entity_kpi_overrides_entity_id", "entity_kpi_overrides", ["entity_id"])
    op.create_index("ix_entity_kpi_overrides_kpi_id", "entity_kpi_overrides", ["kpi_id"])

    # --- entity_control_overrides ---
    op.create_table(
        "entity_control_overrides",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("control_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name_override", sa.Text(), nullable=True),
        sa.Column("description_override", sa.Text(), nullable=True),
        sa.Column("pillar_override", sa.Text(), nullable=True),
        sa.Column("unit_override", sa.Text(), nullable=True),
        sa.Column("norm_min_override", sa.Float(), nullable=True),
        sa.Column("norm_max_override", sa.Float(), nullable=True),
        sa.Column("higher_is_better_override", sa.Boolean(), nullable=True),
        sa.Column("weight_override", sa.Float(), nullable=True),
        sa.Column(
            "axis_key_override",
            postgresql.ENUM(
                "safety",
                "compliance",
                "provenance",
                name="trust_axis",
                create_type=False,
            ),
            nullable=True,
        ),
        sa.Column("target_text_override", sa.Text(), nullable=True),
        sa.Column("target_numeric_override", sa.Integer(), nullable=True),
        sa.Column("evidence_source_override", sa.Text(), nullable=True),
        sa.Column("owner_role_override", sa.Text(), nullable=True),
        sa.Column("frequency_override", sa.Integer(), nullable=True),
        sa.Column("notes_override", sa.Text(), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_id", "control_id", name="uq_entity_control_overrides_entity_control"),
        sa.ForeignKeyConstraint(["entity_id"], ["entity.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["control_id"], ["controls.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_entity_control_overrides_entity_id", "entity_control_overrides", ["entity_id"])
    op.create_index("ix_entity_control_overrides_control_id", "entity_control_overrides", ["control_id"])


def downgrade() -> None:
    op.drop_index("ix_entity_control_overrides_control_id", table_name="entity_control_overrides")
    op.drop_index("ix_entity_control_overrides_entity_id", table_name="entity_control_overrides")
    op.drop_table("entity_control_overrides")

    op.drop_index("ix_entity_kpi_overrides_kpi_id", table_name="entity_kpi_overrides")
    op.drop_index("ix_entity_kpi_overrides_entity_id", table_name="entity_kpi_overrides")
    op.drop_table("entity_kpi_overrides")
