from __future__ import annotations
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, func
from .db import engine
from .models import Project, Pillar, KPI, Assessment, KPIValue

router = APIRouter(prefix="/scorecard", tags=["trends"])

def date_floor(dt: datetime, grain: str) -> datetime:
    if grain == "week":
        # ISO week start (Monday)
        return dt - timedelta(days=dt.weekday())
    return datetime(dt.year, dt.month, dt.day)

def parse_window(window: str) -> timedelta | None:
    if window == "all":
        return None
    if window.endswith("d"):
        return timedelta(days=int(window[:-1] or "0"))
    if window.endswith("w"):
        return timedelta(weeks=int(window[:-1] or "0"))
    return timedelta(days=90)  # default

@router.get("/{project_slug}/trends")
def get_trends(
    project_slug: str,
    window: str = Query("90d", description="e.g., 30d, 60d, 12w, all"),
    grain: str = Query("week", pattern="^(day|week)$"),
    kpis: str | None = Query(None, description="comma-separated KPI keys")
):
    """
    Returns time-series for overall, pillars, and optional KPI keys over a time window, grouped by day/week.
    All values are percentages 0..100 (already normalized).
    """
    with Session(engine) as s:
        project = s.scalar(select(Project).where(Project.slug == project_slug))
        if not project:
            raise HTTPException(404, "project not found")

        pillars = s.scalars(select(Pillar)).all()
        pillar_by_id = {p.id: p for p in pillars}

        # Load assessments in the window
        now = datetime.utcnow()
        td = parse_window(window)
        q = select(Assessment).where(Assessment.project_id == project.id).order_by(Assessment.created_at.asc())
        if td is not None:
            q = q.where(Assessment.created_at >= now - td)
        assessments = s.scalars(q).all()
        if not assessments:
            return {
                "project": {"slug": project.slug, "name": project.name},
                "grain": grain,
                "from": None,
                "to": now.date().isoformat(),
                "overall": [],
                "pillars": {},
                "kpis": {}
            }

        # Load KPI definitions and a map by id and key
        kpi_defs = s.scalars(select(KPI)).all()
        kpi_by_id = {k.id: k for k in kpi_defs}
        kpi_by_key = {k.key: k for k in kpi_defs}

        # Filter which KPI keys to include in the response (optional)
        requested_kpi_ids: List[str] = []
        if kpis:
            for k in [x.strip() for x in kpis.split(",") if x.strip()]:
                if k not in kpi_by_key:
                    raise HTTPException(400, f"unknown kpi key: {k}")
                requested_kpi_ids.append(kpi_by_key[k].id)

        # Pull all KPI values for those assessments (one round trip)
        a_ids = [a.id for a in assessments]
        values = s.scalars(select(KPIValue).where(KPIValue.assessment_id.in_(a_ids))).all()

        # Group KPI values by assessment id
        by_assessment: Dict[str, List[KPIValue]] = {}
        for v in values:
            by_assessment.setdefault(v.assessment_id, []).append(v)

        # Build time buckets
        from_dt = assessments[0].created_at
        series_overall: Dict[datetime, float] = {}
        series_pillar: Dict[str, Dict[datetime, float]] = {p.key: {} for p in pillars}
        series_kpi: Dict[str, Dict[datetime, float]] = {}  # by KPI key

        for a in assessments:
            bucket = date_floor(a.created_at, grain)
            vals = by_assessment.get(a.id, [])
            if not vals:
                continue

            # Compute per-pillar avg normalized, and overall weighted sum
            pillar_acc: Dict[str, List[float]] = {p.id: [] for p in pillars}
            for v in vals:
                kd = kpi_by_id.get(v.kpi_id)
                if not kd:
                    continue
                pillar_acc[kd.pillar_id].append(v.normalized_0_100)

            overall_pct = 0.0
            for p in pillars:
                arr = pillar_acc[p.id]
                pillar_pct = sum(arr) / len(arr) if arr else 0.0
                # store pillar series
                series_pillar[p.key][bucket] = pillar_pct
                # accumulate overall (pillar weight is 0..1)
                overall_pct += pillar_pct * p.weight

            series_overall[bucket] = overall_pct  # already 0..100 because pillar_pct is 0..100 × weight(0..1)

            # selected KPIs
            if requested_kpi_ids:
                # build once the KPI key map
                if not series_kpi:
                    for kid in requested_kpi_ids:
                        series_kpi[kpi_by_id[kid].key] = {}
                for v in vals:
                    if v.kpi_id in requested_kpi_ids:
                        key = kpi_by_id[v.kpi_id].key
                        series_kpi[key][bucket] = v.normalized_0_100

        # Serialize: sort by bucket time
        def serialize(d: Dict[datetime, float]) -> List[Dict[str, float | str]]:
            return [{"t": t.date().isoformat(), "v": round(v, 2)} for t, v in sorted(d.items(), key=lambda x: x[0])]

        out_pillars = {k: serialize(series_pillar[k]) for k in series_pillar.keys()}
        out_kpis = {k: serialize(series_kpi[k]) for k in series_kpi.keys()}

        return {
            "project": {"slug": project.slug, "name": project.name},
            "grain": grain,
            "from": from_dt.date().isoformat(),
            "to": now.date().isoformat(),
            "overall": serialize(series_overall),
            "pillars": out_pillars,
            "kpis": out_kpis
        }
