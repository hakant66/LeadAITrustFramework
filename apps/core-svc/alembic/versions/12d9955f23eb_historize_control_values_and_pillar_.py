"""historize control_values and pillar_overrides

Revision ID: 12d9955f23eb
Revises: c74951ac2795
Create Date: 2025-11-06 20:42:52.767782

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '12d9955f23eb'
down_revision: Union[str, Sequence[str], None] = 'c74951ac2795'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Ensure pgcrypto for gen_random_uuid()
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    # --- 1) HISTORY TABLES (created via LIKE to auto-track columns) ---
    op.execute("""
    CREATE TABLE IF NOT EXISTS public.control_values_history
    (
      LIKE public.control_values INCLUDING DEFAULTS INCLUDING GENERATED
        EXCLUDING CONSTRAINTS EXCLUDING INDEXES,

      audit_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      audit_action text NOT NULL,               -- INSERT/UPDATE/DELETE
      audit_ts     timestamptz NOT NULL DEFAULT now(),
      audit_user   text,
      audit_txid   bigint NOT NULL DEFAULT txid_current(),
      audit_reason text,
      audit_source text
    );
    CREATE INDEX IF NOT EXISTS ix_cvh_project ON public.control_values_history (project_slug);
    CREATE INDEX IF NOT EXISTS ix_cvh_txid    ON public.control_values_history (audit_txid);
    CREATE INDEX IF NOT EXISTS ix_cvh_when    ON public.control_values_history (audit_ts);
    """)

    # If pillar_overrides table exists, create its history in the same way
    op.execute("""
    CREATE TABLE IF NOT EXISTS public.pillar_overrides_history
    (
      LIKE public.pillar_overrides INCLUDING DEFAULTS INCLUDING GENERATED
        EXCLUDING CONSTRAINTS EXCLUDING INDEXES,

      audit_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      audit_action text NOT NULL,
      audit_ts     timestamptz NOT NULL DEFAULT now(),
      audit_user   text,
      audit_txid   bigint NOT NULL DEFAULT txid_current(),
      audit_reason text,
      audit_source text
    );

    -- Helpful indexes (match your live schema)
    CREATE INDEX IF NOT EXISTS ix_poh_txid      ON public.pillar_overrides_history (audit_txid);
    CREATE INDEX IF NOT EXISTS ix_poh_when      ON public.pillar_overrides_history (audit_ts);
    CREATE INDEX IF NOT EXISTS ix_poh_project   ON public.pillar_overrides_history (project_id);
    CREATE INDEX IF NOT EXISTS ix_poh_pillar    ON public.pillar_overrides_history (pillar_key);
    CREATE INDEX IF NOT EXISTS ix_poh_proj_pil  ON public.pillar_overrides_history (project_id, pillar_key);
    """)


    # --- 2) WHO helper (reads app.* GUCs set by your app per request/tx) ---
    op.execute("""
    CREATE OR REPLACE FUNCTION public._audit_who()
    RETURNS TABLE(auser text, areason text, asource text)
    LANGUAGE plpgsql STABLE AS $$
    BEGIN
      auser   := current_setting('app.user',   true);
      areason := current_setting('app.reason', true);
      asource := current_setting('app.source', true);
      RETURN;
    END; $$;
    """)

    # --- 3) TRIGGER FUNCTIONS ---
    op.execute("""
    CREATE OR REPLACE FUNCTION public.trg_audit_control_values()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE who RECORD;
    BEGIN
      SELECT * INTO who FROM public._audit_who();
      IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.control_values_history
        SELECT (NEW).*, gen_random_uuid(),'INSERT',now(),who.auser,txid_current(),who.areason,who.asource;
        RETURN NEW;
      ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.control_values_history
        SELECT (NEW).*, gen_random_uuid(),'UPDATE',now(),who.auser,txid_current(),who.areason,who.asource;
        RETURN NEW;
      ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.control_values_history
        SELECT (OLD).*, gen_random_uuid(),'DELETE',now(),who.auser,txid_current(),who.areason,who.asource;
        RETURN OLD;
      END IF;
    END; $$;
    """)

    op.execute("""
    CREATE OR REPLACE FUNCTION public.trg_audit_pillar_overrides()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE who RECORD;
    BEGIN
      SELECT * INTO who FROM public._audit_who();
      IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.pillar_overrides_history
        SELECT (NEW).*, gen_random_uuid(),'INSERT',now(),who.auser,txid_current(),who.areason,who.asource;
        RETURN NEW;
      ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.pillar_overrides_history
        SELECT (NEW).*, gen_random_uuid(),'UPDATE',now(),who.auser,txid_current(),who.areason,who.asource;
        RETURN NEW;
      ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.pillar_overrides_history
        SELECT (OLD).*, gen_random_uuid(),'DELETE',now(),who.auser,txid_current(),who.areason,who.asource;
        RETURN OLD;
      END IF;
    END; $$;
    """)

    # --- 4) TRIGGERS ---
    op.execute("DROP TRIGGER IF EXISTS audit_control_values ON public.control_values;")
    op.execute("""
    CREATE TRIGGER audit_control_values
    AFTER INSERT OR UPDATE OR DELETE ON public.control_values
    FOR EACH ROW EXECUTE FUNCTION public.trg_audit_control_values();
    """)

    op.execute("DROP TRIGGER IF EXISTS audit_pillar_overrides ON public.pillar_overrides;")
    op.execute("""
    CREATE TRIGGER audit_pillar_overrides
    AFTER INSERT OR UPDATE OR DELETE ON public.pillar_overrides
    FOR EACH ROW EXECUTE FUNCTION public.trg_audit_pillar_overrides();
    """)

    # --- 5) (Optional) Partitioning example for control_values_history (commented) ---
    # op.execute("ALTER TABLE public.control_values_history PARTITION BY RANGE (audit_ts);")
    # op.execute("""
    # CREATE TABLE IF NOT EXISTS public.control_values_history_y2025m11
    #   PARTITION OF public.control_values_history
    #   FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
    # """)

def downgrade():
    # Drop triggers first (safe even if missing)
    op.execute("DROP TRIGGER IF EXISTS audit_control_values ON public.control_values;")
    op.execute("DROP TRIGGER IF EXISTS audit_pillar_overrides ON public.pillar_overrides;")

    # Drop trigger functions
    op.execute("DROP FUNCTION IF EXISTS public.trg_audit_control_values;")
    op.execute("DROP FUNCTION IF EXISTS public.trg_audit_pillar_overrides;")
    op.execute("DROP FUNCTION IF EXISTS public._audit_who;")

    # Drop history tables (keep data? If yes, comment these out)
    op.execute("DROP TABLE IF EXISTS public.control_values_history;")
    op.execute("DROP TABLE IF EXISTS public.pillar_overrides_history;")
