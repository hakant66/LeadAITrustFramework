# app/routers/evidence.py
from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import create_engine
import os
import logging
logger = logging.getLogger("uvicorn.error")


from ..services.s3_client import presign_put, presign_get, object_uri
from ..db.evidence_dao import (
    insert_evidence, update_evidence_uploaded, get_evidence,
    list_evidence, insert_audit, list_audit
)

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URI")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set")
engine = create_engine(DATABASE_URL)

router = APIRouter(prefix="/admin", tags=["evidence"])

# -------- Models --------
class EvidenceInitIn(BaseModel):
    name: str
    mime: Optional[str] = None
    size_bytes: Optional[int] = None
    idempotency_key: Optional[str] = None

class EvidenceInitOut(BaseModel):
    evidence_id: int
    upload_url: str
    upload_headers: Dict[str, str]
    uri: str
    status: str = "pending"

class EvidenceFinalizeIn(BaseModel):
    sha256: str = Field(..., min_length=64, max_length=64)
    size_bytes: int
    mime: Optional[str] = None
    notes: Optional[str] = None

class EvidenceOut(BaseModel):
    id: int
    project_slug: str
    control_id: UUID
    name: str
    mime: Optional[str]
    size_bytes: Optional[int]
    sha256: Optional[str]
    uri: str
    status: str
    created_by: Optional[str]
    created_at: datetime      # <-- was str
    updated_at: datetime      # <-- was str

def get_actor() -> str:
    # plug your auth here; for now a static actor
    return "system"

# -------- Routes --------
@router.post("/projects/{project_slug}/controls/{control_id}/evidence:init",
             response_model=EvidenceInitOut, status_code=201)
def evidence_init(project_slug: str, control_id: UUID, body: EvidenceInitIn, actor: str = Depends(get_actor)):
    object_key = f"evidence/{project_slug}/{control_id}/{uuid4()}-{body.name}"
    uri = object_uri(object_key)
    with engine.begin() as conn:
        ev_id = insert_evidence(conn, project_slug, control_id, body.name, body.mime, body.size_bytes, uri, actor)
        insert_audit(conn, ev_id, "created", actor, {"idempotency_key": body.idempotency_key})
    upload_url, upload_headers = presign_put(object_key, body.mime or "application/octet-stream")
    return EvidenceInitOut(evidence_id=ev_id, upload_url=upload_url, upload_headers=upload_headers, uri=uri)

@router.post("/evidence/{evidence_id}:finalize", response_model=EvidenceOut)
def evidence_finalize(evidence_id: int, body: EvidenceFinalizeIn, actor: str = Depends(get_actor)):
    with engine.begin() as conn:
        ev = get_evidence(conn, evidence_id)
        if not ev:
            raise HTTPException(404, "evidence not found")
        update_evidence_uploaded(conn, evidence_id, body.sha256, body.size_bytes, body.mime)
        insert_audit(conn, evidence_id, "uploaded", actor, {"sha256": body.sha256, "notes": body.notes})
        ev2 = get_evidence(conn, evidence_id)
        return EvidenceOut(**ev2)

@router.get("/projects/{project_slug}/controls/{control_id}/evidence")
def evidence_list_route(project_slug: str, control_id: UUID) -> Dict[str, Any]:
    with engine.begin() as conn:
        items = list_evidence(conn, project_slug, control_id)
    return {"items": items}

@router.get("/evidence/{evidence_id}/audit")
def evidence_audit_route(evidence_id: int) -> Dict[str, Any]:
    with engine.begin() as conn:
        items = list_audit(conn, evidence_id)
    return {"items": items}

@router.post("/evidence/{evidence_id}:download-url")
def evidence_download_url(evidence_id: int):
    with engine.begin() as conn:
        ev = get_evidence(conn, evidence_id)
        if not ev:
            raise HTTPException(404, "evidence not found")
        key = ev["uri"].split("/", 3)[-1]  # s3://bucket/<key>
        url = presign_get(key, expires_seconds=300)
        insert_audit(conn, evidence_id, "downloaded", "system", {})
    return {"url": url, "expires_in": 300}

# Resolve control_id from project + kpi_key
from sqlalchemy import text

@router.get("/projects/{project_slug}/kpis/{kpi_key}/control-id")
def resolve_control_id(project_slug: str, kpi_key: str):
    # DEBUG: show raw path params exactly as FastAPI parsed them
    print(f"[resolve_control_id] project_slug='{project_slug}' kpi_key='{kpi_key}'")
    print(f"[resolve_control_id] kpi_key raw: {kpi_key!r}")
    print(f"[resolve_control_id] {project_slug=}, {kpi_key=}")
    logger.info("[resolve_control_id] project=%s key=%s", project_slug, key)

    """
    Resolve the *global* control id for a KPI key.
    New model: controls are global (per KPI), not per project.
    We therefore:
      1) Try to select controls.id (UUID PK used by scorecard.py),
      2) Fallback to controls.control_id (legacy schema in admin.py),
      3) As a last resort, look up the latest control_id from control_values
         for this project (legacy behaviour).
    """
  with engine.begin() as conn:
        # 1) Try modern schema: controls.id by kpi_key
        try:
            row = conn.execute(
                text("SELECT id FROM controls WHERE kpi_key = :key LIMIT 1"),
                {"key": kpi_key},
            ).first()
            if row and row[0]:
                return {"control_id": str(row[0])}
        except Exception:
            # If the column 'id' doesn't exist in this deployment, fall through
            pass

        # 2) Try legacy schema: controls.control_id by kpi_key
        try:
            row = conn.execute(
                text("SELECT control_id FROM controls WHERE kpi_key = :key LIMIT 1"),
                {"key": kpi_key},
            ).first()
            if row and row[0]:
                return {"control_id": str(row[0])}
        except Exception:
            # If the column 'control_id' also doesn't exist, fall through
            pass

        # 3) Legacy fallback: latest control_values row for this project+kpi_key
        row = conn.execute(
            text("""
                SELECT control_id
                  FROM control_values
                 WHERE project_slug = :slug AND kpi_key = :key
                 ORDER BY updated_at DESC
                 LIMIT 1
            """),
            {"slug": project_slug, "key": kpi_key},
        ).first()
        
        logger.info("[resolve_control_id] result for project=%s key=%s -> %s",
            project_slug, key, (str(row[0]) if row else "None"))
            
        if row and row[0]:
            return {"control_id": str(row[0])}

    # Nothing matched
    raise HTTPException(404, "control_id not found for kpi_key")
