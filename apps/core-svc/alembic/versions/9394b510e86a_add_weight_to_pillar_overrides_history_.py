"""add weight to pillar_overrides(+history) and update audit trigger

Revision ID: 9394b510e86a
Revises: 2470ecbec42a
Create Date: 2025-11-08 20:31:40.255771

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# ---- Alembic identifiers ----
revision = "9394b510e86a"
down_revision = "2470ecbec42a"
branch_labels = None
depends_on = None


def upgrade():
    # 1) Add columns (nullable-first)
    op.add_column("pillar_overrides",
                  sa.Column("weight", sa.FLOAT(precision=53), nullable=True),
                  schema="public")
    op.add_column("pillar_overrides_history",
                  sa.Column("weight", sa.FLOAT(precision=53), nullable=True),
                  schema="public")

    # 2) Disable trigger so backfill won't call the old function
    op.execute("ALTER TABLE public.pillar_overrides DISABLE TRIGGER audit_pillar_overrides;")

    # 3) Backfill live table from pillars
    op.execute("""
        UPDATE public.pillar_overrides po
        SET weight = p.weight
        FROM public.pillars p
        WHERE p.key = po.pillar_key
          AND po.weight IS NULL;
    """)

    # 4) Backfill history conservatively (optional)
    op.execute("""
        UPDATE public.pillar_overrides_history poh
        SET weight = p.weight
        FROM public.pillars p
        WHERE p.key = poh.pillar_key
          AND poh.weight IS NULL;
    """)

    # 5) Enforce NOT NULL
    op.alter_column("pillar_overrides", "weight", nullable=False, schema="public")
    op.alter_column("pillar_overrides_history", "weight", nullable=False, schema="public")

    # 6) Replace trigger function with an explicit column list (no NEW.*)
    op.execute("""
    CREATE OR REPLACE FUNCTION public.trg_audit_pillar_overrides()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      who RECORD;
    BEGIN
      -- derive audit meta (adjust if you use a helper function)
      SELECT
        current_setting('app.user', true)   AS auser,
        current_setting('app.reason', true) AS areason,
        current_setting('app.source', true) AS asource
      INTO who;

      IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.pillar_overrides_history
          (id, project_id, pillar_key, pillar_name, score_pct, maturity, weight, updated_at,
           audit_id, op, changed_at, audit_user, audit_txid, audit_reason, audit_source)
        VALUES
          (NEW.id, NEW.project_id, NEW.pillar_key, NEW.pillar_name, NEW.score_pct, NEW.maturity, NEW.weight, NEW.updated_at,
           gen_random_uuid(), 'INSERT', now(), coalesce(who.auser,''),
           txid_current(), coalesce(who.areason,''), coalesce(who.asource,''));
        RETURN NEW;

      ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.pillar_overrides_history
          (id, project_id, pillar_key, pillar_name, score_pct, maturity, weight, updated_at,
           audit_id, op, changed_at, audit_user, audit_txid, audit_reason, audit_source)
        VALUES
          (NEW.id, NEW.project_id, NEW.pillar_key, NEW.pillar_name, NEW.score_pct, NEW.maturity, NEW.weight, NEW.updated_at,
           gen_random_uuid(), 'UPDATE', now(), coalesce(who.auser,''),
           txid_current(), coalesce(who.areason,''), coalesce(who.asource,''));
        RETURN NEW;

      ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.pillar_overrides_history
          (id, project_id, pillar_key, pillar_name, score_pct, maturity, weight, updated_at,
           audit_id, op, changed_at, audit_user, audit_txid, audit_reason, audit_source)
        VALUES
          (OLD.id, OLD.project_id, OLD.pillar_key, OLD.pillar_name, OLD.score_pct, OLD.maturity, OLD.weight, OLD.updated_at,
           gen_random_uuid(), 'DELETE', now(), coalesce(who.auser,''),
           txid_current(), coalesce(who.areason,''), coalesce(who.asource,''));
        RETURN OLD;
      END IF;

      RETURN NULL;
    END;
    $$;
    """)

    # 7) Re-enable the trigger
    op.execute("ALTER TABLE public.pillar_overrides ENABLE TRIGGER audit_pillar_overrides;")


def downgrade():
    # Restore function to pre-weight form
    op.execute("""
        CREATE OR REPLACE FUNCTION public.trg_audit_pillar_overrides()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          IF (TG_OP = 'INSERT') THEN
            INSERT INTO public.pillar_overrides_history
              (id, project_id, pillar_key, pillar_name, score_pct, maturity, updated_at, op, changed_at)
            VALUES
              (NEW.id, NEW.project_id, NEW.pillar_key, NEW.pillar_name, NEW.score_pct, NEW.maturity, NEW.updated_at, 'INSERT', now());
            RETURN NEW;

          ELSIF (TG_OP = 'UPDATE') THEN
            INSERT INTO public.pillar_overrides_history
              (id, project_id, pillar_key, pillar_name, score_pct, maturity, updated_at, op, changed_at)
            VALUES
              (NEW.id, NEW.project_id, NEW.pillar_key, NEW.pillar_name, NEW.score_pct, NEW.maturity, NEW.updated_at, 'UPDATE', now());
            RETURN NEW;

          ELSIF (TG_OP = 'DELETE') THEN
            INSERT INTO public.pillar_overrides_history
              (id, project_id, pillar_key, pillar_name, score_pct, maturity, updated_at, op, changed_at)
            VALUES
              (OLD.id, OLD.project_id, OLD.pillar_key, OLD.pillar_name, OLD.score_pct, OLD.maturity, OLD.updated_at, 'DELETE', now());
            RETURN OLD;
          END IF;

          RETURN NULL;
        END;
        $$;
    """)

    # Drop new columns (history first)
    op.drop_column("pillar_overrides_history", "weight", schema="public")
    op.drop_column("pillar_overrides", "weight", schema="public")
