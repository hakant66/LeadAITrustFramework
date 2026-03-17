"""rename eu_ai_act_* columns and add euaiact_section

Revision ID: b3c4d5e6f7a8
Revises: f4a1c2b3d4e5
Create Date: 2026-02-04 18:02:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, Sequence[str], None] = "f4a1c2b3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _upgrade_table(table_name: str) -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = '{table_name}'
              AND column_name = 'eu_ai_act_clause'
          ) THEN
            ALTER TABLE public.{table_name} RENAME COLUMN eu_ai_act_clause TO euaiact_clause;
          END IF;

          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = '{table_name}'
              AND column_name = 'eu_ai_act_chapter'
          ) THEN
            ALTER TABLE public.{table_name} RENAME COLUMN eu_ai_act_chapter TO euaiact_chapter;
          END IF;

          IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = '{table_name}'
              AND column_name = 'euaiact_section'
          ) THEN
            ALTER TABLE public.{table_name} ADD COLUMN euaiact_section text;
          END IF;
        END $$;
        """
    )


def _downgrade_table(table_name: str) -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = '{table_name}'
              AND column_name = 'euaiact_clause'
          ) THEN
            ALTER TABLE public.{table_name} RENAME COLUMN euaiact_clause TO eu_ai_act_clause;
          END IF;

          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = '{table_name}'
              AND column_name = 'euaiact_chapter'
          ) THEN
            ALTER TABLE public.{table_name} RENAME COLUMN euaiact_chapter TO eu_ai_act_chapter;
          END IF;

          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = '{table_name}'
              AND column_name = 'euaiact_section'
          ) THEN
            ALTER TABLE public.{table_name} DROP COLUMN euaiact_section;
          END IF;
        END $$;
        """
    )


def upgrade() -> None:
    _upgrade_table("kpi_definition")
    _upgrade_table("kpi_def")


def downgrade() -> None:
    _downgrade_table("kpi_def")
    _downgrade_table("kpi_definition")
