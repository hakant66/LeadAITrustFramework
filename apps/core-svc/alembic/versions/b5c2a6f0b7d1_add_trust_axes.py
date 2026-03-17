"""add trust axes to controls and pillar mapping

Revision ID: b5c2a6f0b7d1
Revises: 6cadd6546779
Create Date: 2026-01-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b5c2a6f0b7d1"
down_revision: Union[str, Sequence[str], None] = "6cadd6546779"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trust_axis') THEN
            CREATE TYPE trust_axis AS ENUM ('safety', 'compliance', 'provenance');
          END IF;
        END
        $$;
        """
    )

    axis_enum = postgresql.ENUM(
        "safety",
        "compliance",
        "provenance",
        name="trust_axis",
        create_type=False,
    )

    op.add_column("controls", sa.Column("axis_key", axis_enum, nullable=True))

    op.create_table(
        "trust_axis_pillar_map",
        sa.Column("pillar_key", sa.String(length=60), primary_key=True),
        sa.Column("axis_key", axis_enum, nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    op.bulk_insert(
        sa.table(
            "trust_axis_pillar_map",
            sa.column("pillar_key", sa.String),
            sa.column("axis_key", axis_enum),
            sa.column("notes", sa.Text),
        ),
        [
            {
                "pillar_key": "governance",
                "axis_key": "compliance",
                "notes": "Policy, governance, and oversight controls.",
            },
            {
                "pillar_key": "pre_gtm",
                "axis_key": "compliance",
                "notes": "Certification readiness and pre-release assurance.",
            },
            {
                "pillar_key": "cra_drift",
                "axis_key": "compliance",
                "notes": "Regulatory alignment and drift monitoring.",
            },
            {
                "pillar_key": "data",
                "axis_key": "provenance",
                "notes": "Data sourcing, quality, and lineage controls.",
            },
            {
                "pillar_key": "transparency",
                "axis_key": "safety",
                "notes": "Transparency, explainability, and auditability.",
            },
            {
                "pillar_key": "human",
                "axis_key": "safety",
                "notes": "Human oversight and resilience controls.",
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("trust_axis_pillar_map")
    op.drop_column("controls", "axis_key")

    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trust_axis') THEN
            DROP TYPE trust_axis;
          END IF;
        END
        $$;
        """
    )
