"""Add control_reminder_log table for control reminder workflow

Stores which reminders have been sent per (entity, project, control, due_date)
so we send at most reminder_count reminders per cycle:
  - Reminder 1 at due_date - (reminder_count * reminder_day) days
  - Reminder 2 at due_date - ((reminder_count-1) * reminder_day) days
  - Reminder 3 at due_date - (1 * reminder_day) days
When evidence is finalized, cycle advances (due_date += frequency) and reminders stop.

Revision ID: 20260226_control_reminder_log
Revises: 20260225_staff_cert_control
Create Date: 2026-02-26

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260226_control_reminder_log"
down_revision = "20260225_staff_cert_control"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "control_reminder_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("entity_slug", sa.Text(), nullable=False),
        sa.Column("project_slug", sa.Text(), nullable=False),
        sa.Column("control_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("reminder_number", sa.Integer(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="control_reminder_log_pkey"),
        sa.UniqueConstraint(
            "entity_slug", "project_slug", "control_id", "due_date", "reminder_number",
            name="uq_control_reminder_log_sent",
        ),
    )
    op.create_index(
        "ix_control_reminder_log_lookup",
        "control_reminder_log",
        ["entity_slug", "project_slug", "control_id", "due_date", "reminder_number"],
    )
    op.create_index(
        "ix_control_reminder_log_sent",
        "control_reminder_log",
        ["sent_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_control_reminder_log_sent", table_name="control_reminder_log")
    op.drop_index("ix_control_reminder_log_lookup", table_name="control_reminder_log")
    op.drop_table("control_reminder_log")
