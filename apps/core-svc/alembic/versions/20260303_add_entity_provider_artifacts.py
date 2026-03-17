"""Add entity_provider_artifacts table

Revision ID: 20260303_add_entity_provider_artifacts
Revises: 20260303_backfill_control_values_from_controls
Create Date: 2026-03-03 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260303_add_entity_provider_artifacts"
down_revision = "20260303_backfill_control_values_from_controls"
branch_labels = None
depends_on = None


PROVIDER_KEYS = ("openai", "anthropic", "google", "meta")


def upgrade() -> None:
    op.create_table(
        "entity_provider_artifacts",
        sa.Column("id", sa.String(), primary_key=True, nullable=False),
        sa.Column(
            "entity_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("entity.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider_key", sa.String(40), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("uri", sa.Text(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=True),
        sa.Column("type", sa.String(40), nullable=True),
        sa.Column("status", sa.String(20), nullable=True),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            f"provider_key IN {PROVIDER_KEYS}",
            name="ck_entity_provider_artifacts_provider_key",
        ),
    )
    op.create_index(
        "ix_entity_provider_artifacts_entity_id",
        "entity_provider_artifacts",
        ["entity_id"],
    )
    op.create_index(
        "ix_entity_provider_artifacts_provider_key",
        "entity_provider_artifacts",
        ["provider_key"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_entity_provider_artifacts_provider_key",
        table_name="entity_provider_artifacts",
    )
    op.drop_index(
        "ix_entity_provider_artifacts_entity_id",
        table_name="entity_provider_artifacts",
    )
    op.drop_table("entity_provider_artifacts")
