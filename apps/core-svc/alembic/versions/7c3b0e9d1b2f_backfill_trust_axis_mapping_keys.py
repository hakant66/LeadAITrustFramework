"""backfill trust axis mapping keys

Revision ID: 7c3b0e9d1b2f
Revises: 5d7b2e99f1c3
Create Date: 2026-01-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "7c3b0e9d1b2f"
down_revision: Union[str, Sequence[str], None] = "5d7b2e99f1c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM trust_axis_pillar_map
        WHERE pillar_key IN (
          'governance',
          'pre_gtm',
          'cra_drift',
          'data',
          'transparency',
          'human'
        );
        """
    )

    op.execute(
        """
        INSERT INTO trust_axis_pillar_map (pillar_key, axis_key, notes)
        VALUES
          ('GOV', 'compliance', 'Policy, governance, and oversight controls.'),
          ('CRA', 'compliance', 'Regulatory alignment and drift monitoring.'),
          ('PTC', 'compliance', 'Certification readiness and pre-release assurance.'),
          ('DATA', 'provenance', 'Data sourcing, quality, and lineage controls.'),
          ('XAI', 'safety', 'Transparency, explainability, and auditability.'),
          ('HCR', 'safety', 'Human oversight and resilience controls.')
        ON CONFLICT (pillar_key)
        DO UPDATE SET
          axis_key = EXCLUDED.axis_key,
          notes = EXCLUDED.notes;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM trust_axis_pillar_map
        WHERE pillar_key IN ('GOV', 'CRA', 'PTC', 'DATA', 'XAI', 'HCR');
        """
    )
