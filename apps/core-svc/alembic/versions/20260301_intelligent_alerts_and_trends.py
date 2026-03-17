"""Intelligent alerts and trends: alert_rules and trend_alerts tables

Revision ID: 20260301_intelligent_alerts
Revises: 20260229_board_level_report_professional
Create Date: 2026-03-01

- alert_rules: configurable rules (threshold / trend_drop) per entity/project
- trend_alerts: generated alerts when a rule fires
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260301_intelligent_alerts"
down_revision = "20260224_add_user_profile_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "alert_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_slug", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("rule_type", sa.Text(), nullable=False),
        sa.Column("metric", sa.Text(), nullable=False),
        sa.Column("threshold_pct", sa.Float(), nullable=False),
        sa.Column("window_days", sa.Integer(), nullable=True),
        sa.Column("severity", sa.Text(), nullable=False, server_default="medium"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.ForeignKeyConstraint(["entity_id"], ["entity.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_alert_rules_entity_id", "alert_rules", ["entity_id"])
    op.create_index("ix_alert_rules_enabled", "alert_rules", ["enabled"])

    op.create_table(
        "trend_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_slug", sa.Text(), nullable=False),
        sa.Column("rule_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("alert_type", sa.Text(), nullable=False),
        sa.Column("severity", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("metric_value_before", sa.Float(), nullable=True),
        sa.Column("metric_value_after", sa.Float(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("details_json", postgresql.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(["entity_id"], ["entity.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["rule_id"], ["alert_rules.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_trend_alerts_entity_id", "trend_alerts", ["entity_id"])
    op.create_index("ix_trend_alerts_project_slug", "trend_alerts", ["project_slug"])
    op.create_index("ix_trend_alerts_status", "trend_alerts", ["status"])
    op.create_index("ix_trend_alerts_created_at", "trend_alerts", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_trend_alerts_created_at", table_name="trend_alerts")
    op.drop_index("ix_trend_alerts_status", table_name="trend_alerts")
    op.drop_index("ix_trend_alerts_project_slug", table_name="trend_alerts")
    op.drop_index("ix_trend_alerts_entity_id", table_name="trend_alerts")
    op.drop_table("trend_alerts")
    op.drop_index("ix_alert_rules_enabled", table_name="alert_rules")
    op.drop_index("ix_alert_rules_entity_id", table_name="alert_rules")
    op.drop_table("alert_rules")
