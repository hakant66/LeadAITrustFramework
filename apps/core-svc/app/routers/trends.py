# app/routers/trends.py
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Tuple
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy import text
from sqlalchemy.engine import Result
from app.db import engine  # your existing SQLAlchemy engine
from app.services.provenance_integration import PROVENANCE_PILLAR_KEY
from app.dependencies import get_entity_id_with_auth_viewer

router = APIRouter(prefix="/scorecard", tags=["trends"])

def parse_window(window: str) -> timedelta | None:
    """
    "90d", "30d", "12w", "all" -> timedelta or None (for all).
    """
    if not window:
        return timedelta(days=90)
    w = window.strip().lower()
    if w == "all":
        return None
    if w.endswith("d"):
        return timedelta(days=int(w[:-1] or "0"))
    if w.endswith("w"):
        return timedelta(weeks=int(w[:-1] or "0"))
    # default
    return timedelta(days=90)

def _serialize_series(rows: List[Tuple[datetime, float]]) -> List[Dict[str, Any]]:
    # rows are (bucket_datetime, value)
    rows_sorted = sorted(rows, key=lambda x: x[0])
    out = []
    for t, v in rows_sorted:
        # serialize bucket as ISO date (no time) for UI
        out.append({"t": t.date().isoformat(), "v": round(float(v or 0.0), 2)})
    return out

@router.get("/{project_slug}/trends")
def get_trends(
    project_slug: str,
    window: str = Query("90d", description="e.g., 30d, 60d, 12w, all"),
    grain: str = Query("week", pattern="^(day|week)$"),
    kpis: str | None = Query(None, description="comma-separated KPI keys"),
    entity_id: UUID = Depends(get_entity_id_with_auth_viewer),
) -> Dict[str, Any]:
    """
    Returns time-series for overall, pillars, and optional KPI keys over a time window, grouped by day/week.
    All values are percentages 0..100 (already normalized).
    Data sources:
      - control_values_history (normalized_pct, observed_at/updated_at)
      - controls (pillar, names)
      - pillars (canonical pillar key/name)
      - pillar_overrides (per-project pillar weights)
    """
    grain_unit = "week" if grain == "week" else "day"
    td = parse_window(window)
    now = datetime.now(timezone.utc)

    # --- 1) Project (exists and belongs to entity)
    with engine.connect() as conn:
        r: Result = conn.execute(
            text("SELECT id, slug, name FROM entity_projects WHERE slug = :slug AND entity_id = :entity_id"),
            {"slug": project_slug, "entity_id": str(entity_id)},
        )
        proj = r.mappings().first()
        if not proj:
            raise HTTPException(status_code=404, detail="project not found")
        project_id = proj["id"]
        project_name = proj["name"]

        # --- 2) Optional KPI filter -> normalize list
        kpi_filter: List[str] = []
        if kpis:
            kpi_filter = [x.strip() for x in kpis.split(",") if x.strip()]
        # prepare IN clause helpers
        kpi_filter_clause = ""
        kpi_filter_params: Dict[str, Any] = {}
        if kpi_filter:
            kpi_filter_clause = "AND v.kpi_key = ANY(:kpi_keys)"
            kpi_filter_params["kpi_keys"] = kpi_filter

        # --- 3) Build WHERE window clause
        window_clause = ""
        params: Dict[str, Any] = {"slug": project_slug, "grain": grain_unit, **kpi_filter_params}
        if td is not None:
            window_clause = (
                "AND COALESCE(v.observed_at, v.updated_at) >= "
                "(NOW() AT TIME ZONE 'UTC' - CAST(:interval AS interval))"
            )
            # build postgres interval like '90 days'
            if window.endswith("w"):
                params["interval"] = f"{int(window[:-1]) * 7} days"
            elif window.endswith("d"):
                params["interval"] = f"{int(window[:-1])} days"
            else:
                params["interval"] = "90 days"

        # --- 4) Time-bucketed KPI values with pillar mapping
        # We join controls to get pillar name (controls.pillar).
        # Then we soft-map to canonical pillar key via pillars.name ~ controls.pillar (case/trim-insensitive).
        params["entity_id"] = str(entity_id)
        entity_filter = "AND v.entity_id = :entity_id"
        
        vals_sql = text(f"""
            WITH vals AS (
              SELECT
                date_trunc(:grain, COALESCE(v.observed_at, v.updated_at)) AS bucket,
                v.kpi_key,
                v.normalized_pct::float8                              AS normalized_pct,
                c.pillar                                               AS pillar_name,
                p.key                                                  AS pillar_key
              FROM control_values_history v
              LEFT JOIN controls c ON c.id = v.control_id
              LEFT JOIN pillars  p ON lower(trim(p.name)) = lower(trim(c.pillar))
              WHERE v.project_slug = :slug
                {entity_filter}
                {window_clause}
                {kpi_filter_clause}
            )
            SELECT * FROM vals
        """)
        vals = conn.execute(vals_sql, params).mappings().all()

        prov_window_clause = ""
        if td is not None:
            prov_window_clause = (
                "AND evaluated_at >= (NOW() AT TIME ZONE 'UTC' - CAST(:interval AS interval))"
            )
        prov_entity_filter = "AND entity_id = :entity_id"

        prov_sql = text(f"""
            SELECT
              date_trunc(:grain, evaluated_at) AS bucket,
              avg(overall_score_pct)::float8   AS score_pct
            FROM provenance_evaluations
            WHERE project_slug = :slug
              {prov_entity_filter}
              {prov_window_clause}
            GROUP BY 1
            ORDER BY 1
        """)
        prov_rows = conn.execute(prov_sql, params).mappings().all()

        if not vals and not prov_rows:
            return {
                "project": {"slug": project_slug, "name": project_name},
                "grain": grain,
                "from": None,
                "to": now.date().isoformat(),
                "overall": [],
                "pillars": {},
                "kpis": {}
            }
        if not vals and prov_rows:
            prov_series = _serialize_series(
                [(row["bucket"], row["score_pct"]) for row in prov_rows]
            )
            from_bucket = prov_rows[0]["bucket"] if prov_rows else None
            return {
                "project": {"slug": project_slug, "name": project_name},
                "grain": grain,
                "from": (from_bucket.date().isoformat() if from_bucket else None),
                "to": now.date().isoformat(),
                "overall": [],
                "pillars": {PROVENANCE_PILLAR_KEY: prov_series},
                "kpis": {}
            }

        # --- 5) Pillar weights for this project (fraction 0..1)
        # Use overrides if present else pillar default; fall back to 1.0 if null.
        w_sql = text("""
            SELECT
              pe.key AS pillar_key,
              COALESCE(po.weight, pe.weight, 1.0)::float8 AS weight
            FROM pillars pe
            LEFT JOIN pillar_overrides po
              ON po.project_id = :project_id
             AND po.pillar_key = pe.key
             AND po.entity_id = :entity_id
            ORDER BY pe.key
        """)
        weights_rows = conn.execute(
            w_sql,
            {"project_id": project_id, "entity_id": str(entity_id)},
        ).mappings().all()
        weights: Dict[str, float] = {r["pillar_key"]: float(r["weight"] or 0.0) for r in weights_rows}

        # --- 6) Aggregate per pillar per bucket
        # We’ll do this in Python to avoid complex SQL pivots.
        from_bucket = None
        pillar_series: Dict[str, Dict[datetime, List[float]]] = {}
        kpi_series: Dict[str, Dict[datetime, List[float]]] = {} if kpi_filter else {}

        for row in vals:
            bucket: datetime = row["bucket"]
            kpi_key: str = row["kpi_key"]
            pct: float = float(row["normalized_pct"] or 0.0)
            pkey: str | None = row["pillar_key"]
            # choose a stable pillar key (fallback to normalized pillar_name if key unknown)
            if pkey is None or pkey == "":
                # fallback: use pillar name lowercased no spaces as pseudo-key
                pname = (row["pillar_name"] or "Unassigned").strip()
                pkey = pname  # keep human-readable; weight may be missing -> default used

            if from_bucket is None or bucket < from_bucket:
                from_bucket = bucket

            # pillar
            pmap = pillar_series.setdefault(pkey, {})
            pmap.setdefault(bucket, []).append(pct)

            # optional KPI(s)
            if kpi_filter:
                if kpi_key in kpi_filter:
                    kmap = kpi_series.setdefault(kpi_key, {})
                    kmap.setdefault(bucket, []).append(pct)

        # compute averages
        pillar_avg: Dict[str, Dict[datetime, float]] = {}
        for pkey, by_bucket in pillar_series.items():
            outb: Dict[datetime, float] = {}
            for b, arr in by_bucket.items():
                outb[b] = sum(arr) / len(arr) if arr else 0.0
            pillar_avg[pkey] = outb

        kpi_avg: Dict[str, Dict[datetime, float]] = {}
        for k, by_bucket in kpi_series.items():
            outb: Dict[datetime, float] = {}
            for b, arr in by_bucket.items():
                outb[b] = sum(arr) / len(arr) if arr else 0.0
            kpi_avg[k] = outb

        # --- 7) Overall series: sum over pillars (pillar_avg[b] * weight)
        overall_buckets: Dict[datetime, float] = {}
        # enumerate all buckets that appear in any pillar
        all_buckets = set()
        for by_bucket in pillar_avg.values():
            all_buckets.update(by_bucket.keys())

        for b in all_buckets:
            total = 0.0
            for pkey, by_bucket in pillar_avg.items():
                pv = by_bucket.get(b, 0.0)
                w = weights.get(pkey, 1.0)  # default 1.0 if no mapping
                total += pv * w
            overall_buckets[b] = total

        # --- 8) Serialize response
        out_pillars: Dict[str, List[Dict[str, Any]]] = {
            pkey: _serialize_series(list(by_bucket.items()))
            for pkey, by_bucket in pillar_avg.items()
        }
        if prov_rows:
            out_pillars[PROVENANCE_PILLAR_KEY] = _serialize_series(
                [(row["bucket"], row["score_pct"]) for row in prov_rows]
            )
        out_kpis: Dict[str, List[Dict[str, Any]]] = {
            k: _serialize_series(list(by_bucket.items()))
            for k, by_bucket in kpi_avg.items()
        }
        overall_list = _serialize_series(list(overall_buckets.items()))

        return {
            "project": {"slug": project_slug, "name": project_name},
            "grain": grain,
            "from": (from_bucket.date().isoformat() if from_bucket else None),
            "to": now.date().isoformat(),
            "overall": overall_list,
            "pillars": out_pillars,
            "kpis": out_kpis
        }
