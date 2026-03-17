# app/routers/kpidetail.py
from typing import Optional
from datetime import datetime
from uuid import UUID

import os
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.db_utils import normalize_pg_dsn
from app.dependencies import get_entity_id_with_auth_viewer

load_dotenv()
DB_URL = normalize_pg_dsn(
    os.getenv("DATABASE_URL", "postgresql://leadai:leadai@localhost:5432/leadai")
)

router = APIRouter(
    prefix="/scorecard",
    tags=["scorecard-kpi-detail"],
)


class KpiDetailResp(BaseModel):
    # from control_values
    project_slug: str
    kpi_key: str
    raw_value: Optional[float] = None
    normalized_value: Optional[float] = None
    # NOTE: target_text is free-form text, e.g. "≥80", so it must be str, not float
    target_text: Optional[str] = None
    target_numeric: Optional[float] = None
    evidence_source: Optional[str] = None
    owner_role: Optional[str] = None
    observed_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # from kpi_definition
    kpi_name: str
    unit: Optional[str] = None
    min_ideal: Optional[float] = None
    max_ideal: Optional[float] = None
    invert: Optional[bool] = None
    description: Optional[str] = None
    definition: Optional[str] = None
    example: Optional[str] = None
    iso_42001_clause: Optional[str] = None
    euaiact_clause: Optional[str] = None
    euaiact_chapter: Optional[str] = None
    euaiact_section: Optional[str] = None
    # Backward-compatible field names
    eu_ai_act_clause: Optional[str] = None
    eu_ai_act_chapter: Optional[str] = None
    iso_42001_chapter: Optional[str] = None
    coverage_category: Optional[str] = None
    regulatory_link: Optional[str] = None
    requirement_summary: Optional[str] = None

    # from evidence
    evidence_name: Optional[str] = None
    evidence_created_by: Optional[str] = None
    evidence_updated_at: Optional[datetime] = None


def get_conn() -> psycopg.Connection:
    return psycopg.connect(DB_URL, autocommit=False)


@router.get("/{project_slug}/kpis/{kpi_key}", response_model=KpiDetailResp)
def get_kpi_detail(
    project_slug: str,
    kpi_key: str,
    entity_id: UUID = Depends(get_entity_id_with_auth_viewer),
):
    """
    Return detailed info for a single KPI in a given project,
    joined from control_values + kpi_definition + evidence.

    We take the latest control_values row (by observed_at, then updated_at).
    If multiple evidence rows exist, this takes the one that happens to join first.
    Requires viewer role or higher.
    """
    sql = """
    SELECT
      cv.project_slug,
      cv.kpi_key,
      cv.raw_value,
      cv.normalized_pct AS normalized_value,
      cv.target_text,
      cv.target_numeric,
      cv.evidence_source,
      cv.owner_role,
      cv.observed_at,
      cv.updated_at,
      kd.kpi_name    AS kpi_name,
      kd.unit        AS unit,
      kd.min_ideal   AS min_ideal,
      kd.max_ideal   AS max_ideal,
      kd.invert      AS invert,
      kd.description AS description,
      kd.definition  AS definition,
      kd.example     AS example,
      kd.iso_42001_clause     AS iso_42001_clause,
      kd.euaiact_clause     AS euaiact_clause,
      kd.euaiact_chapter    AS euaiact_chapter,
      kd.euaiact_section    AS euaiact_section,
      kd.euaiact_clause     AS eu_ai_act_clause,
      kd.euaiact_chapter    AS eu_ai_act_chapter,
      kd.iso_42001_chapter    AS iso_42001_chapter,
      kd.coverage_category    AS coverage_category,
      kd.regulatory_link      AS regulatory_link,
      kd.requirement_summary  AS requirement_summary,
      e.name         AS evidence_name,
      e.created_by   AS evidence_created_by,
      e.updated_at   AS evidence_updated_at
    FROM public.control_values cv
    JOIN public.kpi_definition kd
      ON kd.kpi_key = cv.kpi_key
    LEFT JOIN public.evidence e
      ON e.control_id = cv.control_id
     AND e.project_slug = cv.project_slug
     AND e.entity_id = cv.entity_id
    WHERE cv.project_slug = %s
      AND cv.kpi_key = %s
      AND cv.entity_id = %s
    ORDER BY cv.observed_at DESC NULLS LAST,
             cv.updated_at DESC NULLS LAST
    LIMIT 1;
    """
    params = (project_slug, kpi_key, str(entity_id))

    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="KPI not found for this project")

    return KpiDetailResp(**row)
