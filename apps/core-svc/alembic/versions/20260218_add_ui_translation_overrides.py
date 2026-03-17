"""add ui translation overrides table

Revision ID: 20260218_add_ui_translation_overrides
Revises: 20260218_add_ai_system_registry_governance_fields
Create Date: 2026-02-18
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260218_add_ui_translation_overrides"
down_revision = "20260218_add_ai_system_registry_governance_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ui_translation_overrides",
        sa.Column("english_text", sa.Text(), nullable=False),
        sa.Column("locale", sa.String(length=10), nullable=False),
        sa.Column("translated_text", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint(
            "english_text",
            "locale",
            name="ui_translation_overrides_pkey",
        ),
    )
    op.create_index(
        "ix_ui_translation_overrides_locale",
        "ui_translation_overrides",
        ["locale"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_ui_translation_overrides_locale",
        table_name="ui_translation_overrides",
    )
    op.drop_table("ui_translation_overrides")
