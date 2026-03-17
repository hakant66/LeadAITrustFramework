"""switch policy_template id to UUID

Revision ID: 20260220_policy_template_uuid
Revises: 20260220_add_policy_template_and_fields
Create Date: 2026-02-20
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260220_policy_template_uuid"
down_revision = "20260220_add_policy_template_and_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "policies" in tables:
        fk_names = {fk["name"] for fk in inspector.get_foreign_keys("policies")}
        if "fk_policies_template" in fk_names:
            op.drop_constraint("fk_policies_template", "policies", type_="foreignkey")

    if "policy_template" in tables:
        op.execute(
            "ALTER TABLE policy_template ALTER COLUMN id TYPE uuid USING id::uuid"
        )

    if "policies" in tables:
        columns = {col["name"] for col in inspector.get_columns("policies")}
        if "template" in columns:
            op.execute(
                "ALTER TABLE policies ALTER COLUMN template TYPE uuid USING template::uuid"
            )
            op.create_foreign_key(
                "fk_policies_template",
                "policies",
                "policy_template",
                ["template"],
                ["id"],
                ondelete="SET NULL",
            )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "policies" in tables:
        fk_names = {fk["name"] for fk in inspector.get_foreign_keys("policies")}
        if "fk_policies_template" in fk_names:
            op.drop_constraint("fk_policies_template", "policies", type_="foreignkey")

        columns = {col["name"] for col in inspector.get_columns("policies")}
        if "template" in columns:
            op.execute(
                "ALTER TABLE policies ALTER COLUMN template TYPE text USING template::text"
            )

    if "policy_template" in tables:
        op.execute(
            "ALTER TABLE policy_template ALTER COLUMN id TYPE text USING id::text"
        )

