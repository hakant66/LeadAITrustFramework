"""add EU AI Act and NIST AI RMF requirements fields

Revision ID: 20260221_add_policy_euai_nist_requirements
Revises: 20260220_backfill_entity_policy_register_fields_for_blueprint
Create Date: 2026-02-21
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260221_add_policy_euai_nist_requirements"
down_revision = "20260220_backfill_entity_policy_register_fields_for_blueprint"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    policy_cols = {col["name"] for col in inspector.get_columns("policies")}
    if "euaiact_requirements" not in policy_cols:
        op.add_column("policies", sa.Column("euaiact_requirements", sa.Text(), nullable=True))
    if "nistairmf_requirements" not in policy_cols:
        op.add_column("policies", sa.Column("nistairmf_requirements", sa.Text(), nullable=True))

    register_cols = {col["name"] for col in inspector.get_columns("entity_policy_register")}
    if "euaiact_requirements" not in register_cols:
        op.add_column(
            "entity_policy_register",
            sa.Column("euaiact_requirements", sa.Text(), nullable=True),
        )
    if "nistairmf_requirements" not in register_cols:
        op.add_column(
            "entity_policy_register",
            sa.Column("nistairmf_requirements", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    register_cols = {col["name"] for col in inspector.get_columns("entity_policy_register")}
    if "nistairmf_requirements" in register_cols:
        op.drop_column("entity_policy_register", "nistairmf_requirements")
    if "euaiact_requirements" in register_cols:
        op.drop_column("entity_policy_register", "euaiact_requirements")

    policy_cols = {col["name"] for col in inspector.get_columns("policies")}
    if "nistairmf_requirements" in policy_cols:
        op.drop_column("policies", "nistairmf_requirements")
    if "euaiact_requirements" in policy_cols:
        op.drop_column("policies", "euaiact_requirements")
