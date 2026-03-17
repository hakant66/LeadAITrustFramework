# apps/core-svc/alembic/versions/20251107_add_evidence_tables.py
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# --- Alembic identifiers ---
revision = "be5a84fbe3e5"
down_revision = "f2bb3a7b1cb2"   # <- set to your actual previous revision
branch_labels = None
depends_on = None


def upgrade():
    # evidence
    op.create_table(
        "evidence",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("project_slug", sa.Text, nullable=False),
        sa.Column("control_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("mime", sa.Text, nullable=True),
        sa.Column("size_bytes", sa.BigInteger, nullable=True),
        sa.Column("sha256", sa.CHAR(64), nullable=True),
        sa.Column("uri", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default=sa.text("'pending'")),
        sa.Column("created_by", sa.Text, nullable=True),
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
        sa.ForeignKeyConstraint(
            ["project_slug", "control_id"],
            ["control_values.project_slug", "control_values.control_id"],
            ondelete="CASCADE",
            name="fk_evidence_control_values",
        ),
    )

    op.create_index(
        "ix_evidence_proj_control", "evidence", ["project_slug", "control_id"], unique=False
    )
    op.create_index("ix_evidence_sha", "evidence", ["sha256"], unique=False)

    # evidence_audit
    op.create_table(
        "evidence_audit",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "evidence_id",
            sa.BigInteger,
            sa.ForeignKey("evidence.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.Text, nullable=False),  # created/uploaded/verified/replaced/deleted/downloaded
        sa.Column("actor", sa.Text, nullable=True),    # user id/email or system
        sa.Column(
            "at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("details_json", postgresql.JSONB, nullable=True),
    )

    op.create_index(
        "ix_evaudit_ev_at", "evidence_audit", ["evidence_id", "at"], unique=False
    )
    op.create_index(
        "ix_evaudit_action_at", "evidence_audit", ["action", "at"], unique=False
    )


def downgrade():
    op.drop_index("ix_evaudit_action_at", table_name="evidence_audit")
    op.drop_index("ix_evaudit_ev_at", table_name="evidence_audit")
    op.drop_table("evidence_audit")

    op.drop_index("ix_evidence_sha", table_name="evidence")
    op.drop_index("ix_evidence_proj_control", table_name="evidence")
    op.drop_table("evidence")
