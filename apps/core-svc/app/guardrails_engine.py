# apps/coresvc/app/guardrails_engine.py
from __future__ import annotations

import os
import sys
import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL", "postgresql://leadai:leadai@localhost:5432/leadai")

# -------- Logging --------
LOG_LEVEL = os.getenv("GUARDRAILS_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(levelname)s [guardrails] %(message)s",
)
log = logging.getLogger("guardrails")

# --- Default KPI keys used to derive facts (fallback if DB config not present) ---
DEFAULT_FACT_SOURCES: Dict[str, Dict[str, Any]] = {
    "has_pcl":       {"source": "kpi", "kpi_key": "pcl_assigned",                    "present_threshold": 100},
    "has_annex":     {"source": "kpi", "kpi_key": "annex_iv_completeness_pct",       "present_threshold": 1},
    "has_factsheet": {"source": "kpi", "kpi_key": "trust_factsheet_completeness_pct","present_threshold": 1},
    # Example future:
    # "data_prov_ok": {"source":"kpi", "kpi_key":"provenance_coverage_pct", "present_threshold":80},
}

# --- Fallback rules if DB has none (safe defaults) ---
DEFAULT_RULES: List[Dict[str, Any]] = [
    # GOV cap 40 if no PCL
    {"pillar_key": "gov", "cap": 40, "when": {"all_of": [{"fact": "has_pcl", "op": "==", "value": 0}]}},
    # TCT cap 50 if Annex IV or Trust Factsheet missing
    {"pillar_key": "tct", "cap": 50, "when": {"any_of": [
        {"fact": "has_annex", "op": "==", "value": 0},
        {"fact": "has_factsheet", "op": "==", "value": 0},
    ]}},
]

# ------------------------------ Data classes --------------------------------------
@dataclass
class GuardrailRule:
    pillar_key: str        # e.g., 'gov', 'tct', 'data', 'xai', 'hcr', 'cra'
    cap: float             # numeric cap 0..100
    when: Dict[str, Any]   # condition JSON: {all_of:[...]} or {any_of:[...]}

# --------------------------- DB utils --------------------------------------------
def _table_exists(conn: psycopg.Connection, fqname: str) -> bool:
    schema, _, table = fqname.partition(".")
    sql = """
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = %s AND table_name = %s
        LIMIT 1
    """
    with conn.cursor() as cur:
        cur.execute(sql, (schema or "public", table))
        return cur.fetchone() is not None

# --------------------------- Config loaders ---------------------------------------
def load_fact_sources(conn: psycopg.Connection) -> Dict[str, Dict[str, Any]]:
    """
    Optional table: public.guardrail_fact_sources
      - fact_key text primary key
      - source   text CHECK (source IN ('kpi','project_attr')) NOT NULL
      - kpi_key  text  (when source='kpi')
      - attr_key text  (when source='project_attr')
      - present_threshold numeric NULL
    """
    if not _table_exists(conn, "public.guardrail_fact_sources"):
        log.debug("fact_sources: table missing, using defaults")
        return DEFAULT_FACT_SOURCES

    sql = """
      SELECT fact_key, source, kpi_key, attr_key, present_threshold
      FROM public.guardrail_fact_sources
    """
    out: Dict[str, Dict[str, Any]] = {}
    with conn.cursor(row_factory=dict_row) as cur:
        log.debug("load_fact_sources SQL: %s", sql)
        cur.execute(sql)
        rows = cur.fetchall()
        for r in rows:
            out[r["fact_key"]] = {
                "source": r["source"],
                "kpi_key": r.get("kpi_key"),
                "attr_key": r.get("attr_key"),
                "present_threshold": float(r["present_threshold"]) if r["present_threshold"] is not None else None,
            }

    # Merge defaults for any missing critical facts
    for k, v in DEFAULT_FACT_SOURCES.items():
        out.setdefault(k, v)

    log.info("fact_sources loaded: %d", len(out))
    log.debug("fact_sources detail: %s", json.dumps(out, indent=2))
    return out


def load_guardrail_rules(conn: psycopg.Connection) -> List[GuardrailRule]:
    """
    Optional table: public.guardrail_rules
      - id uuid pk
      - pillar_key text not null
      - cap numeric not null
      - rule jsonb not null
      - is_enabled boolean default true
    """
    if not _table_exists(conn, "public.guardrail_rules"):
        log.debug("guardrail_rules: table missing, using defaults")
        return [GuardrailRule(**r) for r in DEFAULT_RULES]

    sql = """
      SELECT pillar_key, cap, rule
      FROM public.guardrail_rules
      WHERE COALESCE(is_enabled, TRUE) = TRUE
    """
    rules: List[GuardrailRule] = []
    with conn.cursor(row_factory=dict_row) as cur:
        log.debug("load_guardrail_rules SQL: %s", sql)
        cur.execute(sql)
        for r in cur.fetchall():
            rules.append(GuardrailRule(
                pillar_key=r["pillar_key"].strip().lower(),
                cap=float(r["cap"]),
                when=r["rule"] or {},
            ))

    if not rules:
        log.warning("guardrail_rules: all disabled/empty; falling back to defaults")
        return [GuardrailRule(**r) for r in DEFAULT_RULES]

    log.info("guardrail_rules loaded: %d", len(rules))
    log.debug("guardrail_rules detail: %s", json.dumps([r.__dict__ for r in rules], indent=2))
    return rules

# --------------------------- Fact computation -------------------------------------
def _kpi_score_for_project(conn: psycopg.Connection, project_id: str, kpi_key: str) -> Optional[float]:
    sql = """
      SELECT MAX(cv.kpi_score)::float
      FROM public.control_values cv
      WHERE cv.project_slug = (
        SELECT slug FROM public.projects WHERE id = %s
      ) AND lower(btrim(cv.kpi_key)) = lower(btrim(%s))
    """
    with conn.cursor() as cur:
        log.debug("kpi_score SQL: %s | args=(%s, %s)", sql, project_id, kpi_key)
        cur.execute(sql, (project_id, kpi_key))
        row = cur.fetchone()
        return float(row[0]) if row and row[0] is not None else None

def _project_attr(conn: psycopg.Connection, project_id: str, attr_key: str) -> Optional[Any]:
    sql = f"SELECT {attr_key} FROM public.projects WHERE id = %s"
    with conn.cursor() as cur:
        try:
            log.debug("project_attr SQL: %s | args=(%s)", sql, project_id)
            cur.execute(sql, (project_id,))
            row = cur.fetchone()
            return row[0] if row else None
        except Exception as e:
            log.warning("project_attr error for attr %s: %s", attr_key, e)
            # IMPORTANT: reset aborted transaction so subsequent queries work
            try:
                conn.rollback()
            except Exception:
                pass
            return None

def compute_project_facts(conn: psycopg.Connection, project_id: str, fact_sources: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """
    Returns a dict of boolean/number facts used by guardrail rules.
    Convention: *_present or *_ok facts should evaluate to 1 (true) or 0 (false).
    """
    facts: Dict[str, Any] = {}
    for fact_key, src in fact_sources.items():
        if src.get("source") == "kpi":
            score = _kpi_score_for_project(conn, project_id, src.get("kpi_key", ""))
            thr = src.get("present_threshold")
            if thr is None:
                facts[fact_key] = 1 if (score is not None and score > 0) else 0
            else:
                facts[fact_key] = 1 if (score is not None and score >= float(thr)) else 0
            facts[f"{fact_key}__score"] = score
        elif src.get("source") == "project_attr":
            val = _project_attr(conn, project_id, src.get("attr_key", ""))
            facts[fact_key] = val
        else:
            facts[fact_key] = None

    log.info("facts computed for project %s: %d items", project_id, len(facts))
    log.debug("facts detail: %s", json.dumps(facts, indent=2, default=str))
    return facts

# --------------------------- Rule evaluation & apply ------------------------------
def _cmp(left: Any, op: str, right: Any) -> bool:
    try:
        if op == "==": return left == right
        if op == "!=": return left != right
        if op == ">":  return float(left) >  float(right)
        if op == ">=": return float(left) >= float(right)
        if op == "<":  return float(left) <  float(right)
        if op == "<=": return float(left) <= float(right)
    except Exception:
        return False
    return False

def _eval_clause(facts: Dict[str, Any], clause: Dict[str, Any]) -> bool:
    if "not" in clause:
        return not _eval_clause(facts, clause["not"])
    fact = clause.get("fact")
    op = clause.get("op", "==")
    val = clause.get("value")
    return _cmp(facts.get(fact), op, val)

def _eval_when(facts: Dict[str, Any], when: Dict[str, Any]) -> bool:
    if not when:
        return True
    if "all_of" in when:
        return all(_eval_clause(facts, c) for c in when["all_of"])
    if "any_of" in when:
        return any(_eval_clause(facts, c) for c in when["any_of"])
    return False  # unknown structure

def apply_guardrails_for_project(
    conn: psycopg.Connection,
    project_id: str,
    pillar_raw: Dict[str, float],
) -> Dict[str, float]:
    """
    Given raw pillar scores (0..100) for a project, applies configured caps and
    returns final scores.
    """
    fact_sources = load_fact_sources(conn)
    rules = load_guardrail_rules(conn)
    facts = compute_project_facts(conn, project_id, fact_sources)

    final_scores: Dict[str, float] = dict(pillar_raw)
    for rule in rules:
        triggered = _eval_when(facts, rule.when)
        log.debug("rule check: pillar=%s cap=%s triggered=%s when=%s",
                  rule.pillar_key, rule.cap, triggered, json.dumps(rule.when))
        if triggered:
            pk = rule.pillar_key.strip().lower()
            if pk in final_scores:
                before = final_scores[pk]
                final_scores[pk] = min(final_scores[pk], float(rule.cap))
                after = final_scores[pk]
                log.info("cap applied: pillar=%s before=%.2f cap=%.2f after=%.2f", pk, before, rule.cap, after)

    log.info("final pillar scores computed for project %s", project_id)
    log.debug("pillar_raw:   %s", json.dumps(pillar_raw, indent=2))
    log.debug("pillar_final: %s", json.dumps(final_scores, indent=2))
    return final_scores

# --------------------------- Diagnostics helpers ----------------------------------
RAW_PILLAR_SQL = """
WITH scope AS (
  SELECT p.id AS project_id, p.slug
  FROM public.projects p
  WHERE p.id = %(project_id)s
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
  LEFT JOIN public.pillars plc
    ON lower(btrim(plc.name)) = lower(btrim(c.pillar))
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

def compute_raw_pillars_for_project(conn: psycopg.Connection, project_id: str) -> Dict[str, float]:
    with conn.cursor(row_factory=dict_row) as cur:
        log.debug("RAW_PILLAR_SQL: %s", RAW_PILLAR_SQL)
        cur.execute(RAW_PILLAR_SQL, {"project_id": project_id})
        rows = cur.fetchall()
        out = {r["pillar_key"]: float(r["raw_score_pct"]) for r in rows}
        log.info("raw pillar rows: %d", len(out))
        return out

def _project_id_from_slug(conn: psycopg.Connection, slug: str) -> Optional[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM public.projects WHERE slug = %s", (slug,))
        row = cur.fetchone()
        return row[0] if row else None

def diagnose_guardrails_for_project(
    project_slug: str, verbose: bool = False) -> Dict[str, Any]:
    """
    Return a full diagnostic payload including:
      - project_id, slug
      - facts
      - rules
      - pillar_raw
      - pillar_final
      - triggers (which rules fired and applied caps)
    """
    if verbose:
        log.setLevel(logging.DEBUG)

    with psycopg.connect(DB_URL, autocommit=False) as conn:
        pid = _project_id_from_slug(conn, project_slug)
        if not pid:
            raise ValueError(f"Unknown project slug: {project_slug}")

        fact_sources = load_fact_sources(conn)
        rules = load_guardrail_rules(conn)
        facts = compute_project_facts(conn, pid, fact_sources)
        pillar_raw = compute_raw_pillars_for_project(conn, pid)

        # compute final + capture triggers
        pillar_final = dict(pillar_raw)
        triggers: List[Dict[str, Any]] = []
        for rule in rules:
            fired = _eval_when(facts, rule.when)
            if fired:
                pk = rule.pillar_key.strip().lower()
                if pk in pillar_final:
                    before = pillar_final[pk]
                    pillar_final[pk] = min(pillar_final[pk], float(rule.cap))
                    triggers.append({
                        "pillar": pk,
                        "cap": float(rule.cap),
                        "before": float(before),
                        "after": float(pillar_final[pk]),
                        "when": rule.when,
                    })

        return {
            "project": {"slug": project_slug, "id": pid},
            "facts": facts,
            "rules": [r.__dict__ for r in rules],
            "pillar_raw": pillar_raw,
            "pillar_final": pillar_final,
            "triggers": triggers,
        }

# --------------------------- CLI entry for testing --------------------------------
def _print_json(d: Dict[str, Any]) -> None:
    print(json.dumps(d, indent=2, default=str))

def main(argv: List[str]) -> int:
    if len(argv) < 2:
        print("Usage: python -m apps.coresvc.app.guardrails_engine <project-slug> [--verbose]")
        return 2
    slug = argv[1]
    verbose = ("--verbose" in argv) or ("-v" in argv)
    try:
        diag = diagnose_guardrails_for_project(slug, verbose=verbose)
        _print_json(diag)
        return 0
    except Exception as e:
        log.error("diagnostics failed: %s", e)
        return 1

if __name__ == "__main__":
    sys.exit(main(sys.argv))
