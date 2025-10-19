# app/scorecard.py
from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import asyncpg
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, conint

router = APIRouter(prefix="/scorecard", tags=["scorecard"])

# ---- Configuration ----
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    # asyncpg expects "postgresql://"
    "postgresql://leadai:leadai@localhost:5432/leadai",
)
DEFAULT_TARGET_THRESHOLD = float(os.getenv("DEFAULT_TARGET_THRESHOLD", "0.75"))

# Optional fallback mapping for pillar labels if not present in control definitions
PILLAR_OF: Dict[str, str] = {
    "velocity": "Delivery",
    "cycle_time_days": "Delivery",
    "deployment_freq": "Delivery",
    "lead_time_days": "Delivery",
    "defect_rate": "Quality",
    "change_fail_rate": "Quality",
}

# ---- DB Pool (lazily created) ----
_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        url = DATABASE_URL.replace("+asyncpg", "")  # ensure asyncpg DSN
        _pool = await asyncpg.create_pool(dsn=url, min_size=1, max_size=10)
    return _pool


# ---- Schema bootstrap (ONLY for local demo tables) ----
# IMPORTANT: We no longer create `projects` or `pillar_overrides` here.
# Those are Alembic/ORM-managed in your normalized schema.
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS controls (
  control_id          TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  pillar              TEXT,
  unit                TEXT,
  norm_min            DOUBLE PRECISION,
  norm_max            DOUBLE PRECISION,
  higher_is_better    BOOLEAN NOT NULL DEFAULT TRUE,
  weight              DOUBLE PRECISION NOT NULL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS control_values (
  project_slug        TEXT NOT NULL,
  control_id          TEXT NOT NULL,
  raw_value           DOUBLE PRECISION,
  normalized_pct      DOUBLE PRECISION,
  observed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_slug, control_id),
  FOREIGN KEY (control_id) REFERENCES controls(control_id) ON DELETE CASCADE
);
"""


async def ensure_schema(conn: asyncpg.Connection) -> None:
    # Only ensure local demo KPI tables if you still use them.
    # Does NOT touch `projects` or `pillar_overrides`.
    await conn.execute(SCHEMA_SQL)


# ---- Pydantic shapes ----
class ProjectOut(BaseModel):
    slug: str
    name: str
    risk_level: Optional[str] = None
    target_threshold: float


class PillarOut(BaseModel):
    pillar: str
    score_pct: float
    weight: float = 1.0
    maturity: int = 1


class KPIOut(BaseModel):
    pillar: Optional[str]
    key: str
    name: str
    unit: Optional[str]
    raw_value: Optional[float]
    normalized_pct: float
    updated_at: Optional[datetime]


class ScorecardOut(BaseModel):
    project: ProjectOut
    overall_pct: float
    pillars: List[PillarOut]
    kpis: List[KPIOut]


class ControlScore(BaseModel):
    control_id: str
    score: float  # raw score coming from UI (we'll normalize)


class PostScoresBody(BaseModel):
    project_id: Optional[str] = None
    scores: List[ControlScore]


class PillarUpsert(BaseModel):
    pillar: str = Field(min_length=1)  # maps to pillar_key in the new table
    score_pct: conint(ge=0, le=100)
    maturity: Optional[int] = None


class PillarUpsertRequest(BaseModel):
    pillars: List[PillarUpsert]


# ---- Project helpers (split: get-or-none vs ensure) ----
def _row_to_project_out(row: asyncpg.Record) -> ProjectOut:
    return ProjectOut(
        slug=row["slug"],
        name=row["name"],
        risk_level=row.get("risk_level"),
        target_threshold=row["target_threshold"],
    )


async def get_project_out_or_none(conn: asyncpg.Connection, slug: str) -> Optional[ProjectOut]:
    row = await conn.fetchrow(
        "SELECT slug, name, risk_level, target_threshold FROM projects WHERE slug = $1",
        slug,
    )
    return _row_to_project_out(row) if row else None


async def ensure_project(conn: asyncpg.Connection, slug: str) -> ProjectOut:
    """
    Create if missing, then return ProjectOut.
    Used by POST routes that should auto-create projects in dev/MVP flows.
    """
    row = await conn.fetchrow(
        "SELECT slug, name, risk_level, target_threshold FROM projects WHERE slug = $1",
        slug,
    )
    if not row:
        await conn.execute(
            """
            INSERT INTO projects (slug, name, risk_level, target_threshold)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (slug) DO NOTHING
            """,
            slug, slug, "low", DEFAULT_TARGET_THRESHOLD,
        )
        row = await conn.fetchrow(
            "SELECT slug, name, risk_level, target_threshold FROM projects WHERE slug = $1",
            slug,
        )
    return _row_to_project_out(row)


async def get_project_id_by_slug(conn: asyncpg.Connection, slug: str) -> str:
    row = await conn.fetchrow("SELECT id FROM projects WHERE slug = $1", slug)
    if not row:
        raise HTTPException(status_code=404, detail=f"Project '{slug}' not found")
    return row["id"]


# ---- Normalization helpers ----
def clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def clamp100(x: float) -> float:
    return 0.0 if x < 0 else 100.0 if x > 100 else x


def maturity_from_score(s: float) -> int:
    # Simple 1..5 ladder (edit as needed)
    return 5 if s >= 85 else 4 if s >= 70 else 3 if s >= 55 else 2 if s >= 40 else 1


def normalize(min_v: Optional[float], max_v: Optional[float], hib: bool, raw: float) -> float:
    """Min-max normalize raw -> 0..100. If no bounds, clamp raw to 0..100."""
    if min_v is None or max_v is None or max_v == min_v:
        return clamp100(raw)  # assume already 0..100 scale
    if hib:  # higher is better
        pct01 = (raw - min_v) / (max_v - min_v)
    else:    # lower is better
        pct01 = (max_v - raw) / (max_v - min_v)
    return clamp100(round(clamp01(pct01) * 100, 2))


# ---- DB ops for KPIs ----
async def upsert_control_value(
    conn: asyncpg.Connection,
    project_slug: str,
    control_id: str,
    raw_value: float,
) -> Dict[str, Any]:
    # Use definition for normalization if exists
    defn = await conn.fetchrow(
        "SELECT control_id, norm_min, norm_max, higher_is_better, weight, name, pillar, unit "
        "FROM controls WHERE control_id = $1",
        control_id,
    )
    if defn:
        normalized_pct = normalize(
            defn["norm_min"],
            defn["norm_max"],
            bool(defn["higher_is_better"]),
            float(raw_value),
        )
    else:
        # Fallback: assume raw already in 0..100 space
        normalized_pct = clamp100(float(raw_value))

    await conn.execute(
        """
        INSERT INTO control_values (project_slug, control_id, raw_value, normalized_pct, observed_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (project_slug, control_id)
        DO UPDATE SET raw_value = EXCLUDED.raw_value,
                      normalized_pct = EXCLUDED.normalized_pct,
                      observed_at = EXCLUDED.observed_at,
                      updated_at = NOW()
        """,
        project_slug, control_id, float(raw_value), float(normalized_pct),
    )

    return {
        "control_id": control_id,
        "raw_value": float(raw_value),
        "normalized_pct": float(normalized_pct),
    }


async def load_scorecard(
    conn: asyncpg.Connection,
    project_slug: str,
    project: Optional[ProjectOut] = None,
) -> ScorecardOut:
    """
    Build the scorecard snapshot. If `project` is None, we'll 404 if it's missing.
    """
    if project is None:
        proj = await get_project_out_or_none(conn, project_slug)
        if proj is None:
            raise HTTPException(status_code=404, detail="Project not found")
        project = proj

    # Load KPI values (+ definitions) — include norms so we can compute fallbacks safely
    rows = await conn.fetch(
        """
        SELECT
          c.control_id,
          c.name                         AS control_name,
          COALESCE(c.pillar, '')         AS pillar_from_def,
          c.unit,
          COALESCE(c.weight, 1.0)        AS weight,
          c.norm_min,
          c.norm_max,
          c.higher_is_better,
          v.raw_value,
          v.normalized_pct,
          v.updated_at
        FROM controls c
        LEFT JOIN control_values v
          ON v.control_id = c.control_id
         AND v.project_slug = $1
        ORDER BY c.pillar NULLS LAST, c.control_id
        """,
        project_slug,
    )

    # Build KPIs (safe coalescing) and collect for aggregation
    kpis: List[KPIOut] = []
    agg_inputs: List[Tuple[str, float, float]] = []  # (pillar, weight, normalized_pct)

    for r in rows:
        cid = r["control_id"]
        pillar = r["pillar_from_def"] or PILLAR_OF.get(cid) or None

        raw_val = r["raw_value"]
        norm_pct = r["normalized_pct"]

        # Safe fallback for normalized_pct
        if norm_pct is None:
            if raw_val is not None:
                # Try to compute from definition; if any field missing, clamp raw
                hib = bool(r["higher_is_better"]) if r["higher_is_better"] is not None else True
                norm_pct = normalize(r["norm_min"], r["norm_max"], hib, float(raw_val))
            else:
                norm_pct = 0.0

        # KPIOut expects floats for normalized_pct; raw_value can be None
        kpis.append(
            KPIOut(
                pillar=pillar,
                key=cid,
                name=r["control_name"] or cid,
                unit=r["unit"],
                raw_value=float(raw_val) if raw_val is not None else None,
                normalized_pct=float(norm_pct),
                updated_at=r["updated_at"],
            )
        )

        # For aggregation we need a pillar label
        pillar_for_agg = (pillar or "Unassigned").strip() or "Unassigned"
        w = float(r["weight"] or 1.0)
        agg_inputs.append((pillar_for_agg, w, float(norm_pct)))

    # Aggregate pillars (weighted average)
    agg: Dict[str, Tuple[float, float]] = {}  # pillar -> (sum_w, sum_norm_w)
    for pillar_name, w, norm in agg_inputs:
        if pillar_name not in agg:
            agg[pillar_name] = (0.0, 0.0)
        sw, sn = agg[pillar_name]
        agg[pillar_name] = (sw + w, sn + w * norm)

    pillars: List[PillarOut] = []
    for pillar_name, (sum_w, sum_norm_w) in agg.items():
        score_pct = round(sum_norm_w / sum_w, 2) if sum_w > 0 else 0.0
        pillars.append(
            PillarOut(
                pillar=pillar_name,
                score_pct=score_pct,
                weight=1.0,
                maturity=maturity_from_score(score_pct),
            )
        )

    # Apply pillar overrides from normalized table (join via project_id)
    overrides = await conn.fetch(
        """
        SELECT po.pillar_key AS pillar, po.score_pct, po.maturity
        FROM pillar_overrides po
        JOIN projects p ON p.id = po.project_id
        WHERE p.slug = $1
        """,
        project_slug,
    )
    if overrides:
        idx: Dict[str, int] = {p.pillar: i for i, p in enumerate(pillars)}
        for o in overrides:
            name = o["pillar"]
            score_pct = float(o["score_pct"]) if o["score_pct"] is not None else 0.0
            maturity = (
                int(o["maturity"])
                if o["maturity"] is not None
                else maturity_from_score(score_pct)
            )
            if name in idx:
                i = idx[name]
                pillars[i] = PillarOut(
                    pillar=name,
                    score_pct=score_pct,
                    weight=pillars[i].weight,
                    maturity=maturity,
                )
            else:
                pillars.append(
                    PillarOut(pillar=name, score_pct=score_pct, maturity=maturity)
                )

    overall_pct = round(
        sum(p.score_pct for p in pillars) / len(pillars), 2
    ) if pillars else 0.0

    return ScorecardOut(
        project=project,
        overall_pct=overall_pct,
        pillars=sorted(pillars, key=lambda x: x.pillar),
        kpis=kpis,
    )


# ---- Routes ----
@router.get("/{project_slug}", response_model=ScorecardOut)
async def get_scorecard(
    project_slug: str,
    as_of: Optional[datetime] = Query(None),
) -> ScorecardOut:
    """
    Return scorecard snapshot for an *existing* project (404 if not found).
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await ensure_schema(conn)  # only ensures controls/control_values
        project = await get_project_out_or_none(conn, project_slug)
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        # (as_of not used in this simplified snapshot)
        return await load_scorecard(conn, project_slug, project=project)


def _coerce_post_body(payload: Dict[str, Any], project_slug: str) -> PostScoresBody:
    # Primary: { project_id?, scores: [{control_id, score}] }
    if isinstance(payload.get("scores"), list) and all(isinstance(x, dict) for x in payload["scores"]):
        items: List[ControlScore] = []
        for s in payload["scores"]:
            control_id = str(s.get("control_id") or s.get("key") or s.get("kpi_key") or s.get("id") or "")
            score = s.get("score", s.get("raw", s.get("value", None)))
            if control_id and score is not None:
                items.append(ControlScore(control_id=control_id, score=float(score)))
        return PostScoresBody(project_id=payload.get("project_id") or project_slug, scores=items)

    # Map: { scores: { "<id>": <val>, ... } }
    if isinstance(payload.get("scores"), dict):
        items = [ControlScore(control_id=str(k), score=float(v)) for k, v in payload["scores"].items()]
        return PostScoresBody(project_id=payload.get("project_id") or project_slug, scores=items)

    # Legacy: { kpis: [{ key|id|kpi_key, raw|value|score }] }
    if isinstance(payload.get("kpis"), list) and all(isinstance(x, dict) for x in payload["kpis"]):
        items = []
        for k in payload["kpis"]:
            control_id = str(k.get("key") or k.get("kpi_key") or k.get("id") or "")
            score = k.get("raw", k.get("value", k.get("score", None)))
            if control_id and score is not None:
                items.append(ControlScore(control_id=control_id, score=float(score)))
        return PostScoresBody(project_id=payload.get("project_id") or project_slug, scores=items)

    # Nothing usable
    return PostScoresBody(project_id=payload.get("project_id") or project_slug, scores=[])


@router.post("/{project_slug}")
async def upsert_scores(project_slug: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """
    Upsert raw scores for KPIs ("controls"); compute normalized 0–100 and persist.
    Accepts:
      - { project_id?, scores: [{control_id, score}] }
      - { scores: { "<id>": <value>, ... } }
      - { kpis: [{ key|id|kpi_key, raw|value|score }] }
    """
    payload = _coerce_post_body(body, project_slug)
    if not payload.scores:
        raise HTTPException(status_code=400, detail="No valid scores provided.")

    pool = await get_pool()
    async with pool.acquire() as conn:
        await ensure_schema(conn)
        # For write paths we *ensure* the project exists
        project = await ensure_project(conn, project_slug)

        upserted = []
        for item in payload.scores:
            res = await upsert_control_value(conn, project.slug, item.control_id, item.score)
            upserted.append(res)

        snapshot = await load_scorecard(conn, project.slug, project=project)
        return {
            "project_slug": project.slug,
            "upserted": upserted,
            "overall_pct": snapshot.overall_pct,
            "pillars": [p.dict() for p in snapshot.pillars],
            "kpis": [k.dict() for k in snapshot.kpis],
        }


@router.post("/{project_slug}/pillars")
async def upsert_pillars(project_slug: str, req: PillarUpsertRequest) -> Dict[str, Any]:
    """
    Override pillar scores (normalized 0–100) + optional maturity.
    Persists to normalized `pillar_overrides` with (project_id, pillar_key) uniqueness.
    """
    if not req.pillars:
        raise HTTPException(status_code=400, detail="No pillars provided")

    pool = await get_pool()
    async with pool.acquire() as conn:
        # No schema creation here—this is Alembic-managed.
        # Ensure project row (so slug exists)
        project = await ensure_project(conn, project_slug)
        project_id = await get_project_id_by_slug(conn, project.slug)

        for p in req.pillars:
            await conn.execute(
                """
                INSERT INTO pillar_overrides (id, project_id, pillar_key, score_pct, maturity, updated_at)
                VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())
                ON CONFLICT (project_id, pillar_key)
                DO UPDATE SET
                  score_pct  = EXCLUDED.score_pct,
                  maturity   = COALESCE(EXCLUDED.maturity, pillar_overrides.maturity),
                  updated_at = NOW()
                """,
                project_id, p.pillar, float(p.score_pct), p.maturity,
            )

        snapshot = await load_scorecard(conn, project.slug, project=project)
        return {
            "project_slug": project.slug,
            "pillars": [p.dict() for p in snapshot.pillars],
            "overall_pct": snapshot.overall_pct,
        }
