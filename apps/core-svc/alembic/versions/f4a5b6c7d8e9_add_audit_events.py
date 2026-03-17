# apps/core-svc/alembic/versions/20260131_add_audit_events.py
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# --- Alembic identifiers ---
revision = "f4a5b6c7d8e9"
down_revision = "e1f3a2b4c5d6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("actor", sa.Text(), nullable=True),
        sa.Column("actor_type", sa.Text(), nullable=True),
        sa.Column("source_service", sa.Text(), nullable=True),
        sa.Column("object_type", sa.Text(), nullable=True),
        sa.Column("object_id", sa.Text(), nullable=True),
        sa.Column("project_slug", sa.Text(), nullable=True),
        sa.Column("details_json", postgresql.JSONB, nullable=True),
        sa.Column("hash_prev", sa.Text(), nullable=True),
        sa.Column("hash", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_audit_events_created_at", "audit_events", ["created_at"], unique=False)
    op.create_index("ix_audit_events_event_type", "audit_events", ["event_type"], unique=False)
    op.create_index("ix_audit_events_project", "audit_events", ["project_slug"], unique=False)


def downgrade():
    op.drop_index("ix_audit_events_project", table_name="audit_events")
    op.drop_index("ix_audit_events_event_type", table_name="audit_events")
    op.drop_index("ix_audit_events_created_at", table_name="audit_events")
    op.drop_table("audit_events")
