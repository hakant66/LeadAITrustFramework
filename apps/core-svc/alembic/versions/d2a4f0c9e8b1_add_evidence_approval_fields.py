# apps/core-svc/alembic/versions/20260130_add_evidence_approval_fields.py
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# --- Alembic identifiers ---
revision = "d2a4f0c9e8b1"
down_revision = "c3f2a1b9d7e4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "evidence",
        sa.Column(
            "approval_status",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
    )
    op.add_column("evidence", sa.Column("approved_by", sa.Text(), nullable=True))
    op.add_column(
        "evidence",
        sa.Column(
            "approved_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )
    op.execute(
        """
        UPDATE evidence
        SET approval_status = 'approved',
            approved_by = 'system',
            approved_at = NOW()
        WHERE approval_status = 'pending'
          AND status IN ('uploaded', 'ready')
        """
    )


def downgrade():
    op.drop_column("evidence", "approved_at")
    op.drop_column("evidence", "approved_by")
    op.drop_column("evidence", "approval_status")
