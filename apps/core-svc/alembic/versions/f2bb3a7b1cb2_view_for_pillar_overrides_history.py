"""view for pillar_overrides_history

Revision ID: f2bb3a7b1cb2
Revises: 12d9955f23eb
Create Date: 2025-11-06 21:07:51.081882

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2bb3a7b1cb2'
down_revision: Union[str, Sequence[str], None] = '12d9955f23eb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Creates/updates the view that joins history to projects by project_id -> projects.id
    op.execute("""
    CREATE OR REPLACE VIEW public.v_pillar_overrides_history_enriched AS
    SELECT
      h.*,
      p.slug  AS project_slug,
      p.name  AS project_name
    FROM public.pillar_overrides_history h
    LEFT JOIN public.projects p
      ON p.id = h.project_id;
    """)


def downgrade():
    # Remove only this view
    op.execute("DROP VIEW IF EXISTS public.v_pillar_overrides_history_enriched;")
