# app/scorecard.py
from __future__ import annotations

"""
Scorecard API for LeadAI

This module exposes read + write endpoints used by the web app’s scorecard pages.

ENDPOINTS
---------
GET  /scorecard/{project_slug}
    Returns the complete scorecard payload:
      {
        project: { slug, name, target_threshold, ... },
        overall_pct: number,               # avg of pillar percentages (0..100)
        pillars: [{ key, name, score_pct, maturity }, ...],
        kpis:    [{
                   pillar,                 # display pillar from controls.pillar
                   key, name, unit, raw_value,
                   normalized_pct, kpi_score, updated_at
                 }, ...]
      }

GET  /scorecard/{project_slug}/pillars
    Returns the "effective" set of pillars for the project:
    - If any rows exist in pillar_overrides for the project, those rows are
      authoritative and are returned as-is (no mixing with calculated pillars).
    - If no overrides exist, pillars are derived by aggregating KPI normalized
      scores by controls.pillar found in control_values/controls.

GET  /scorecard/{project_slug}/controls
    Returns a flat list of KPI/control metadata for the project used by UI detail
    pages (owner_role, evidence_source, targets, normalized_pct, etc).

POST /scorecard/{project_slug}
    Upserts KPI raw values by *kpi_key* into control_values while computing
    normalized_pct using the corresponding bounds from controls. This endpoint is
    used by the Admin EditKpis UI. It accepts any of the following body shapes:

      A) {"scores":[{"key":"<kpi_key>", "value": <num>}], "options": {...}}
      B) {"scores":[{"key":"<kpi_key>", "raw_value": <num>}]}
      C) {"updates":[{"kpi_key":"<kpi_key>", "raw_value": <num>}], "options": {...}}

    Notes:
    - We resolve the control (controls.id) by matching controls.kpi_key.
    - normalized_pct is min-max normalized against controls.norm_min / norm_max
      and respects controls.higher_is_better. If bounds are missing or equal,
      we clamp raw_value directly into 0..100.
    - The control_values PK is (project_slug, control_id). We UPSERT on this key.

DESIGN RULES
------------
* Pillars:
  If pillar_overrides exist for a project, those rows define the pillar set and
  their scores/maturity. Otherwise, pillars are computed by aggregating KPI
  normalized scores grouped by the display pillar name from controls.pillar.

* KPIs:
  KPI rows originate from control_values joined with controls (to get pillar,
  names, units and normalization bounds).

* Schema:
  We do not create tables here—migrations own schema. `ensure_schema()` remains
  a no-op to preserve back-compat for older imports that call it.

TABLES (expected)
-----------------
projects(id text PK (uuid-as-text), slug text UNIQUE, name text, target_threshold float8, ...)
controls(id uuid PK, kpi_key text, name text, pillar text, unit text,
         norm_min float8, norm_max float8, higher_is_better bool, weight float8, ...)
control_values(project_slug text, control_id uuid FK->controls(id), kpi_key text,
               raw_value float8, normalized_pct float8, observed_at timestamptz,
               updated_at timestamptz, ... ; PRIMARY KEY (project_slug, control_id))
pillar_overrides(id text PK, project_id text FK->projects(id),
                 pillar_key varchar(60), pillar_name varchar(120) DEFAULT '',
                 score_pct float8, maturity int, updated_at timestamptz,
                 UNIQUE(project_id, pillar_key))
"""

import os
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

import asyncpg
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from pydantic import BaseModel, Field, conint

from app.dependencies import (
    get_current_user_id,
    get_entity_id_optional,
    get_entity_id_with_auth_editor,
)
from app.services.authorization import verify_entity_access
from app.services.audit_log import append_audit_event

from app.services.provenance_integration import (
    PROVENANCE_PILLAR_KEY,
    PROVENANCE_PILLAR_NAME,
    evaluate_project_provenance,
    upsert_manifest_facts,
)

router = APIRouter(prefix="/scorecard", tags=["scorecard"])

# ---- Configuration -----------------------------------------------------------
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://leadai:leadai@localhost:5432/leadai",
)
DEFAULT_TARGET_THRESHOLD = float(os.getenv("DEFAULT_TARGET_THRESHOLD", "0.80"))

# Import get_pool from db_async to avoid circular imports
from app.db_async import get_pool


# Back-compat shim so imports from admin.py keep working.
async def ensure_schema(_: asyncpg.Connection) -> None:
    return None


async def _log_audit(event_type: str, **kwargs) -> None:
    try:
        await append_audit_event(event_type=event_type, **kwargs)
    except Exception:
        # Avoid breaking scorecard flows on audit failures
        pass


# ---- Models ------------------------------------------------------------------
class ProjectOut(BaseModel):
    slug: str
    name: str
    risk_level: Optional[str] = None
    target_threshold: float
    priority: Optional[str] = None
    sponsor: Optional[str] = None
    owner: Optional[str] = None
    status: Optional[str] = None
    creation_date: Optional[date] = None
    update_date: Optional[datetime] = None


class PillarOut(BaseModel):
    key: str
    name: str
    score_pct: float
    maturity: int
    # NEW: expose weight for UI (fraction 0..1) and a precomputed percent 0..100
    weight: Optional[float] = None
    pillar_weight_pct: Optional[float] = None


class KPIOut(BaseModel):
    pillar: Optional[str]
    key: str
    name: str
    unit: Optional[str] = None
    raw_value: Optional[float] = None
    normalized_pct: Optional[float] = None
    kpi_score: Optional[float] = None
    updated_at: Optional[datetime] = None

    # update: enrichment fields (line up with control_values + frontend)
    owner_role: Optional[str] = None
    owner: Optional[str] = None   # alias so UI can use either
    target_text: Optional[str] = None
    target_numeric: Optional[float] = None
    current_value: Optional[float] = None
    evidence_source: Optional[str] = None
    as_of: Optional[datetime] = None


class ProvenanceFieldOut(BaseModel):
    field: str
    level: str
    reasons: List[Dict[str, Any]] = []


class ProvenanceGateOut(BaseModel):
    gate_id: str
    forced_level: str
    reasons: List[Dict[str, Any]] = []


class ProvenanceOut(BaseModel):
    overall_level: str
    overall_score_pct: float
    fields: List[ProvenanceFieldOut]
    gates: List[ProvenanceGateOut]
    evaluated_at: Optional[str] = None
    rules_version: Optional[str] = None
    rules_hash: Optional[str] = None


class ScorecardOut(BaseModel):
    project: ProjectOut
    overall_pct: float
    pillars: List[PillarOut]
    kpis: List[KPIOut]
    provenance: Optional[ProvenanceOut] = None
    provenance_score_pct: Optional[float] = None

class PillarWeightItem(BaseModel):
    id: Optional[str] = None          # optional override row id
    pillar_key: str
    weight: float                     # fraction 0..1

class PillarWeightsIn(BaseModel):
    items: List[PillarWeightItem]
    
# ---- Helpers -----------------------------------------------------------------
def clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def clamp100(x: float) -> float:
    return 0.0 if x < 0 else 100.0 if x > 100 else x


def maturity_from_score(s: float) -> int:
    return 5 if s >= 85 else 4 if s >= 70 else 3 if s >= 55 else 2 if s >= 40 else 1


def _provenance_eval_to_out(eval_result) -> ProvenanceOut:
    fields = [
        ProvenanceFieldOut(
            field=item.get("field", ""),
            level=item.get("level", "P0"),
            reasons=item.get("reasons") or [],
        )
        for item in (eval_result.fields or [])
    ]
    gates = [
        ProvenanceGateOut(
            gate_id=item.get("gate_id", ""),
            forced_level=item.get("forced_level", "P0"),
            reasons=item.get("reasons") or [],
        )
        for item in (eval_result.gates or [])
    ]
    return ProvenanceOut(
        overall_level=eval_result.overall_level,
        overall_score_pct=eval_result.overall_score_pct,
        fields=fields,
        gates=gates,
        evaluated_at=eval_result.evaluated_at,
        rules_version=eval_result.rules_version,
        rules_hash=eval_result.rules_hash,
    )


def _apply_provenance_pillar(
    pillars: List[PillarOut],
    score_pct: float,
    has_override: bool,
) -> List[PillarOut]:
    if has_override:
        return pillars

    cleaned = [
        p
        for p in pillars
        if not (
            (p.key or "").upper() == PROVENANCE_PILLAR_KEY
            or (p.name or "").strip().lower() == PROVENANCE_PILLAR_NAME.lower()
        )
    ]
    cleaned.append(
        PillarOut(
            key=PROVENANCE_PILLAR_KEY,
            name=PROVENANCE_PILLAR_NAME,
            score_pct=score_pct,
            maturity=maturity_from_score(score_pct),
        )
    )
    return cleaned


def normalize(min_v: Optional[float], max_v: Optional[float], hib: bool, raw: float) -> float:
    """Min-max normalize raw to 0..100 using control definition bounds."""
    if min_v is None or max_v is None or max_v == min_v:
        return clamp100(raw)
    if hib:
        pct01 = (raw - min_v) / (max_v - min_v)
    else:
        pct01 = (max_v - raw) / (max_v - min_v)
    return clamp100(round(clamp01(pct01) * 100, 2))


def _row_to_project_out(row: asyncpg.Record) -> ProjectOut:
    priority = row.get("priority") or row.get("risk_level")
    return ProjectOut(
        slug=row["slug"],
        name=row["name"],
        risk_level=row.get("risk_level"),
        target_threshold=row["target_threshold"],
        priority=priority,
        sponsor=row.get("sponsor"),
        owner=row.get("owner"),
        status=row.get("status"),
        creation_date=row.get("creation_date"),
        update_date=row.get("update_date"),
    )


async def _raise_if_archived(
    conn: asyncpg.Connection,
    slug: str,
    entity_id: Optional[UUID] = None,
) -> None:
    if entity_id:
        row = await conn.fetchrow(
            "SELECT is_archived FROM entity_projects WHERE slug = $1 AND entity_id = $2",
            slug,
            entity_id,
        )
    else:
        row = await conn.fetchrow(
            "SELECT is_archived FROM entity_projects WHERE slug = $1",
            slug,
        )
    if row and row.get("is_archived"):
        raise HTTPException(status_code=410, detail="Project is archived")


async def _resolve_entity_id_for_project(
    conn: asyncpg.Connection,
    slug: str,
    user_id: UUID,
) -> Optional[UUID]:
    def _is_master_admin(user_id: UUID) -> bool:
        raw = os.environ.get("MASTER_ADMIN_USER_IDS", "").strip()
        if not raw:
            return False
        try:
            allowed = [UUID(x.strip()) for x in raw.split(",") if x.strip()]
            return user_id in allowed
        except (ValueError, TypeError):
            return False

    if _is_master_admin(user_id):
        rows = await conn.fetch(
            """
            SELECT DISTINCT entity_id
            FROM entity_projects
            WHERE slug = $1
            """,
            slug,
        )
        if not rows:
            return None
        if len(rows) > 1:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Project slug is not unique across entities. "
                    "Please specify entity_id."
                ),
            )
        return rows[0]["entity_id"]

    rows = await conn.fetch(
        """
        SELECT p.entity_id
        FROM entity_projects p
        JOIN user_entity_access uea ON uea.entity_id = p.entity_id
        WHERE p.slug = $1 AND uea.user_id = $2
        ORDER BY uea.created_at NULLS LAST
        """,
        slug,
        user_id,
    )
    if not rows:
        return None
    if len(rows) > 1:
        raise HTTPException(
            status_code=409,
            detail=(
                "Project slug is not unique across your entities. "
                "Please specify entity_id."
            ),
        )
    return rows[0]["entity_id"]


async def get_project_out_or_none(conn: asyncpg.Connection, slug: str, entity_id: Optional[UUID] = None) -> Optional[ProjectOut]:
    if entity_id:
        row = await conn.fetchrow(
            """
            SELECT slug, name, risk_level, target_threshold, priority, sponsor, owner, status,
                   creation_date, update_date
            FROM entity_projects
            WHERE slug = $1 AND entity_id = $2 AND is_archived IS NOT TRUE
            """,
            slug, entity_id,
        )
    else:
        row = await conn.fetchrow(
            """
            SELECT slug, name, risk_level, target_threshold, priority, sponsor, owner, status,
                   creation_date, update_date
            FROM entity_projects
            WHERE slug = $1 AND is_archived IS NOT TRUE
            """,
            slug,
        )
    if not row:
        await _raise_if_archived(conn, slug, entity_id)
    return _row_to_project_out(row) if row else None


async def ensure_project(conn: asyncpg.Connection, slug: str) -> ProjectOut:
    archived = await conn.fetchrow(
        "SELECT slug FROM entity_projects WHERE slug = $1 AND is_archived IS TRUE",
        slug,
    )
    if archived:
        raise HTTPException(status_code=410, detail="Project is archived")
    row = await conn.fetchrow(
        """
        SELECT slug, name, risk_level, target_threshold, priority, sponsor, owner, status,
               creation_date, update_date
        FROM entity_projects
        WHERE slug = $1 AND is_archived IS NOT TRUE
        """,
        slug,
    )
    if not row:
        await conn.execute(
            """
            INSERT INTO entity_projects (id, slug, name, risk_level, target_threshold, priority,
                                  sponsor, owner, status, creation_date, update_date)
            VALUES (gen_random_uuid()::text, $1, $1, 'low', $2, 'low', NULL, NULL, 'Planned', CURRENT_DATE, NOW())
            ON CONFLICT (slug) DO NOTHING
            """,
            slug, DEFAULT_TARGET_THRESHOLD
        )
        row = await conn.fetchrow(
            """
            SELECT slug, name, risk_level, target_threshold, priority, sponsor, owner, status,
                   creation_date, update_date
            FROM entity_projects
            WHERE slug = $1 AND is_archived IS NOT TRUE
            """,
            slug,
        )
    return _row_to_project_out(row)


async def get_project_id_by_slug(conn: asyncpg.Connection, slug: str, entity_id: Optional[UUID] = None) -> str:
    if entity_id:
        row = await conn.fetchrow(
            "SELECT id FROM entity_projects WHERE slug=$1 AND entity_id=$2 AND is_archived IS NOT TRUE",
            slug,
            entity_id,
        )
    else:
        row = await conn.fetchrow(
            "SELECT id FROM entity_projects WHERE slug=$1 AND is_archived IS NOT TRUE",
            slug,
        )
    if not row:
        await _raise_if_archived(conn, slug, entity_id)
        raise HTTPException(status_code=404, detail=f"Project '{slug}' not found")
    return row["id"]


# ---- KPI / Pillar loading ----------------------------------------------------
async def _load_kpis_for_project(conn: asyncpg.Connection, project_slug: str, entity_id: Optional[UUID] = None) -> List[KPIOut]:
    if entity_id:
        rows = await conn.fetch(
            """
            SELECT
              COALESCE(c.pillar, '')                AS pillar_from_def,
              COALESCE(c.kpi_key, v.kpi_key)        AS kpi_key,
              COALESCE(c.name, c.kpi_key, v.kpi_key, '') AS control_name,
              c.unit                                AS unit,
              c.norm_min                            AS norm_min,
              c.norm_max                            AS norm_max,
              c.higher_is_better                    AS higher_is_better,
              
              v.raw_value                           AS raw_value,
              v.normalized_pct                      AS normalized_pct,
              v.kpi_score                           AS kpi_score,
              v.updated_at                          AS updated_at,

              -- NEW: enrichment columns from control_values
              v.owner_role                          AS owner_role,
              v.evidence_source                     AS evidence_source,
              v.target_text                         AS target_text,
              v.target_numeric                      AS target_numeric,
              v.current_value                       AS current_value,
              COALESCE(v.observed_at, v.updated_at) AS as_of
            FROM control_values v
            LEFT JOIN controls c ON c.id = v.control_id
            WHERE v.project_slug = $1 AND v.entity_id = $2
            ORDER BY c.pillar NULLS LAST, COALESCE(c.kpi_key, v.kpi_key)
            """,
            project_slug, entity_id,
        )
    else:
        rows = await conn.fetch(
            """
            SELECT
              COALESCE(c.pillar, '')                AS pillar_from_def,
              COALESCE(c.kpi_key, v.kpi_key)        AS kpi_key,
              COALESCE(c.name, c.kpi_key, v.kpi_key, '') AS control_name,
              c.unit                                AS unit,
              c.norm_min                            AS norm_min,
              c.norm_max                            AS norm_max,
              c.higher_is_better                    AS higher_is_better,
              
              v.raw_value                           AS raw_value,
              v.normalized_pct                      AS normalized_pct,
              v.kpi_score                           AS kpi_score,
              v.updated_at                          AS updated_at,

              -- NEW: enrichment columns from control_values
              v.owner_role                          AS owner_role,
              v.evidence_source                     AS evidence_source,
              v.target_text                         AS target_text,
              v.target_numeric                      AS target_numeric,
              v.current_value                       AS current_value,
              COALESCE(v.observed_at, v.updated_at) AS as_of
            FROM control_values v
            LEFT JOIN controls c ON c.id = v.control_id
            WHERE v.project_slug = $1
            ORDER BY c.pillar NULLS LAST, COALESCE(c.kpi_key, v.kpi_key)
            """,
            project_slug,
        )

    out: List[KPIOut] = []
    for r in rows:
        norm = r["normalized_pct"]
        if norm is None and r["raw_value"] is not None:
            norm = normalize(
                r["norm_min"], r["norm_max"],
                True if r["higher_is_better"] is None else bool(r["higher_is_better"]),
                float(r["raw_value"]),
            )
        out.append(
            KPIOut(
                pillar=(r["pillar_from_def"] or None),
                key=str(r["kpi_key"] or ""),
                name=str(r["control_name"] or "") or str(r["kpi_key"] or ""),
                unit=r["unit"],
                raw_value=float(r["raw_value"]) if r["raw_value"] is not None else None,
                normalized_pct=float(norm) if norm is not None else None,
                kpi_score=float(r["kpi_score"]) if r["kpi_score"] is not None else None,
                updated_at=r["updated_at"],
                # NEW: enrichment
                owner_role=r["owner_role"],
                owner=r["owner_role"],  # alias for convenience
                target_text=r["target_text"],
                target_numeric=(
                    float(r["target_numeric"])
                    if r["target_numeric"] is not None
                    else None
                ),
                current_value=(
                    float(r["current_value"])
                    if r["current_value"] is not None
                    else None
                ),
                evidence_source=r["evidence_source"],
                as_of=r["as_of"],
            )
        )
    return out


async def _load_overrides(conn: asyncpg.Connection, project_slug: str, entity_id: Optional[UUID] = None) -> List[PillarOut]:
    """
    Load explicit pillar overrides. If any rows are present for the project, they
    *fully* define the pillar list and scores.
    """
    if entity_id:
        rows = await conn.fetch(
            """
            SELECT
              po.pillar_key,
              COALESCE(NULLIF(po.pillar_name, ''), po.pillar_key) AS pillar_name,
              po.score_pct,
              po.maturity,
              po.weight
            FROM pillar_overrides po
            JOIN entity_projects p ON p.id = po.project_id
            WHERE p.slug = $1 AND po.entity_id = $2
            ORDER BY po.pillar_key
            """,
            project_slug, entity_id,
        )
    else:
        rows = await conn.fetch(
            """
            SELECT
              po.pillar_key,
              COALESCE(NULLIF(po.pillar_name, ''), po.pillar_key) AS pillar_name,
              po.score_pct,
              po.maturity,
              po.weight
            FROM pillar_overrides po
            JOIN entity_projects p ON p.id = po.project_id
            WHERE p.slug = $1
            ORDER BY po.pillar_key
            """,
            project_slug,
        )
    pillars: List[PillarOut] = []
    for r in rows:
        score = float(r["score_pct"]) if r["score_pct"] is not None else 0.0
        mat = int(r["maturity"]) if r["maturity"] is not None else maturity_from_score(score)
        w = float(r["weight"]) if r["weight"] is not None else None  # fraction 0..1
        pillars.append(
            PillarOut(
                key=str(r["pillar_key"]),
                name=str(r["pillar_name"]),
                score_pct=score,
                maturity=mat,
                weight=w,
                pillar_weight_pct=round(w * 100.0, 2) if w is not None else None,
            )
        )
    return pillars


async def _aggregate_pillars_from_kpis(kpis: List[KPIOut]) -> List[PillarOut]:
    """
    Fall back aggregation when there are no overrides:
    group KPIs by controls.pillar and average the score used for display.
    Prefer kpi_score (target-attainment) when present so the pillar matches the
    "KPI Score" column; otherwise use normalized_pct (min-max from control bounds).
    """
    if not kpis:
        return []
    sums: Dict[str, Tuple[float, float]] = {}  # pillar_name -> (sum_w, sum_w*score)
    for k in kpis:
        pillar = (k.pillar or "Unassigned").strip() or "Unassigned"
        w = 1.0
        # Use kpi_score when available (matches UI "KPI Score" column); else normalized_pct
        score = k.kpi_score if k.kpi_score is not None else k.normalized_pct
        score = (score or 0.0)
        sw, sn = sums.get(pillar, (0.0, 0.0))
        sums[pillar] = (sw + w, sn + w * score)

    out: List[PillarOut] = []
    for name, (sw, sn) in sums.items():
        pct = round((sn / sw) if sw > 0 else 0.0, 2)
        out.append(
            PillarOut(
                key=name,
                name=name,
                score_pct=pct,
                maturity=maturity_from_score(pct),
                # weight and pillar_weight_pct intentionally None in fallback mode
            )
        )
    out.sort(key=lambda x: x.name)
    return out


async def _persist_calculated_pillar_scores(
    conn: asyncpg.Connection,
    project_slug: str,
    entity_id: Optional[UUID],
    pillars: List[PillarOut],
) -> None:
    if not entity_id or not pillars:
        return

    cols = await conn.fetch(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pillar_overrides'
        """
    )
    col_names = {r["column_name"] for r in cols}
    if "calculated_score" not in col_names:
        return

    constraints = await conn.fetch(
        """
        SELECT
          tc.constraint_name,
          array_agg(kcu.column_name ORDER BY kcu.ordinal_position) AS cols
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
         AND tc.table_name = kcu.table_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'pillar_overrides'
          AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
        GROUP BY tc.constraint_name
        """
    )

    def _quote_ident(name: str) -> str:
        safe = name.replace('"', '""')
        return f'"{safe}"'

    conflict_constraint = None
    for row in constraints:
        if row["cols"] == ["entity_id", "project_id", "pillar_key"]:
            conflict_constraint = row["constraint_name"]
            break
    if not conflict_constraint:
        for row in constraints:
            if row["cols"] == ["project_id", "pillar_key"]:
                conflict_constraint = row["constraint_name"]
                break
    if not conflict_constraint:
        return

    proj_row = await conn.fetchrow(
        """
        SELECT id
        FROM entity_projects
        WHERE slug = $1 AND entity_id = $2
        """,
        project_slug,
        entity_id,
    )
    if not proj_row:
        return
    project_id = proj_row["id"]

    pillar_rows = await conn.fetch("SELECT key, name, weight FROM pillars")
    by_name = {
        (row["name"] or "").strip().lower(): row for row in pillar_rows
    }

    updates: List[tuple] = []
    for p in pillars:
        pillar_name = (p.name or p.key or "").strip()
        if not pillar_name:
            continue
        match = by_name.get(pillar_name.lower())
        if not match:
            continue
        weight = (
            float(match["weight"])
            if match["weight"] is not None
            else 1.0
        )
        updates.append(
            (
                project_id,
                entity_id,
                match["key"],
                match["name"] or pillar_name,
                weight,
                float(p.score_pct) if p.score_pct is not None else 0.0,
            )
        )

    if not updates:
        return

    await conn.executemany(
        """
        INSERT INTO pillar_overrides (
          id, entity_id, project_id, pillar_key, pillar_name, weight, calculated_score, updated_at
        )
        VALUES (
          gen_random_uuid()::text, $2, $1, $3, $4, $5, $6, NOW()
        )
        ON CONFLICT ON CONSTRAINT {conflict_constraint}
        DO UPDATE SET
          calculated_score = EXCLUDED.calculated_score,
          updated_at = NOW()
        WHERE pillar_overrides.calculated_score IS DISTINCT FROM EXCLUDED.calculated_score
        """.format(conflict_constraint=_quote_ident(conflict_constraint)),
        updates,
    )


async def load_scorecard(
    conn: asyncpg.Connection,
    project_slug: str,
    project: Optional[ProjectOut] = None,
    provenance_eval: Optional[Any] = None,
    entity_id: Optional[UUID] = None,
) -> ScorecardOut:
    if project is None:
        project = await get_project_out_or_none(conn, project_slug, entity_id)
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")

    kpis = await _load_kpis_for_project(conn, project_slug, entity_id)
    # Always compute pillars from KPIs; ignore pillar_overrides
    pillars = await _aggregate_pillars_from_kpis(kpis)

    # Do not include Provenance as a pillar in the scorecard.
    pillars = [
        p
        for p in pillars
        if not (
            (p.key or "").upper() == PROVENANCE_PILLAR_KEY
            or (p.name or "").strip().lower() == PROVENANCE_PILLAR_NAME.lower()
        )
    ]
    provenance_score_pct = None
    provenance_out = None
    if provenance_eval is not None:
        provenance_score_pct = provenance_eval.overall_score_pct
        provenance_out = _provenance_eval_to_out(provenance_eval)
    overall = round(sum(p.score_pct for p in pillars) / len(pillars), 2) if pillars else 0.0

    return ScorecardOut(
        project=project,
        overall_pct=overall,
        pillars=pillars,
        kpis=kpis,
        provenance=provenance_out,
        provenance_score_pct=provenance_score_pct,
    )


# ---- Public Endpoints (GET) --------------------------------------------------
@router.get("/{project_slug}", response_model=ScorecardOut)
async def get_scorecard(
    project_slug: str,
    as_of: Optional[datetime] = Query(None),
    entity_id: Optional[UUID] = Depends(get_entity_id_optional),
    user_id: UUID = Depends(get_current_user_id),
) -> ScorecardOut:
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            if entity_id is not None:
                await verify_entity_access(user_id, entity_id, required_role="viewer")
            resolved_entity_id = entity_id
            project = await get_project_out_or_none(conn, project_slug, resolved_entity_id)
            if project is None:
                if resolved_entity_id is None:
                    resolved_entity_id = await _resolve_entity_id_for_project(
                        conn, project_slug, user_id
                    )
                    if resolved_entity_id is not None:
                        project = await get_project_out_or_none(
                            conn, project_slug, resolved_entity_id
                        )
                if project is None:
                    raise HTTPException(status_code=404, detail="Project not found")
            provenance_eval = None
            try:
                provenance_eval = await evaluate_project_provenance(
                    conn,
                    project_slug,
                    entity_id=resolved_entity_id,
                )
            except Exception:
                provenance_eval = None
            return await load_scorecard(
                conn,
                project_slug,
                project=project,
                provenance_eval=provenance_eval,
                entity_id=resolved_entity_id,
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load scorecard: {e}")


@router.get("/{project_slug}/pillars", response_model=List[PillarOut])
async def get_pillars(
    project_slug: str,
    entity_id: Optional[UUID] = Depends(get_entity_id_optional),
    user_id: UUID = Depends(get_current_user_id),
) -> List[PillarOut]:
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            if entity_id is not None:
                await verify_entity_access(user_id, entity_id, required_role="viewer")
            resolved_entity_id = entity_id
            project = await get_project_out_or_none(conn, project_slug, resolved_entity_id)
            if project is None:
                if resolved_entity_id is None:
                    resolved_entity_id = await _resolve_entity_id_for_project(
                        conn, project_slug, user_id
                    )
                    if resolved_entity_id is not None:
                        project = await get_project_out_or_none(
                            conn, project_slug, resolved_entity_id
                        )
                if project is None:
                    raise HTTPException(status_code=404, detail="Project not found")

            # Always compute pillars from KPIs; ignore pillar_overrides
            kpis = await _load_kpis_for_project(
                conn,
                project_slug,
                resolved_entity_id,
            )
            pillars = await _aggregate_pillars_from_kpis(kpis)
            await _persist_calculated_pillar_scores(
                conn,
                project_slug,
                resolved_entity_id,
                pillars,
            )
            return pillars
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load pillars: {e}")


@router.get("/{project_slug}/controls")
async def get_project_controls(
    project_slug: str,
    entity_id: Optional[UUID] = Depends(get_entity_id_optional),
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """
    Return per-project control values in a shape the UI can render directly.
    """
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            if entity_id is not None:
                await verify_entity_access(user_id, entity_id, required_role="viewer")
            resolved_entity_id = entity_id
            project = await get_project_out_or_none(conn, project_slug, resolved_entity_id)
            if project is None:
                if resolved_entity_id is None:
                    resolved_entity_id = await _resolve_entity_id_for_project(
                        conn, project_slug, user_id
                    )
                    if resolved_entity_id is not None:
                        project = await get_project_out_or_none(
                            conn, project_slug, resolved_entity_id
                        )
                if project is None:
                    raise HTTPException(status_code=404, detail="Project not found")

            rows = await conn.fetch(
                """
                SELECT
                  v.kpi_key                                  AS kpi_key,
                  v.control_id                                AS control_id,
                  COALESCE(NULLIF(c.name, ''), c.kpi_key)     AS control_name,
                  c.pillar                                    AS pillar,
                  c.unit                                      AS unit,

                  v.raw_value                                 AS raw_value,
                  v.normalized_pct                            AS normalized_pct,
                  v.updated_at                                AS updated_at,
                  v.observed_at                               AS observed_at,

                  -- optional enrichment columns (if present)
                  v.owner_role                                AS owner_role,
                  v.evidence_source                           AS evidence_source,
                  v.target_numeric                            AS target_numeric,
                  v.target_text                               AS target_text,
                  v.current_value                             AS current_value,
                  v.kpi_score                                 AS kpi_score
                FROM control_values v
                LEFT JOIN controls c ON c.id = v.control_id
                WHERE v.project_slug = $1 AND v.entity_id = $2
                ORDER BY COALESCE(c.kpi_key, v.kpi_key)
                """,
                project_slug, resolved_entity_id,
            )
            items: List[Dict[str, Any]] = []
            for r in rows:
                # Target: prefer text, else numeric
                if r["target_text"] is not None and str(r["target_text"]).strip() != "":
                    target = r["target_text"]
                else:
                    target = float(r["target_numeric"]) if r["target_numeric"] is not None else None

                # Current value: prefer explicit, else raw_value, else normalized_pct
                if r["current_value"] is not None and str(r["current_value"]).strip() != "":
                    cur_val = r["current_value"]
                elif r["raw_value"] is not None:
                    cur_val = float(r["raw_value"])
                elif r["normalized_pct"] is not None:
                    cur_val = float(r["normalized_pct"])
                else:
                    cur_val = None

                # As-of timestamp: prefer observed_at, else updated_at
                as_of = r["observed_at"] or r["updated_at"]

                items.append(
                    {
                        # keys
                        "kpi_key": r["kpi_key"],
                        "control_id": str(r["control_id"]) if r["control_id"] is not None else None,

                        # UI columns
                        "control_name": (r["control_name"] or "") if r["control_name"] is not None else "",
                        "owner_role": r["owner_role"],
                        "target": target,
                        "current_value": cur_val,
                        "as_of": as_of.isoformat() if as_of else None,

                        # extras kept for client use
                        "pillar": r["pillar"],
                        "unit": r["unit"],
                        "evidence_source": r["evidence_source"],
                        "kpi_score": float(r["kpi_score"]) if r["kpi_score"] is not None else None,
                        "raw_value": float(r["raw_value"]) if r["raw_value"] is not None else None,
                        "normalized_pct": float(r["normalized_pct"]) if r["normalized_pct"] is not None else None,
                        "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
                        "observed_at": r["observed_at"].isoformat() if r["observed_at"] else None,
                        "target_text": r["target_text"],
                        "target_numeric": float(r["target_numeric"]) if r["target_numeric"] is not None else None,
                    }
                )

            return {"items": items}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load controls: {e}")


# ---- POST : update pillar weights BEGIN
@router.put("/{project_slug}/pillar_weights")
async def put_pillar_weights(
    project_slug: str,
    body: PillarWeightsIn,
    entity_id: UUID = Depends(get_entity_id_with_auth_editor),
):
    """
    Upsert pillar_overrides.weight (fraction 0..1) for the given project+pillar_key.
    If a row doesn't exist, insert it; if it exists, update weight and updated_at.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Verify project belongs to entity (entity_id is already validated by authorization)
        proj = await conn.fetchrow(
            "SELECT id FROM entity_projects WHERE slug=$1 AND entity_id=$2 AND is_archived IS NOT TRUE",
            project_slug,
            entity_id,
        )
        if not proj:
            await _raise_if_archived(conn, project_slug, entity_id)
            raise HTTPException(status_code=404, detail="Project not found")
        project_id = proj["id"]

        updated = 0
        for it in body.items:
            w = float(it.weight)
            if w < 0:
                w = 0.0
            if w > 1:
                w = 1.0

            # 👇 note the ::varchar(60) casts on EVERY use of $2
            await conn.execute(
                """
                INSERT INTO pillar_overrides (
                  id, entity_id, project_id, pillar_key, pillar_name, weight, updated_at
                )
                VALUES (
                  COALESCE($5, gen_random_uuid()::text),
                  $1,
                  $2,
                  $3::varchar(60),
                  COALESCE(
                    (SELECT name FROM pillars WHERE key = $3::varchar(60) LIMIT 1),
                    $3::varchar(60)
                  ),
                  $4,
                  NOW()
                )
                ON CONFLICT (entity_id, project_id, pillar_key)
                DO UPDATE SET
                  weight = EXCLUDED.weight,
                  updated_at = NOW()
                """,
                entity_id, project_id, it.pillar_key, w, it.id
            )
            updated += 1

        return {"ok": True, "updated": updated}



# ---- POST : update pillar weights END

# ---- Public Endpoint (POST) : upsert KPI values ------------------------------
@router.post("/{project_slug}")
async def post_update_scores(
    project_slug: str,
    request: Request,
    entity_id: UUID = Depends(get_entity_id_with_auth_editor),
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """
    Upserts KPI values for a project by kpi_key, computing normalized_pct from controls bounds.
    """
    body = await request.json()
    manifest_facts = body.get("manifest_facts")
    if manifest_facts is not None and not isinstance(manifest_facts, dict):
        raise HTTPException(
            status_code=422,
            detail="manifest_facts must be a JSON object",
        )
    pairs: List[Tuple[str, float]] = []

    # A / B
    if isinstance(body.get("scores"), list):
        for item in body["scores"]:
            if not isinstance(item, dict):
                continue
            key = item.get("key")
            if key is None:
                continue
            raw = item.get("value", item.get("raw_value"))
            if raw is None:
                continue
            try:
                raw_f = float(raw)
            except Exception:
                continue
            pairs.append((str(key), raw_f))

    # C
    if isinstance(body.get("updates"), list):
        for item in body["updates"]:
            if not isinstance(item, dict):
                continue
            key = item.get("kpi_key") or item.get("key")
            raw = item.get("raw_value", item.get("value"))
            if key is None or raw is None:
                continue
            try:
                raw_f = float(raw)
            except Exception:
                continue
            pairs.append((str(key), raw_f))

    if not pairs and manifest_facts is None:
        raise HTTPException(status_code=400, detail="No valid KPI updates provided")

    pool = await get_pool()
    async with pool.acquire() as conn:
        proj = await get_project_out_or_none(conn, project_slug, entity_id)
        if proj is None:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Verify project belongs to entity (entity_id is already validated by authorization)
        proj_check = await conn.fetchrow(
            "SELECT id FROM entity_projects WHERE slug=$1 AND entity_id=$2 AND is_archived IS NOT TRUE",
            project_slug,
            entity_id,
        )
        if not proj_check:
                raise HTTPException(status_code=404, detail="Project not found or missing entity_id")

        details: List[Dict[str, Any]] = []
        updated = 0

        for kpi_key, raw_value in pairs:
            cdef = await conn.fetchrow(
                """
                SELECT id,
                       norm_min,
                       norm_max,
                       higher_is_better,
                       unit,
                       target_text,
                       target_numeric,
                       evidence_source,
                       owner_role,
                       frequency
                FROM controls
                WHERE kpi_key = $1
                LIMIT 1
                """,
                kpi_key,
            )
            if not cdef:
                raise HTTPException(status_code=404, detail=f"Unknown KPI key '{kpi_key}'")

            control_id = cdef["id"]
            norm = normalize(
                float(cdef["norm_min"]) if cdef["norm_min"] is not None else None,
                float(cdef["norm_max"]) if cdef["norm_max"] is not None else None,
                True if cdef["higher_is_better"] is None else bool(cdef["higher_is_better"]),
                float(raw_value),
            )

            await conn.execute(
                """
                INSERT INTO control_values (
                  entity_id, project_slug, control_id, kpi_key, raw_value, normalized_pct, updated_at,
                  unit, target_text, target_numeric, evidence_source, owner_role, frequency
                )
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, $11, $12)
                ON CONFLICT (project_slug, control_id)
                DO UPDATE SET
                  kpi_key        = EXCLUDED.kpi_key,
                  raw_value      = EXCLUDED.raw_value,
                  normalized_pct = EXCLUDED.normalized_pct,
                  updated_at     = NOW(),
                  unit           = COALESCE(control_values.unit, EXCLUDED.unit),
                  target_text    = COALESCE(control_values.target_text, EXCLUDED.target_text),
                  target_numeric = COALESCE(control_values.target_numeric, EXCLUDED.target_numeric),
                  evidence_source= COALESCE(control_values.evidence_source, EXCLUDED.evidence_source),
                  owner_role     = COALESCE(control_values.owner_role, EXCLUDED.owner_role),
                  frequency      = COALESCE(control_values.frequency, EXCLUDED.frequency)
                """,
                entity_id,
                project_slug,
                control_id,
                kpi_key,
                float(raw_value),
                float(norm),
                cdef["unit"],
                cdef["target_text"],
                cdef["target_numeric"],
                cdef["evidence_source"],
                cdef["owner_role"],
                cdef["frequency"],
            )
            updated += 1
            details.append({"key": kpi_key, "raw_value": float(raw_value), "normalized_pct": float(norm)})

        # Invalidate LLM report cache for this project since KPI data changed
        try:
            from app.services.llm_report_cache import invalidate_cache_async
            await invalidate_cache_async(project_slug)
        except Exception as exc:
            # Don't fail the request if cache invalidation fails
            print(f"Warning: Failed to invalidate LLM report cache for {project_slug}: {exc}")

        if manifest_facts is not None:
            await upsert_manifest_facts(conn, project_slug, manifest_facts, entity_id)

        provenance_out = None
        provenance_score_pct = None
        provenance_error = None
        try:
            provenance_eval = await evaluate_project_provenance(
                conn,
                project_slug,
                manifest_facts=manifest_facts,
                force_recompute=True,
                entity_id=entity_id,
            )
            provenance_out = _provenance_eval_to_out(provenance_eval).dict()
            provenance_score_pct = provenance_eval.overall_score_pct
        except Exception as exc:
            provenance_error = str(exc)

        await _log_audit(
            event_type="kpi_values.upsert",
            actor=str(user_id),
            actor_type="user",
            source_service="core-svc",
            object_type="project",
            object_id=project_slug,
            project_slug=project_slug,
            details={
                "entity_id": str(entity_id),
                "updated": updated,
                "items": details,
            },
        )

        return {
            "ok": True,
            "updated": updated,
            "details": details,
            "provenance": provenance_out,
            "provenance_score_pct": provenance_score_pct,
            "provenance_error": provenance_error,
        }
        
