from __future__ import annotations

from typing import Optional, List
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text, bindparam
from sqlalchemy.dialects.postgresql import JSONB

from app.celery_app import celery_app
from app.db import engine
from app.services.decay_engine import mark_signal_status
from app.services.core_client import emit_audit_event
from app.services.decay_rules import DECAY_RULES


router = APIRouter(prefix="/trust", tags=["trust-decay"])


class SignalIn(BaseModel):
    project_slug: str
    signal_type: str
    axis_key: Optional[str] = None
    details: Optional[dict] = None
    source: Optional[str] = None


class SignalOut(BaseModel):
    id: str
    project_slug: str
    signal_type: str
    axis_key: Optional[str] = None
    status: str
    queued: bool


class SignalListOut(BaseModel):
    id: str
    project_slug: str
    signal_type: str
    axis_key: Optional[str] = None
    status: str
    details_json: Optional[dict] = None
    source: Optional[str] = None
    created_at: Optional[str] = None
    processed_at: Optional[str] = None
    resolved_at: Optional[str] = None


class DecayEventOut(BaseModel):
    id: str
    signal_id: str
    project_slug: str
    axis_key: str
    rule_key: str
    previous_score: Optional[float] = None
    new_score: Optional[float] = None
    decay_delta: Optional[float] = None
    applied_at: Optional[str] = None
    details_json: Optional[dict] = None


@router.post("/signals", response_model=SignalOut, status_code=201)
def ingest_signal(body: SignalIn):
    if body.signal_type not in DECAY_RULES:
        raise HTTPException(status_code=400, detail="Unsupported signal_type")
    signal_id = str(uuid4())
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO trust_monitoring_signals (
                    id, project_slug, signal_type, axis_key, status, details_json, source
                )
                VALUES (
                    :id, :project_slug, :signal_type, :axis_key, 'pending', :details, :source
                )
                """
            ).bindparams(bindparam("details", type_=JSONB)),
            {
                "id": signal_id,
                "project_slug": body.project_slug,
                "signal_type": body.signal_type,
                "axis_key": body.axis_key,
                "details": body.details,
                "source": body.source,
            },
        )

    celery_app.send_task("trust_decay.process_signal", args=[signal_id])

    emit_audit_event(
        event_type="signal_ingested",
        actor=body.source or "reg-svc",
        source_service="reg-svc",
        object_type="trust_signal",
        object_id=signal_id,
        project_slug=body.project_slug,
        details={"signal_type": body.signal_type, "axis_key": body.axis_key},
    )

    return SignalOut(
        id=signal_id,
        project_slug=body.project_slug,
        signal_type=body.signal_type,
        axis_key=body.axis_key,
        status="pending",
        queued=True,
    )


@router.post("/signals/{signal_id}/resolve")
def resolve_signal(signal_id: str):
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT id, project_slug FROM trust_monitoring_signals WHERE id = :id"),
            {"id": signal_id},
        ).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Signal not found")

    mark_signal_status(signal_id, "resolved")
    emit_audit_event(
        event_type="signal_resolved",
        actor="reg-svc",
        source_service="reg-svc",
        object_type="trust_signal",
        object_id=signal_id,
        project_slug=row["project_slug"],
    )
    celery_app.send_task(
        "trust_decay.recompute_project",
        args=[row["project_slug"]],
        kwargs={"action": "decay_reversed"},
    )
    return {"ok": True, "signal_id": signal_id, "status": "resolved"}


@router.get("/signals", response_model=List[SignalListOut])
def list_signals(
    project_slug: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
):
    limit = max(1, min(limit, 500))
    clauses = []
    params: dict = {"limit": limit}
    if project_slug:
        clauses.append("project_slug = :project_slug")
        params["project_slug"] = project_slug
    if status:
        clauses.append("status = :status")
        params["status"] = status

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    sql = f"""
        SELECT id, project_slug, signal_type, axis_key, status,
               details_json, source, created_at, processed_at, resolved_at
          FROM trust_monitoring_signals
          {where}
         ORDER BY created_at DESC
         LIMIT :limit
    """
    with engine.connect() as conn:
        rows = conn.execute(text(sql), params).mappings().all()
    return [
        SignalListOut(
            id=row["id"],
            project_slug=row["project_slug"],
            signal_type=row["signal_type"],
            axis_key=row.get("axis_key"),
            status=row["status"],
            details_json=row.get("details_json"),
            source=row.get("source"),
            created_at=row["created_at"].isoformat() if row.get("created_at") else None,
            processed_at=row["processed_at"].isoformat() if row.get("processed_at") else None,
            resolved_at=row["resolved_at"].isoformat() if row.get("resolved_at") else None,
        )
        for row in rows
    ]


@router.post("/decay/{project_slug}:recompute")
def recompute_decay(project_slug: str):
    celery_app.send_task(
        "trust_decay.recompute_project",
        args=[project_slug],
        kwargs={"action": "decay_recomputed"},
    )
    emit_audit_event(
        event_type="decay_recompute_queued",
        actor="reg-svc",
        source_service="reg-svc",
        object_type="project",
        object_id=project_slug,
        project_slug=project_slug,
    )
    return {"ok": True, "project_slug": project_slug, "queued": True}


@router.get("/decays", response_model=List[DecayEventOut])
def list_decays(
    project_slug: Optional[str] = None,
    signal_id: Optional[str] = None,
    limit: int = 50,
):
    limit = max(1, min(limit, 500))
    clauses = []
    params: dict = {"limit": limit}
    if project_slug:
        clauses.append("project_slug = :project_slug")
        params["project_slug"] = project_slug
    if signal_id:
        clauses.append("signal_id = :signal_id")
        params["signal_id"] = signal_id

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    sql = f"""
        SELECT id, signal_id, project_slug, axis_key, rule_key,
               previous_score, new_score, decay_delta, applied_at, details_json
          FROM trust_decay_events
          {where}
         ORDER BY applied_at DESC
         LIMIT :limit
    """
    with engine.connect() as conn:
        rows = conn.execute(text(sql), params).mappings().all()
    return [
        DecayEventOut(
            id=row["id"],
            signal_id=row["signal_id"],
            project_slug=row["project_slug"],
            axis_key=row["axis_key"],
            rule_key=row["rule_key"],
            previous_score=row.get("previous_score"),
            new_score=row.get("new_score"),
            decay_delta=row.get("decay_delta"),
            applied_at=row["applied_at"].isoformat() if row.get("applied_at") else None,
            details_json=row.get("details_json"),
        )
        for row in rows
    ]
