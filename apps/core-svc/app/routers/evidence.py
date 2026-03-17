# app/routers/evidence.py
from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text
import os
import logging
import asyncpg
logger = logging.getLogger("uvicorn.error")


from ..services.s3_client import presign_put, presign_get, object_uri
from ..db.evidence_dao import (
    insert_evidence, update_evidence_uploaded, get_evidence,
    list_evidence, insert_audit, list_audit
)
from ..dependencies import (
    get_entity_id_with_auth_viewer,
    get_entity_id_with_auth_editor,
)

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URI")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set")
engine = create_engine(DATABASE_URL)

router = APIRouter(prefix="/admin", tags=["evidence"])

EVIDENCE_FILE_ROOT = os.getenv("EVIDENCE_FILE_ROOT") or ""
EVIDENCE_FILE_PREFIX = os.getenv("EVIDENCE_FILE_PREFIX") or ""

def _normalize_path(p: str) -> str:
    return p.replace("\\", "/").rstrip("/")

def _local_path_from_uri(uri: str) -> Optional[str]:
    if not uri.startswith("file://"):
        return None
    if not EVIDENCE_FILE_ROOT:
        return None
    raw = uri[len("file://"):]
    raw = raw.lstrip("/")
    raw_norm = _normalize_path(raw)
    root_norm = _normalize_path(EVIDENCE_FILE_ROOT)

    rel = ""
    if EVIDENCE_FILE_PREFIX:
        pref = _normalize_path(EVIDENCE_FILE_PREFIX)
        if raw_norm.lower().startswith(pref.lower()):
            rel = raw_norm[len(pref):].lstrip("/")
    if not rel:
        parts = [p for p in raw_norm.split("/") if p]
        if "leadai-evidence" in parts:
            idx = parts.index("leadai-evidence")
            rel = "/".join(parts[idx + 1 :])
    if not rel:
        return None

    local = os.path.abspath(os.path.join(root_norm, rel))
    root_abs = os.path.abspath(root_norm)
    if not local.startswith(root_abs + os.sep) and local != root_abs:
        return None
    return local

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
async def _get_entity_id_from_project_slug_sync(project_slug: str, entity_id: UUID) -> UUID:
    """Helper to get entity_id from project_slug using asyncpg."""
    dsn = os.getenv("DATABASE_URL", "").replace("+asyncpg", "").replace("+psycopg", "")
    if not dsn:
        raise HTTPException(500, "DATABASE_URL not configured")
    
    conn = await asyncpg.connect(dsn)
    try:
        proj_entity_id = await conn.fetchval(
            "SELECT entity_id FROM entity_projects WHERE slug = $1",
            project_slug,
        )
        if not proj_entity_id:
            raise HTTPException(404, f"Project '{project_slug}' not found")
        if proj_entity_id != entity_id:
            raise HTTPException(403, f"Project '{project_slug}' does not belong to the specified entity")
        return entity_id
    finally:
        await conn.close()


@router.post("/projects/{project_slug}/controls/{control_id}/evidence:init",
             response_model=EvidenceInitOut, status_code=201)
async def evidence_init(
    project_slug: str,
    control_id: UUID,
    body: EvidenceInitIn,
    actor: str = Depends(get_actor),
    entity_id: UUID = Depends(get_entity_id_with_auth_editor),
):
    effective_entity_id = await _get_entity_id_from_project_slug_sync(project_slug, entity_id)
    object_key = f"evidence/{effective_entity_id}/{project_slug}/{control_id}/{uuid4()}-{body.name}"
    uri = object_uri(object_key)
    with engine.begin() as conn:
        ev_id = insert_evidence(conn, project_slug, control_id, body.name, body.mime, body.size_bytes, uri, actor, effective_entity_id)
        insert_audit(conn, ev_id, "created", actor, {"idempotency_key": body.idempotency_key})
    upload_url, upload_headers = presign_put(object_key, body.mime or "application/octet-stream")
    return EvidenceInitOut(evidence_id=ev_id, upload_url=upload_url, upload_headers=upload_headers, uri=uri)

@router.post("/evidence/{evidence_id}:finalize", response_model=EvidenceOut)
def evidence_finalize(
    evidence_id: int,
    body: EvidenceFinalizeIn,
    actor: str = Depends(get_actor),
    entity_id: UUID = Depends(get_entity_id_with_auth_editor),
):
    with engine.begin() as conn:
        ev = get_evidence(conn, evidence_id, entity_id)
        if not ev:
            raise HTTPException(404, "evidence not found")
        update_evidence_uploaded(conn, evidence_id, body.sha256, body.size_bytes, body.mime)
        insert_audit(conn, evidence_id, "uploaded", actor, {"sha256": body.sha256, "notes": body.notes})
        ev2 = get_evidence(conn, evidence_id, entity_id)
        return EvidenceOut(**ev2)

@router.get("/projects/{project_slug}/controls/{control_id}/evidence")
async def evidence_list_route(
    project_slug: str,
    control_id: UUID,
    entity_id: UUID = Depends(get_entity_id_with_auth_viewer),
) -> Dict[str, Any]:
    effective_entity_id = await _get_entity_id_from_project_slug_sync(project_slug, entity_id)
    with engine.begin() as conn:
        items = list_evidence(conn, project_slug, control_id, effective_entity_id)
    return {"items": items}

@router.get("/evidence/{evidence_id}/audit")
def evidence_audit_route(
    evidence_id: int,
    entity_id: UUID = Depends(get_entity_id_with_auth_viewer),
) -> Dict[str, Any]:
    with engine.begin() as conn:
        items = list_audit(conn, evidence_id, entity_id)
    return {"items": items}

@router.post("/evidence/{evidence_id}:download-url")
def evidence_download_url(
    evidence_id: int,
    entity_id: UUID = Depends(get_entity_id_with_auth_viewer),
):
    with engine.begin() as conn:
        ev = get_evidence(conn, evidence_id, entity_id)
        if not ev:
            raise HTTPException(404, "evidence not found")
        uri = ev.get("uri") or ""
        if uri.startswith("file://"):
            local_path = _local_path_from_uri(uri)
            if not local_path or not os.path.exists(local_path):
                raise HTTPException(404, "evidence file not found")
            url = f"/admin/evidence/{evidence_id}:download"
        else:
            key = uri.split("/", 3)[-1]  # s3://bucket/<key>
            url = presign_get(key, expires_seconds=300)
        insert_audit(conn, evidence_id, "downloaded", "system", {})
    return {"url": url, "expires_in": 300}

@router.get("/evidence/{evidence_id}:download")
def evidence_download_file(
    evidence_id: int,
    entity_id: UUID = Depends(get_entity_id_with_auth_viewer),
):
    with engine.begin() as conn:
        ev = get_evidence(conn, evidence_id, entity_id)
        if not ev:
            raise HTTPException(404, "evidence not found")
        uri = ev.get("uri") or ""
        if not uri.startswith("file://"):
            raise HTTPException(400, "evidence is not file-based")
        local_path = _local_path_from_uri(uri)
        if not local_path or not os.path.exists(local_path):
            raise HTTPException(404, "evidence file not found")
        filename = ev.get("name") or os.path.basename(local_path)
        mime = ev.get("mime") or "application/octet-stream"
    return FileResponse(local_path, filename=filename, media_type=mime)

# Resolve control_id from project + kpi_key
@router.get("/projects/{project_slug}/kpis/{kpi_key}/control-id")
async def resolve_control_id(
    project_slug: str,
    kpi_key: str,
    entity_id: UUID = Depends(get_entity_id_with_auth_viewer),
):
    # DEBUG: show raw path params exactly as FastAPI parsed them
    print(f"[resolve_control_id] project_slug='{project_slug}' kpi_key='{kpi_key}'")
    print(f"[resolve_control_id] kpi_key raw: {kpi_key!r}")
    print(f"[resolve_control_id] {project_slug=}, {kpi_key=}")
    logger.info("[resolve_control_id] project=%s key=%s", project_slug, kpi_key)

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
        effective_entity_id = await _get_entity_id_from_project_slug_sync(project_slug, entity_id)
        query = text("""
            SELECT control_id
              FROM control_values
             WHERE project_slug = :slug AND kpi_key = :key
        """)
        params = {"slug": project_slug, "key": kpi_key}
        if effective_entity_id:
            query = text("""
                SELECT control_id
                  FROM control_values
                 WHERE project_slug = :slug AND kpi_key = :key AND entity_id = :entity_id
                 ORDER BY updated_at DESC
                 LIMIT 1
            """)
            params["entity_id"] = str(effective_entity_id)
        else:
            query = text("""
                SELECT control_id
                  FROM control_values
                 WHERE project_slug = :slug AND kpi_key = :key
                 ORDER BY updated_at DESC
                 LIMIT 1
            """)
        row = conn.execute(query, params).first()
        
        logger.info("[resolve_control_id] result for project=%s key=%s -> %s",
            project_slug, kpi_key, (str(row[0]) if row else "None"))
            
        if row and row[0]:
            return {"control_id": str(row[0])}

    # Nothing matched
    raise HTTPException(404, "control_id not found for kpi_key")
