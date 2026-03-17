from __future__ import annotations

from typing import List, Optional, Dict, Tuple
from uuid import uuid4, UUID

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import bindparam, text
from sqlalchemy.dialects.postgresql import JSONB

from app.db import engine
from app.services.trust_axes import (
    AXIS_KEYS,
    ControlAxisScore,
    AxisMappingItem,
    rollup_axis_scores,
)
from app.services.provenance import provenance_coverage_pct
from app.services.trust_verdict import compute_tol, allowed_environments, ENV_GATING_RULES
from app.services.audit_log import append_audit_event_sync
from app.dependencies import get_entity_id_or_first_for_viewer

router = APIRouter(prefix="/trust", tags=["trust-axes"])


class AxisControlOut(BaseModel):
    control_id: str
    kpi_key: Optional[str] = None
    control_name: Optional[str] = None
    pillar_key: Optional[str] = None
    pillar_name: Optional[str] = None
    axis_key: str
    axis_source: str
    weight: float
    score_pct: float


class AxisScoreOut(BaseModel):
    axis_key: str
    score_pct: Optional[float] = None
    controls: List[AxisControlOut]


class AxisMappingOut(BaseModel):
    pillar_key: str
    pillar_name: Optional[str] = None
    axis_key: str
    notes: Optional[str] = None


class TrustAxesResp(BaseModel):
    project_slug: str
    project_name: Optional[str] = None
    axes: List[AxisScoreOut]
    mapping: List[AxisMappingOut]

class TrustEvaluationResp(BaseModel):
    project_slug: str
    project_name: Optional[str] = None
    tol: str
    axis_scores: Dict[str, Optional[float]]
    allowed_environments: List[str]
    gating_rules: Dict[str, str]
    snapshot_id: str
    evaluated_at: str


def _load_axes_for_project(project_slug: str, entity_id: Optional[UUID] = None) -> Tuple[dict, List[AxisScoreOut], List[AxisMappingOut]]:
    with engine.connect() as conn:
        if entity_id:
            proj = conn.execute(
                text("SELECT slug, name FROM entity_projects WHERE slug = :slug AND entity_id = :entity_id"),
                {"slug": project_slug, "entity_id": str(entity_id)},
            ).mappings().first()
        else:
            proj = conn.execute(
                text("SELECT slug, name FROM entity_projects WHERE slug = :slug"),
                {"slug": project_slug},
            ).mappings().first()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")

        mapping_rows = conn.execute(
            text(
                """
                SELECT m.pillar_key,
                       p.name AS pillar_name,
                       m.axis_key,
                       m.notes
                FROM trust_axis_pillar_map m
                LEFT JOIN pillars p ON p.key = m.pillar_key
                ORDER BY m.pillar_key
                """
            )
        ).mappings().all()

        mapping_items = [
            AxisMappingItem(
                pillar_key=row["pillar_key"],
                axis_key=row["axis_key"],
                notes=row.get("notes"),
            )
            for row in mapping_rows
        ]

        if entity_id:
            controls_rows = conn.execute(
                text(
                    """
                    SELECT
                      cv.control_id::text AS control_id,
                      COALESCE(c.kpi_key, cv.kpi_key) AS kpi_key,
                      COALESCE(c.name, cv.kpi_key) AS control_name,
                      c.pillar AS pillar_name,
                      p.key AS pillar_key,
                      c.axis_key AS axis_key,
                      COALESCE(c.weight, 1.0)::float8 AS weight,
                      cv.kpi_score::float8 AS kpi_score,
                      cv.normalized_pct::float8 AS normalized_pct,
                      ev.approval_status AS approval_status
                    FROM control_values cv
                    LEFT JOIN controls c ON c.id = cv.control_id
                    LEFT JOIN pillars p
                      ON lower(trim(p.name)) = lower(trim(c.pillar))
                    LEFT JOIN LATERAL (
                      SELECT e.approval_status
                      FROM evidence e
                      WHERE e.project_slug = cv.project_slug
                        AND e.control_id = cv.control_id
                        AND e.entity_id = cv.entity_id
                      ORDER BY COALESCE(e.approved_at, e.updated_at, e.created_at) DESC NULLS LAST,
                               e.id DESC
                      LIMIT 1
                    ) ev ON TRUE
                    WHERE cv.project_slug = :slug AND cv.entity_id = :entity_id
                    """
                ),
                {"slug": project_slug, "entity_id": str(entity_id)},
            ).mappings().all()
        else:
            controls_rows = conn.execute(
                text(
                    """
                    SELECT
                      cv.control_id::text AS control_id,
                      COALESCE(c.kpi_key, cv.kpi_key) AS kpi_key,
                      COALESCE(c.name, cv.kpi_key) AS control_name,
                      c.pillar AS pillar_name,
                      p.key AS pillar_key,
                      c.axis_key AS axis_key,
                      COALESCE(c.weight, 1.0)::float8 AS weight,
                      cv.kpi_score::float8 AS kpi_score,
                      cv.normalized_pct::float8 AS normalized_pct,
                      ev.approval_status AS approval_status
                    FROM control_values cv
                    LEFT JOIN controls c ON c.id = cv.control_id
                    LEFT JOIN pillars p
                      ON lower(trim(p.name)) = lower(trim(c.pillar))
                    LEFT JOIN LATERAL (
                      SELECT e.approval_status
                      FROM evidence e
                      WHERE e.project_slug = cv.project_slug
                        AND e.control_id = cv.control_id
                      ORDER BY COALESCE(e.approved_at, e.updated_at, e.created_at) DESC NULLS LAST,
                               e.id DESC
                      LIMIT 1
                    ) ev ON TRUE
                    WHERE cv.project_slug = :slug
                    """
                ),
                {"slug": project_slug},
            ).mappings().all()

    controls: List[ControlAxisScore] = []
    for row in controls_rows:
        score = row["kpi_score"]
        if score is None:
            score = row["normalized_pct"]
        approval_status = row.get("approval_status")
        if approval_status and approval_status != "approved":
            score = None
        controls.append(
            ControlAxisScore(
                control_id=row["control_id"],
                kpi_key=row.get("kpi_key"),
                control_name=row.get("control_name"),
                pillar_key=row.get("pillar_key"),
                pillar_name=row.get("pillar_name"),
                axis_key=row.get("axis_key"),
                weight=float(row.get("weight") or 1.0),
                score_pct=float(score) if score is not None else None,
            )
        )

    provenance_score = provenance_coverage_pct(project_slug)
    if provenance_score is not None:
        controls.append(
            ControlAxisScore(
                control_id="provenance-coverage",
                kpi_key="provenance_coverage",
                control_name="Provenance coverage",
                pillar_key=None,
                pillar_name=None,
                axis_key="provenance",
                weight=1.0,
                score_pct=float(provenance_score),
            )
        )

    rollup = rollup_axis_scores(controls, mapping_items)
    axes = [AxisScoreOut(**rollup[axis]) for axis in AXIS_KEYS]

    mapping_out = [
        AxisMappingOut(
            pillar_key=row["pillar_key"],
            pillar_name=row.get("pillar_name"),
            axis_key=row["axis_key"],
            notes=row.get("notes"),
        )
        for row in mapping_rows
    ]

    return proj, axes, mapping_out


@router.get("/axes/{project_slug}", response_model=TrustAxesResp)
def get_trust_axes(
    project_slug: str,
    entity_id: UUID = Depends(get_entity_id_or_first_for_viewer),
):
    proj, axes, mapping_out = _load_axes_for_project(project_slug, entity_id)

    return TrustAxesResp(
        project_slug=proj["slug"],
        project_name=proj.get("name"),
        axes=axes,
        mapping=mapping_out,
    )


@router.get("/evaluate/{project_slug}", response_model=TrustEvaluationResp)
def evaluate_trust(
    project_slug: str,
    entity_id: UUID = Depends(get_entity_id_or_first_for_viewer),
):
    proj, axes, _mapping_out = _load_axes_for_project(project_slug, entity_id)

    axis_scores: Dict[str, Optional[float]] = {
        axis.axis_key: axis.score_pct for axis in axes
    }
    tol = compute_tol(axis_scores)
    allowed = allowed_environments(tol)

    snapshot_id = str(uuid4())
    
    # Get entity_id from project if not provided
    if not entity_id:
        with engine.connect() as conn:
            entity_id_row = conn.execute(
                text("SELECT entity_id FROM entity_projects WHERE slug = :slug"),
                {"slug": project_slug},
            ).mappings().first()
            if entity_id_row:
                entity_id = UUID(str(entity_id_row["entity_id"]))
    
    with engine.begin() as conn:
        if entity_id:
            conn.execute(
                text(
                    """
                    INSERT INTO trust_evaluations (
                      id, entity_id, project_slug, axis_scores, tol_level, evaluated_at
                    )
                    VALUES (:id, :entity_id, :slug, :axis_scores, :tol, now())
                    """
                ).bindparams(bindparam("axis_scores", type_=JSONB)),
                {
                    "id": snapshot_id,
                    "entity_id": str(entity_id),
                    "slug": project_slug,
                    "axis_scores": axis_scores,
                    "tol": tol,
                },
            )

            conn.execute(
                text(
                    """
                    INSERT INTO trust_evaluation_audit (
                      entity_id, evaluation_id, action, actor, details_json
                    )
                    VALUES (:entity_id, :evaluation_id, :action, :actor, :details)
                    """
                ).bindparams(bindparam("details", type_=JSONB)),
                {
                    "entity_id": str(entity_id),
                    "evaluation_id": snapshot_id,
                    "action": "evaluated",
                    "actor": "system",
                    "details": {
                        "project_slug": project_slug,
                        "axis_scores": axis_scores,
                        "tol": tol,
                        "allowed_environments": allowed,
                    },
                },
            )
        else:
            conn.execute(
                text(
                    """
                    INSERT INTO trust_evaluations (
                      id, project_slug, axis_scores, tol_level, evaluated_at
                    )
                    VALUES (:id, :slug, :axis_scores, :tol, now())
                    """
                ).bindparams(bindparam("axis_scores", type_=JSONB)),
                {
                    "id": snapshot_id,
                    "slug": project_slug,
                    "axis_scores": axis_scores,
                    "tol": tol,
                },
            )

            conn.execute(
                text(
                    """
                    INSERT INTO trust_evaluation_audit (
                      evaluation_id, action, actor, details_json
                    )
                    VALUES (:evaluation_id, :action, :actor, :details)
                    """
                ).bindparams(bindparam("details", type_=JSONB)),
                {
                    "evaluation_id": snapshot_id,
                    "action": "evaluated",
                    "actor": "system",
                    "details": {
                        "project_slug": project_slug,
                        "axis_scores": axis_scores,
                        "tol": tol,
                        "allowed_environments": allowed,
                    },
                },
            )

    evaluated_at = ""
    with engine.connect() as conn:
        row = conn.execute(
            text(
                "SELECT evaluated_at FROM trust_evaluations WHERE id = :id"
            ),
            {"id": snapshot_id},
        ).mappings().first()
        if row and row.get("evaluated_at"):
            evaluated_at = row["evaluated_at"].isoformat()

    append_audit_event_sync(
        event_type="trust_evaluated",
        actor="system",
        source_service="core-svc",
        object_type="trust_evaluation",
        object_id=snapshot_id,
        project_slug=proj["slug"],
        details={
            "axis_scores": axis_scores,
            "tol": tol,
            "allowed_environments": allowed,
        },
    )

    return TrustEvaluationResp(
        project_slug=proj["slug"],
        project_name=proj.get("name"),
        tol=tol,
        axis_scores=axis_scores,
        allowed_environments=allowed,
        gating_rules=ENV_GATING_RULES,
        snapshot_id=snapshot_id,
        evaluated_at=evaluated_at,
    )
