# apps/core-svc/alembic/versions/20260130_add_evidence_notes_fields.py
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# --- Alembic identifiers ---
revision = "c3f2a1b9d7e4"
down_revision = "b7e1a9c2d3f4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("evidence", sa.Column("last_comment", sa.Text(), nullable=True))
    op.add_column("evidence", sa.Column("last_action", sa.Text(), nullable=True))
    op.add_column("evidence", sa.Column("attachment_name", sa.Text(), nullable=True))
    op.add_column("evidence", sa.Column("attachment_uri", sa.Text(), nullable=True))
    op.add_column("evidence", sa.Column("attachment_mime", sa.Text(), nullable=True))
    op.add_column("evidence", sa.Column("attachment_size", sa.BigInteger(), nullable=True))
    op.add_column("evidence", sa.Column("attachment_sha256", sa.CHAR(64), nullable=True))
    op.add_column("evidence", sa.Column("updated_by", sa.Text(), nullable=True))
    op.add_column(
        "evidence",
        sa.Column(
            "last_update",
            postgresql.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("evidence", "last_update")
    op.drop_column("evidence", "updated_by")
    op.drop_column("evidence", "attachment_sha256")
    op.drop_column("evidence", "attachment_size")
    op.drop_column("evidence", "attachment_mime")
    op.drop_column("evidence", "attachment_uri")
    op.drop_column("evidence", "attachment_name")
    op.drop_column("evidence", "last_action")
    op.drop_column("evidence", "last_comment")
