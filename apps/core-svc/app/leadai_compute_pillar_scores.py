# apps/coresvc/app/leadai_compute_pillar_scores_new.py
"""
Compute pillar scores from KPI scores, apply guardrail caps (from DB config),
and UPSERT results into public.project_pillar_scores.

- Raw pillar score: weighted average of KPI scores per (project_id, pillar_key)
  using COALESCE(controls.weight, kpis.weight, 1.0).
- Guardrails: loaded/evaluated via guardrails_engine.apply_guardrails_for_project.
- Output table: public.project_pillar_scores(project_id, pillar_key, raw_score_pct, final_score_pct, computed_at)

Usage:
    # ALL projects
    python -m apps.coresvc.app.leadai_compute_pillar_scores

    # One project by slug
    python -m apps.coresvc.app.leadai_compute_pillar_scores ai-document-processing
"""

from __future__ import annotations

import os
import sys
import signal
from typing import Optional, Dict

from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

from guardrails_engine import apply_guardrails_for_project

# ===================== Config =====================
load_dotenv()
DB_URL = os.getenv("DATABASE_URL", "postgresql://leadai:leadai@localhost:5432/leadai")
STATEMENT_TIMEOUT_MS = int(os.getenv("PG_STMT_TIMEOUT_MS", "60000"))  # 60s default
# ==================================================


# SQL to gather raw pillar scores:
#  1) scope: limit to a project slug if provided
#  2) base: canonical pillar key via pillars.key
#  3) agg: weighted avg per (project_id, pillar_key)
RAW_PILLAR_SQL = """
WITH scope AS (
  SELECT p.id AS project_id, p.slug
  FROM public.projects p
  {project_filter}
),
base AS (
  SELECT
    sc.project_id,
    lower(btrim(COALESCE(plc.key, plk.key))) AS pillar_key,
    cv.kpi_score::numeric                    AS kpi_score,
    COALESCE(c.weight, k.weight, 1.0)::numeric AS weight
  FROM public.control_values cv
  JOIN scope sc ON sc.slug = cv.project_slug
  JOIN public.controls c ON c.kpi_key = cv.kpi_key
  LEFT JOIN public.kpis k ON k.key = cv.kpi_key
  -- Map controls.pillar (NAME) -> pillars.key
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
)
SELECT
  project_id,
  pillar_key,
  (GREATEST(0, LEAST(100, weighted_sum / NULLIF(weight_sum, 0))))::float AS raw_score_pct
FROM agg
WHERE weight_sum > 0
ORDER BY project_id, pillar_key;
"""


def _graceful_exit(signum, frame):
    print(f"\nReceived signal {signum}; exiting gracefully.")
    sys.exit(130)


def _ensure_output_table(conn: psycopg.Connection) -> None:
    """
    Ensure public.project_pillar_scores exists and has a PK on (project_id, pillar_key).
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS public.project_pillar_scores (
              project_id       text         NOT NULL,
              pillar_key       text         NOT NULL,
              raw_score_pct    numeric(6,2) NOT NULL,
              final_score_pct  numeric(6,2) NOT NULL,
              computed_at      timestamptz  NOT NULL DEFAULT now(),
              CONSTRAINT project_pillar_scores_pkey PRIMARY KEY (project_id, pillar_key)
            );
            """
        )


def run(project_filter: Optional[str] = None, verbose: bool = False) -> tuple[int, int]:
    """
    Recompute pillar scores for one project (by slug) or for ALL projects.
    Returns (updated_rows, skipped_rows). 'skipped_rows' is always 0 here.
    """
    updated = 0
    project_clause = "" if not project_filter else "WHERE p.slug = %(slug)s"
    sql = RAW_PILLAR_SQL.replace("{project_filter}", project_clause)
    params = {"slug": project_filter} if project_filter else None

    try:
        with psycopg.connect(
            DB_URL,
            autocommit=False,
            options=f"-c statement_timeout={STATEMENT_TIMEOUT_MS}",
        ) as conn, conn.cursor(row_factory=dict_row) as cur:

            # Create target table if missing
            _ensure_output_table(conn)

            # (Optional) avoid concurrent clobbering
            cur.execute("SELECT pg_advisory_xact_lock( hashtext('project_pillar_scores') );")

            # 1) Pull raw pillar scores per project/pillar
            cur.execute(sql, params)
            rows = cur.fetchall()

            if verbose:
                scope = project_filter or "ALL"

            # 2) Group by project_id -> { pillar_key: raw_score }
            by_project: Dict[str, Dict[str, float]] = {}
            for r in rows:
                pid = r["project_id"]
                key = r["pillar_key"]
                val = float(r["raw_score_pct"])
                by_project.setdefault(pid, {})[key] = val

            # 3) For each project, apply guardrails and UPSERT (with per-row savepoints)
            for project_id, raw_scores in by_project.items():

                final_scores = apply_guardrails_for_project(conn, project_id, raw_scores)

                for pillar_key, final_val in final_scores.items():
                    raw_val = raw_scores.get(pillar_key, final_val)

                    # Resilient upsert
                    cur.execute("SAVEPOINT sp_upsert;")
                    try:
                        cur.execute(
                            """
                            INSERT INTO public.project_pillar_scores
                              (project_id, pillar_key, raw_score_pct, final_score_pct, computed_at)
                            VALUES (%s, %s, %s, %s, now())
                            ON CONFLICT (project_id, pillar_key) DO UPDATE
                            SET raw_score_pct = EXCLUDED.raw_score_pct,
                                final_score_pct = EXCLUDED.final_score_pct,
                                computed_at = now()
                            """,
                            (project_id, pillar_key, raw_val, final_val),
                        )
                        updated += cur.rowcount
                        cur.execute("RELEASE SAVEPOINT sp_upsert;")
                    except psycopg.Error as e:
                        cur.execute("ROLLBACK TO SAVEPOINT sp_upsert;")
                        msg = getattr(e, "pgerror", str(e))
                        sqlstate = getattr(e, "sqlstate", None)
                        diag = getattr(e, "diag", None)
                        constraint = getattr(diag, "constraint_name", None) if diag else None
                        detail = getattr(diag, "message_detail", None) if diag else None
                        #print(f"[UPSERT ERROR] project={project_id} pillar={pillar_key} sqlstate={sqlstate} constraint={constraint}")
                        #print(f"  {msg}")
                        if detail:
                            print(f"  detail: {detail}")
                        # continue with the next pillar

            conn.commit()

        if verbose:
            print(f"[pillar] upserts={updated}")
        return updated, 0

    except psycopg.errors.UndefinedTable as e:
        print("Schema error: a required table is missing.")
        print("Ensure: projects, controls, kpis, pillars, control_values exist.")
        print(f"DETAILS: {e}")
        return 0, 0
    except psycopg.errors.UndefinedColumn as e:
        print("Schema error: a required column is missing.")
        print(f"DETAILS: {e}")
        return 0, 0
    except psycopg.OperationalError as e:
        print("Database connection failed. Verify DSN/credentials/network.")
        print(f"DSN used: {DB_URL!r}")
        print(f"DETAILS: {e}")
        return 0, 0
    except Exception as e:
        print("Failed to compute pillar scores; transaction rolled back.")
        print(f"DETAILS: {e}")
        print("DB_URL:", DB_URL)
        return 0, 0


def main() -> int:
    signal.signal(signal.SIGINT, _graceful_exit)
    signal.signal(signal.SIGTERM, _graceful_exit)
    try:
        # CLI: python -m apps.coresvc.app.leadai_compute_pillar_scores [slug]
        slug = sys.argv[1] if len(sys.argv) > 1 else None
        up, _ = run(slug, verbose=True)
        print(f"Updated project_pillar_scores rows: {up}")
        return 0
    except Exception as e:
        print("Error:", e)
        return 3


if __name__ == "__main__":
    sys.exit(main())