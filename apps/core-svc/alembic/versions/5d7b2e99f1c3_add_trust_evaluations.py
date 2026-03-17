"""add trust evaluation snapshots and audit

Revision ID: 5d7b2e99f1c3
Revises: 2f9c6b1a4d77
Create Date: 2026-01-24 01:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "5d7b2e99f1c3"
down_revision: Union[str, Sequence[str], None] = "2f9c6b1a4d77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trust_evaluations",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("project_slug", sa.Text, nullable=False),
        sa.Column("axis_scores", postgresql.JSONB, nullable=False),
        sa.Column("tol_level", sa.Text, nullable=False),
        sa.Column(
            "evaluated_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_trust_eval_project",
        "trust_evaluations",
        ["project_slug", "evaluated_at"],
        unique=False,
    )

    op.create_table(
        "trust_evaluation_audit",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("evaluation_id", sa.Text, nullable=False),
        sa.Column("action", sa.Text, nullable=False),
        sa.Column("actor", sa.Text, nullable=True),
        sa.Column(
            "at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("details_json", postgresql.JSONB, nullable=True),
    )
    op.create_index(
        "ix_trust_eval_audit_ev",
        "trust_evaluation_audit",
        ["evaluation_id", "at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_trust_eval_audit_ev", table_name="trust_evaluation_audit")
    op.drop_table("trust_evaluation_audit")
    op.drop_index("ix_trust_eval_project", table_name="trust_evaluations")
    op.drop_table("trust_evaluations")
