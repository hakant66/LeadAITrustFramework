"""add provenance manifest facts and evaluations

Revision ID: 9f1b2c3d4e5f
Revises: 8a2f6f4e1c9d
Create Date: 2026-01-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "9f1b2c3d4e5f"
down_revision: Union[str, Sequence[str], None] = "8a2f6f4e1c9d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "provenance_manifest_facts",
        sa.Column("project_slug", sa.String(length=120), primary_key=True),
        sa.Column("manifest_json", postgresql.JSONB, nullable=False),
        sa.Column("manifest_hash", sa.CHAR(64), nullable=False),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_prov_manifest_project",
        "provenance_manifest_facts",
        ["project_slug"],
        unique=True,
    )

    op.create_table(
        "provenance_evaluations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_slug", sa.String(length=120), nullable=False),
        sa.Column("overall_level", sa.String(length=8), nullable=False),
        sa.Column("overall_score", sa.Integer(), nullable=False),
        sa.Column("overall_score_pct", sa.Float(), nullable=False),
        sa.Column("fields_json", postgresql.JSONB, nullable=False),
        sa.Column("gates_json", postgresql.JSONB, nullable=False),
        sa.Column("manifest_hash", sa.CHAR(64), nullable=False),
        sa.Column("rules_version", sa.String(length=40), nullable=True),
        sa.Column("rules_hash", sa.CHAR(64), nullable=True),
        sa.Column(
            "evaluated_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_prov_eval_project",
        "provenance_evaluations",
        ["project_slug", "evaluated_at"],
        unique=False,
    )
    op.create_index(
        "ix_prov_eval_manifest_hash",
        "provenance_evaluations",
        ["manifest_hash"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_prov_eval_manifest_hash", table_name="provenance_evaluations")
    op.drop_index("ix_prov_eval_project", table_name="provenance_evaluations")
    op.drop_table("provenance_evaluations")

    op.drop_index("ix_prov_manifest_project", table_name="provenance_manifest_facts")
    op.drop_table("provenance_manifest_facts")
