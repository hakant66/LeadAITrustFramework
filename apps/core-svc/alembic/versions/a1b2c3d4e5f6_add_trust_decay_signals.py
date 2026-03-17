"""add trust monitoring signals and decay events

Revision ID: a1b2c3d4e5f6
Revises: dc53c49f38cb
Create Date: 2026-01-27 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "dc53c49f38cb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    axis_enum = postgresql.ENUM(
        "safety",
        "compliance",
        "provenance",
        name="trust_axis",
        create_type=False,
    )

    op.create_table(
        "trust_monitoring_signals",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("project_slug", sa.String(length=120), nullable=False),
        sa.Column("signal_type", sa.String(length=60), nullable=False),
        sa.Column("axis_key", axis_enum, nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("details_json", postgresql.JSONB, nullable=True),
        sa.Column("source", sa.String(length=120), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("processed_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("resolved_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_trust_signals_project",
        "trust_monitoring_signals",
        ["project_slug", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_trust_signals_status",
        "trust_monitoring_signals",
        ["status"],
        unique=False,
    )

    op.create_table(
        "trust_decay_events",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("signal_id", sa.Text, nullable=False),
        sa.Column("project_slug", sa.String(length=120), nullable=False),
        sa.Column("axis_key", axis_enum, nullable=False),
        sa.Column("rule_key", sa.String(length=80), nullable=False),
        sa.Column("decay_delta", sa.Float, nullable=True),
        sa.Column("previous_score", sa.Float, nullable=True),
        sa.Column("new_score", sa.Float, nullable=True),
        sa.Column(
            "applied_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "reversible",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("details_json", postgresql.JSONB, nullable=True),
        sa.ForeignKeyConstraint(
            ["signal_id"],
            ["trust_monitoring_signals.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_trust_decay_project",
        "trust_decay_events",
        ["project_slug", "applied_at"],
        unique=False,
    )
    op.create_index(
        "ix_trust_decay_signal",
        "trust_decay_events",
        ["signal_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_trust_decay_signal", table_name="trust_decay_events")
    op.drop_index("ix_trust_decay_project", table_name="trust_decay_events")
    op.drop_table("trust_decay_events")
    op.drop_index("ix_trust_signals_status", table_name="trust_monitoring_signals")
    op.drop_index("ix_trust_signals_project", table_name="trust_monitoring_signals")
    op.drop_table("trust_monitoring_signals")
