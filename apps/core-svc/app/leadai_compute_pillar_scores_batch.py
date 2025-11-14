# apps/coresvc/app/leadai_compute_pillar_scores.py
# Compute weighted pillar scores from control_values and UPDATE pillar_overrides.score_pct (no inserts).
# Canonical pillar key is resolved via pillars:
#   - from controls.pillar (NAME) -> pillars.key  (plc)
#   - fallback from kpis.pillar_id (ID) -> pillars.key  (plk)

import os
import sys
import signal
from typing import Optional  # kept for parity/style

from dotenv import load_dotenv
import psycopg

# ===================== Config =====================
load_dotenv()
DB_URL = os.getenv("DATABASE_URL", "postgresql://leadai:leadai@localhost:5432/leadai")
STATEMENT_TIMEOUT_MS = int(os.getenv("PG_STMT_TIMEOUT_MS", "60000"))  # 60s default
# ==================================================

# SQL:
#  1) base: compute rows with canonical pillar key using pillars.key:
#       - plc: join pillars by NAME from controls.pillar
#       - plk: join pillars by ID from kpis.pillar_id
#       - pillar_key := lower(trim(COALESCE(plc.key, plk.key)))
#  2) agg: weighted average per (project_id, pillar_key)
#  3) scores: clamp to [0,100]
#  4) UPDATE pillar_overrides only when changed (IS DISTINCT FROM), with normalized join on pillar_key.
UPDATE_PILLAR_SCORES_SQL = f"""
WITH base AS (
  SELECT
    p.id AS project_id,
    -- Resolve canonical pillar key:
    lower(btrim(COALESCE(plc.key, plk.key))) AS pillar_key,
    cv.kpi_score::numeric                    AS kpi_score,
    COALESCE(c.weight, k.weight, 1.0)::numeric AS weight
  FROM public.control_values cv
  JOIN public.projects p ON p.slug = cv.project_slug
  JOIN public.controls c ON c.kpi_key = cv.kpi_key
  LEFT JOIN public.kpis k ON k.key = cv.kpi_key
  -- Map controls.pillar (NAME) -> pillars.key (canonical short code)
  LEFT JOIN public.pillars plc
    ON lower(btrim(plc.name)) = lower(btrim(c.pillar))
  -- Fallback: KPIs pillar_id -> pillars.key
  LEFT JOIN public.pillars plk
    ON plk.id = k.pillar_id
  WHERE cv.kpi_score IS NOT NULL
    AND COALESCE(plc.key, plk.key) IS NOT NULL
),
agg AS (
  SELECT
    project_id,
    pillar_key,
    SUM(weight * kpi_score) AS weighted_sum,
    SUM(weight)             AS weight_sum
  FROM base
  GROUP BY project_id, pillar_key
),
scores AS (
  SELECT
    project_id,
    pillar_key,
    (GREATEST(0, LEAST(100, weighted_sum / NULLIF(weight_sum,0))))::numeric(6,2) AS score_pct
  FROM agg
  WHERE weight_sum > 0
),
upd AS (
  UPDATE public.pillar_overrides po
  SET score_pct = s.score_pct,
      updated_at = NOW()
  FROM scores s
  WHERE po.project_id = s.project_id
    AND lower(btrim(po.pillar_key)) = s.pillar_key
    AND po.score_pct IS DISTINCT FROM s.score_pct
  RETURNING 1
)
SELECT COUNT(*)::int AS updated_rows FROM upd;
"""

def _graceful_exit(signum, frame):
    print(f"\nReceived signal {signum}; exiting gracefully.")
    sys.exit(130)

def main() -> int:
    signal.signal(signal.SIGINT, _graceful_exit)
    signal.signal(signal.SIGTERM, _graceful_exit)

    try:
        with psycopg.connect(
            DB_URL,
            autocommit=False,
            options=f"-c statement_timeout={STATEMENT_TIMEOUT_MS}"
        ) as conn, conn.cursor() as cur:
            try:
                cur.execute(UPDATE_PILLAR_SCORES_SQL)
                row = cur.fetchone()
                updated = int(row[0]) if row and row[0] is not None else 0
                conn.commit()
            except psycopg.errors.UndefinedTable as e:
                conn.rollback()
                print("Schema error: a required table is missing. "
                      "Check controls/control_values/kpis/projects/pillars/pillar_overrides.")
                print(f"DETAILS: {e}")
                return 2
            except psycopg.errors.UndefinedColumn as e:
                conn.rollback()
                print("Schema error: a required column is missing.")
                print(f"DETAILS: {e}")
                return 2
            except Exception as e:
                conn.rollback()
                print("Failed to update pillar_overrides.score_pct; transaction rolled back.")
                print(f"DETAILS: {e}")
                return 3

            print(f"Updated pillar_overrides rows: {updated}")
            if updated == 0:
                print("Note: Either no matching (project_id, pillar_key) pairs exist in pillar_overrides,")
                print("      or all existing values already equal the newly computed scores.")
            return 0

    except psycopg.OperationalError as e:
        print("Database connection failed. Verify DSN/credentials/network.")
        print(f"DSN used: {DB_URL!r}")
        print(f"DETAILS: {e}")
        return 4
    except Exception as e:
        print("Fatal error before/after DB connection.")
        print(f"DETAILS: {e}")
        return 5

if __name__ == "__main__":
    sys.exit(main())
