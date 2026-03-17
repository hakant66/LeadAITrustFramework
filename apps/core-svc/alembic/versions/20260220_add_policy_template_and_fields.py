"""add policy template table and policy fields

Revision ID: 20260220_add_policy_template_and_fields
Revises: 20260219_add_locale_translation_tables
Create Date: 2026-02-20
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260220_add_policy_template_and_fields"
down_revision = "20260219_add_locale_translation_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    has_policy_template = "policy_template" in tables
    if not has_policy_template:
        op.create_table(
            "policy_template",
            sa.Column("id", sa.Text(), primary_key=True),
            sa.Column("document_pdf", postgresql.BYTEA, nullable=True),
            sa.Column("class", sa.Text(), nullable=True),
            sa.Column("version", sa.Text(), nullable=True),
            sa.Column("effective_date", postgresql.TIMESTAMP(timezone=True), nullable=True),
            sa.Column("owner", sa.Text(), nullable=True),
            sa.Column("next_review", postgresql.TIMESTAMP(timezone=True), nullable=True),
            sa.Column("approver", sa.Text(), nullable=True),
            sa.Column("status", sa.Text(), nullable=True),
            sa.Column("last_update", postgresql.TIMESTAMP(timezone=True), nullable=True),
        )
        has_policy_template = True

    if "policies" in tables:
        columns = {col["name"] for col in inspector.get_columns("policies")}
        if "iso42001_requirement" not in columns:
            op.add_column("policies", sa.Column("iso42001_requirement", sa.Text(), nullable=True))
        if "comment" not in columns:
            op.add_column("policies", sa.Column("comment", sa.Text(), nullable=True))
        if "action" not in columns:
            op.add_column("policies", sa.Column("action", sa.Text(), nullable=True))
        if "template" not in columns:
            op.add_column("policies", sa.Column("template", sa.Text(), nullable=True))
            columns.add("template")

        if "template" in columns and has_policy_template:
            fk_names = {fk["name"] for fk in inspector.get_foreign_keys("policies")}
            if "fk_policies_template" not in fk_names:
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
            op.drop_column("policies", "template")
        if "action" in columns:
            op.drop_column("policies", "action")
        if "comment" in columns:
            op.drop_column("policies", "comment")
        if "iso42001_requirement" in columns:
            op.drop_column("policies", "iso42001_requirement")

    if "policy_template" in tables:
        op.drop_table("policy_template")
