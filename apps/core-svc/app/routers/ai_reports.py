# app/routers/ai_reports.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from psycopg.rows import dict_row
import psycopg
import os
from dotenv import load_dotenv

# Make sure this import works. 
# It implies the OTHER file (app/services/ai_project_report.py) exists and is correct.
from app.services.ai_project_report import KpiRow, build_ai_project_report

load_dotenv()

# Database connection string
DB_URL = os.getenv("DATABASE_URL", "postgresql://leadai:leadai@localhost:5432/leadai")

# --- API router ---
router = APIRouter(
    prefix="/admin/ai-reports",
    tags=["ai-reports"],
)
# -----------------------------------------------------

class ProjectReportResp(BaseModel):
    project_slug: str
    project_name: str
    overall_score: float | None
    pillar_scores: dict[str, float]
    report_md: str

def get_conn() -> psycopg.Connection:
    return psycopg.connect(DB_URL, autocommit=False)

def compute_pillar_scores(kpis: list[KpiRow]) -> dict[str, float]:
    """
    Aggregate KPI scores by pillar for the JSON response.
    Ignores None scores.
    """
    buckets: dict[str, list[float]] = {}

    for row in kpis:
        if row.kpi_score is None:
            continue
            
        pillar = row.pillar or "Unassigned"
        buckets.setdefault(pillar, []).append(float(row.kpi_score))

    scores: dict[str, float] = {}
    for pillar, values in buckets.items():
        if not values:
            continue
        scores[pillar] = sum(values) / len(values)

    return scores

def compute_overall_score(pillar_scores: dict[str, float]) -> float | None:
    if not pillar_scores:
        return None
    vals = list(pillar_scores.values())
    return sum(vals) / len(vals)

@router.get("/projects/{project_slug}/ai-summary", response_model=ProjectReportResp)
def get_ai_project_report(project_slug: str):
    """
    Build an AI project summary report for a given project_slug.
    """
    sql_proj = """
      SELECT slug, name
      FROM public.projects
      WHERE slug = %s
      LIMIT 1;
    """

    sql_kpis = """
      SELECT
        pl.name         AS pillar,
        k.name          AS kpi_name,
        k.key           AS kpi_key,
        COALESCE(cv.target_text, c.target_text) AS target,
        cv.current_value,
        cv.kpi_score,
        cv.evidence_source AS evidence,
        cv.owner_role      AS owner,
        to_char(cv.observed_at, 'YYYY-MM-DD') AS "date"
      FROM public.control_values cv
      JOIN public.controls c      ON c.id = cv.control_id
      JOIN public.kpis k          ON k.key = cv.kpi_key
      JOIN public.pillars pl      ON pl.id = k.pillar_id
      WHERE cv.project_slug = %s;
    """

    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        # 1. Fetch Project Metadata
        cur.execute(sql_proj, (project_slug,))
        proj = cur.fetchone()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")

        # 2. Fetch KPI rows
        cur.execute(sql_kpis, (project_slug,))
        rows = cur.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No KPIs for this project")

    # 3. Map DB rows -> KpiRow instances
    kpi_rows: list[KpiRow] = [
        KpiRow(
            pillar=r["pillar"],
            kpi_name=r["kpi_name"],
            kpi_key=r["kpi_key"],
            target=r["target"],          
            current_value=r["current_value"], 
            kpi_score=r["kpi_score"],    
            evidence=r["evidence"],
            owner=r["owner"],
            date=r["date"] or "",
        )
        for r in rows
    ]

    # 4. Generate the Markdown Report
    report_md = build_ai_project_report(
        project_name=proj["name"],
        project_slug=proj["slug"],
        kpis=kpi_rows,
    )

    # 5. Compute summary stats for the JSON response
    pillar_scores = compute_pillar_scores(kpi_rows)
    overall = compute_overall_score(pillar_scores)

    return ProjectReportResp(
        project_slug=proj["slug"],
        project_name=proj["name"],
        overall_score=overall,
        pillar_scores=pillar_scores,
        report_md=report_md,
    )
