from __future__ import annotations

from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.db_async import get_pool
from app.services.audit_log import append_audit_event
from app.dependencies import get_entity_id_or_first_for_viewer


router = APIRouter(prefix="/audit", tags=["audit"])


class AuditEventIn(BaseModel):
    event_type: str
    actor: Optional[str] = None
    actor_type: Optional[str] = None
    source_service: Optional[str] = None
    object_type: Optional[str] = None
    object_id: Optional[str] = None
    project_slug: Optional[str] = None
    details: Optional[dict] = None


class AuditEventOut(BaseModel):
    id: str
    event_type: str
    actor: Optional[str] = None
    actor_type: Optional[str] = None
    source_service: Optional[str] = None
    object_type: Optional[str] = None
    object_id: Optional[str] = None
    project_slug: Optional[str] = None
    details: Optional[dict] = None
    hash_prev: Optional[str] = None
    hash: str
    created_at: str


@router.post("/events", response_model=AuditEventOut, status_code=201)
async def ingest_event(body: AuditEventIn):
    if not body.event_type:
        raise HTTPException(status_code=400, detail="event_type is required")
    return await append_audit_event(
        event_type=body.event_type,
        actor=body.actor,
        actor_type=body.actor_type,
        source_service=body.source_service,
        object_type=body.object_type,
        object_id=body.object_id,
        project_slug=body.project_slug,
        details=body.details,
    )


@router.get("/events")
async def list_events(
    limit: int = 50,
    offset: int = 0,
    event_type: Optional[str] = None,
    actor: Optional[str] = None,
    project_slug: Optional[str] = None,
    object_type: Optional[str] = None,
    object_id: Optional[str] = None,
    q: Optional[str] = None,
    entity_id: UUID = Depends(get_entity_id_or_first_for_viewer),
):
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))
    clauses = []
    params = []

    # Entity ID is required and validated by authorization
    params.append(str(entity_id))
    clauses.append(f"entity_id = ${len(params)}")
    if event_type:
        params.append(event_type)
        clauses.append(f"event_type = ${len(params)}")
    if actor:
        params.append(actor)
        clauses.append(f"actor = ${len(params)}")
    if project_slug:
        params.append(project_slug)
        clauses.append(f"project_slug = ${len(params)}")
    if object_type:
        params.append(object_type)
        clauses.append(f"object_type = ${len(params)}")
    if object_id:
        params.append(object_id)
        clauses.append(f"object_id = ${len(params)}")
    if q:
        params.append(f"%{q}%")
        clauses.append(
            f"(event_type ILIKE ${len(params)} OR object_id ILIKE ${len(params)} OR hash ILIKE ${len(params)})"
        )

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    pool = await get_pool()
    async with pool.acquire() as conn:
        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM audit_events {where_sql}",
            *params,
        )
        rows = await conn.fetch(
            f"""
            SELECT id, event_type, actor, actor_type, source_service,
                   object_type, object_id, project_slug, details_json,
                   hash_prev, hash, created_at
            FROM audit_events
            {where_sql}
            ORDER BY created_at DESC, id DESC
            LIMIT ${len(params)+1} OFFSET ${len(params)+2}
            """,
            *params,
            limit,
            offset,
        )

    items: List[dict] = []
    for r in rows:
        items.append(
            {
                "id": r["id"],
                "event_type": r["event_type"],
                "actor": r["actor"],
                "actor_type": r["actor_type"],
                "source_service": r["source_service"],
                "object_type": r["object_type"],
                "object_id": r["object_id"],
                "project_slug": r["project_slug"],
                "details": r["details_json"],
                "hash_prev": r["hash_prev"],
                "hash": r["hash"],
                "created_at": r["created_at"].isoformat()
                if r["created_at"]
                else None,
            }
        )

    return {"items": items, "total": int(total or 0)}
