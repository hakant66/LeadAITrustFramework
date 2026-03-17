"""add model card tables and langfuse fields

Revision ID: 20260224_add_model_cards_and_langfuse
Revises: 20260224_ai_system_registry_helper
Create Date: 2026-02-24
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260224_add_model_cards_and_langfuse"
down_revision = "20260224_ai_system_registry_helper"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ai_system_registry", sa.Column("langfuse_project_id", sa.Text(), nullable=True))
    op.add_column("ai_system_registry", sa.Column("langfuse_base_url", sa.Text(), nullable=True))

    op.create_table(
        "model_card",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("system_id", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.Text(), nullable=False, server_default="draft"),
        sa.Column("summary_md", sa.Text(), nullable=True),
        sa.Column("limitations", sa.Text(), nullable=True),
        sa.Column("out_of_scope", sa.Text(), nullable=True),
        sa.Column("review_cadence", sa.Text(), nullable=True),
        sa.Column("approved_by", sa.Text(), nullable=True),
        sa.Column("approved_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["system_id"], ["ai_system_registry.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_model_card_system_id", "model_card", ["system_id"], unique=False)
    op.create_index("ix_model_card_status", "model_card", ["status"], unique=False)

    op.create_table(
        "model_card_evidence",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("model_card_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.Text(), nullable=False, server_default="langfuse"),
        sa.Column("metric_key", sa.Text(), nullable=False),
        sa.Column("metric_value", postgresql.JSONB, nullable=False),
        sa.Column(
            "last_seen_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["model_card_id"], ["model_card.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("model_card_id", "source", "metric_key", name="uq_model_card_evidence_metric"),
    )
    op.create_index(
        "ix_model_card_evidence_model_card_id",
        "model_card_evidence",
        ["model_card_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_model_card_evidence_model_card_id", table_name="model_card_evidence")
    op.drop_table("model_card_evidence")
    op.drop_index("ix_model_card_status", table_name="model_card")
    op.drop_index("ix_model_card_system_id", table_name="model_card")
    op.drop_table("model_card")
    op.drop_column("ai_system_registry", "langfuse_base_url")
    op.drop_column("ai_system_registry", "langfuse_project_id")
