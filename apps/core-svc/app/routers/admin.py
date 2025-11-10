# app/routers/admin.py
from __future__ import annotations

import io
import os
import hashlib
from pathlib import Path
from datetime import date, datetime, timezone
from typing import List, Optional

import asyncpg
from fastapi import APIRouter, HTTPException, File, UploadFile, Request, Depends
from fastapi.responses import StreamingResponse, Response
from openpyxl import Workbook, load_workbook
from pydantic import BaseModel, Field
from app.db import get_db
from app.services.scorecard_read import fetch_project_pillars 
from app.scorecard import get_pool, ensure_schema, get_project_id_by_slug



router = APIRouter(prefix="/admin", tags=["admin"])

# Where to drop uploaded binaries locally (dev-only stub storage)
LOCAL_EVIDENCE_ROOT = Path(os.getenv("EVIDENCE_LOCAL_ROOT", "/tmp/leadai-evidence")).resolve()
LOCAL_EVIDENCE_ROOT.mkdir(parents=True, exist_ok=True)


def _clean_optional_str(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed if trimmed else None


# ---------- Models ----------
class ControlIn(BaseModel):
    control_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    pillar: Optional[str] = None
    unit: Optional[str] = None
    norm_min: Optional[float] = None
    norm_max: Optional[float] = None
    higher_is_better: bool = True
    weight: float = 1.0


class ControlOut(ControlIn):
    pass


class ProjectIn(BaseModel):
    slug: str = Field(min_length=1)
    name: str = Field(min_length=1)
    risk_level: Optional[str] = None
    target_threshold: float = 0.75  # 0..1
    priority: Optional[str] = None
    sponsor: Optional[str] = None
    owner: Optional[str] = None
    creation_date: Optional[date] = None
    update_date: Optional[datetime] = None


class ProjectOut(ProjectIn):
    id: str


# ---------- Controls CRUD (global) ----------
@router.get("/controls", response_model=List[ControlOut])
async def list_controls() -> List[ControlOut]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await ensure_schema(conn)
        rows = await conn.fetch(
            """
            SELECT control_id, name, pillar, unit, norm_min, norm_max, higher_is_better, weight
            FROM controls
            ORDER BY pillar NULLS LAST, control_id
            """
        )
        return [ControlOut(**dict(r)) for r in rows]


@router.post("/controls", response_model=ControlOut)
async def create_control(body: ControlIn) -> ControlOut:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await ensure_schema(conn)
        try:
            await conn.execute(
                """
                INSERT INTO controls
                  (control_id, name, pillar, unit, norm_min, norm_max, higher_is_better, weight)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                """,
                body.control_id, body.name, body.pillar, body.unit,
                body.norm_min, body.norm_max, body.higher_is_better, body.weight,
            )
        except asyncpg.UniqueViolationError:
            raise HTTPException(status_code=409, detail="control_id already exists")
        return ControlOut(**body.model_dump())


@router.put("/controls/{control_id}", response_model=ControlOut)
async def update_control(control_id: str, body: ControlIn) -> ControlOut:
    if control_id != body.control_id:
        raise HTTPException(status_code=400, detail="control_id mismatch between path and body")

    pool = await get_pool()
    async with pool.acquire() as conn:
        await ensure_schema(conn)
        result = await conn.execute(
            """
            UPDATE controls
            SET name=$2, pillar=$3, unit=$4, norm_min=$5, norm_max=$6, higher_is_better=$7, weight=$8
            WHERE control_id=$1
            """,
            body.control_id, body.name, body.pillar, body.unit,
            body.norm_min, body.norm_max, body.higher_is_better, body.weight,
        )
        if result.split()[-1] == "0":
            raise HTTPException(status_code=404, detail="control not found")
        return ControlOut(**body.model_dump())


@router.delete("/controls/{control_id}")
async def delete_control(control_id: str) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await ensure_schema(conn)
        await conn.execute("DELETE FROM control_values WHERE control_id=$1", control_id)
        res = await conn.execute("DELETE FROM controls WHERE control_id=$1", control_id)
        if int(res.split()[-1]) == 0:
            raise HTTPException(status_code=404, detail="control not found")
        return {"deleted": control_id}


# ---------- Projects (create/upsert) ----------
@router.post("/projects", response_model=ProjectOut)
async def create_project(body: ProjectIn) -> ProjectOut:
    pool = await get_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            """
            SELECT id, risk_level, priority, sponsor, owner, creation_date
            FROM projects
            WHERE slug=$1
            """,
            body.slug,
        )

        base_risk = _clean_optional_str(body.risk_level) or (existing["risk_level"] if existing and existing["risk_level"] else "medium")
        priority = _clean_optional_str(body.priority) or base_risk
        sponsor = _clean_optional_str(body.sponsor)
        owner = _clean_optional_str(body.owner)

        if existing:
            if sponsor is None and existing["sponsor"] is not None and body.sponsor is None:
                sponsor = existing["sponsor"]
            if owner is None and existing["owner"] is not None and body.owner is None:
                owner = existing["owner"]
            creation_date = (
                body.creation_date if body.creation_date is not None else existing["creation_date"]
            )
        else:
            creation_date = body.creation_date or date.today()

        update_ts = body.update_date or datetime.now(timezone.utc)

        if existing:
            await conn.execute(
                """
                UPDATE projects
                SET name=$2,
                    risk_level=$3,
                    target_threshold=$4,
                    priority=$5,
                    sponsor=$6,
                    owner=$7,
                    creation_date=$8,
                    update_date=$9
                WHERE slug=$1
                """,
                body.slug,
                body.name,
                base_risk,
                body.target_threshold,
                priority,
                sponsor,
                owner,
                creation_date,
                update_ts,
            )
            row = await conn.fetchrow(
                """
                SELECT id, slug, name, risk_level, target_threshold, priority, sponsor, owner, creation_date, update_date
                FROM projects
                WHERE slug=$1
                """,
                body.slug,
            )
            return ProjectOut(**dict(row))

        try:
            row = await conn.fetchrow(
                """
                INSERT INTO projects (
                    id,
                    slug,
                    name,
                    risk_level,
                    target_threshold,
                    priority,
                    sponsor,
                    owner,
                    creation_date,
                    update_date
                )
                VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id, slug, name, risk_level, target_threshold, priority, sponsor, owner, creation_date, update_date
                """,
                body.slug,
                body.name,
                base_risk,
                body.target_threshold,
                priority,
                sponsor,
                owner,
                creation_date,
                update_ts,
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to create project: {e}")
        return ProjectOut(**dict(row))


# ---------- Evidence helper for UI ----------
@router.get("/projects/{project_slug}/kpis/{kpi_key}/control-id")
async def get_control_id_for_kpi(project_slug: str, kpi_key: str) -> dict:
    """
    Used by Evidence() button:
    returns the control_id (uuid text) for a given {project_slug, kpi_key}.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve once to fail fast if the project doesn't exist
        await get_project_id_by_slug(conn, project_slug)

        row = await conn.fetchrow(
            """
            SELECT v.control_id::text AS control_id
            FROM control_values v
            LEFT JOIN controls c ON c.id = v.control_id
            WHERE v.project_slug = $1
              AND (v.kpi_key = $2 OR c.kpi_key = $2)
            LIMIT 1
            """,
            project_slug, kpi_key,
        )
        if not row or not row["control_id"]:
            raise HTTPException(status_code=404, detail="Control not found for KPI")
        return {"control_id": row["control_id"]}


# ---------- Evidence endpoints (using current schema) ----------
class EvidenceUpdate(BaseModel):
    evidence_source: Optional[str] = None
    owner_role: Optional[str] = None
    notes: Optional[str] = None


class EvidenceFinalize(BaseModel):
    evidence_id: int            # adjust to str if your id is UUID
    sha256_hex: Optional[str] = None


@router.get("/projects/{project_slug}/controls/{control_id}/evidence")
async def get_control_evidence(project_slug: str, control_id: str) -> dict:
    """
    Evidence() drawer fetch.
    Returns current metadata for this control in this project.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT v.project_slug,
                   v.control_id::text              AS control_id,
                   COALESCE(c.kpi_key, v.kpi_key)  AS kpi_key,
                   v.evidence_source,
                   v.owner_role,
                   v.notes,
                   v.updated_at
            FROM control_values v
            LEFT JOIN controls c ON c.id = v.control_id
            WHERE v.project_slug = $1 AND (v.control_id::text = $2 OR v.control_id = $2::uuid)
            """,
            project_slug, control_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Evidence not found for control")

        files = await conn.fetch(
            """
            SELECT id, name, mime, size_bytes, sha256, uri, status, created_at, updated_at
            FROM evidence
            WHERE project_slug=$1 AND (control_id::text=$2 OR control_id=$2::uuid)
            ORDER BY updated_at DESC NULLS LAST, id DESC
            """,
            project_slug, control_id
        )

        attachments = []
        for f in files:
            attachments.append({
                "id": int(f["id"]),
                "filename": f["name"],        # alias for UI
                "name": f["name"],
                "content_type": f["mime"],
                "size_bytes": f["size_bytes"],
                "sha256_hex": f["sha256"],
                "storage_url": f["uri"],
                "status": f["status"],
                "created_at": f["created_at"].isoformat() if f["created_at"] else None,
                "updated_at": f["updated_at"].isoformat() if f["updated_at"] else None,
            })

        return {
            "project_slug": row["project_slug"],
            "control_id": row["control_id"],
            "kpi_key": row["kpi_key"],
            "evidence_source": row["evidence_source"],
            "owner_role": row["owner_role"],
            "notes": row["notes"],
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            "attachments": attachments,
        }


@router.post("/projects/{project_slug}/controls/{control_id}/evidence:init")
async def init_control_evidence_upload(
    request: Request,
    project_slug: str,
    control_id: str,
) -> dict:
    """
    Import Evidence button preflight/init.

    Creates an 'evidence' row with status 'pending' and returns a PUT URL
    that the UI can upload to (this API).
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Validate control exists for the project
        exists = await conn.fetchval(
            "SELECT 1 FROM control_values WHERE project_slug=$1 AND (control_id::text=$2 OR control_id=$2::uuid)",
            project_slug, control_id
        )
        if not exists:
            raise HTTPException(status_code=404, detail="Control not found")

        row = await conn.fetchrow(
            """
            INSERT INTO evidence (
              project_slug, control_id, name, mime,
              size_bytes, sha256, uri, status, created_by,
              created_at, updated_at
            )
            VALUES ($1, $2::uuid, '', '', 0, NULL, '', 'pending', 'system', NOW(), NOW())
            RETURNING id, uri, status
            """,
            project_slug, control_id
        )
        evidence_id = row["id"]

    # Build absolute URL so the browser PUTs to backend (not Next)
    scheme = request.url.scheme
    host = request.headers.get("host")  # e.g., "localhost:8001"
    relative_put = f"/admin/projects/{project_slug}/controls/{control_id}/evidence:upload/{evidence_id}"
    absolute_put = f"{scheme}://{host}{relative_put}"

    return {
        "ok": True,
        "mode": "put",
        # new key expected by frontend:
        "upload_url": absolute_put,
        # legacy alias for completeness:
        "put_url": absolute_put,
        "headers": {},                 # client may send Content-Type; we read it
        "max_size_mb": 100,
        "accepted": ["application/pdf", "text/csv", "image/*", "text/plain"],
        "evidence_id": evidence_id,
        # expose storage fields for UI (aliases too)
        "storage_url": row["uri"],
        "uri": row["uri"],
        "status": row["status"] or "pending",
        "method": "PUT",
    }


@router.put("/projects/{project_slug}/controls/{control_id}/evidence:upload/{evidence_id}")
async def upload_control_evidence_binary(
    request: Request,
    project_slug: str,
    control_id: str,
    evidence_id: int,  # change to str if UUID
):
    """
    Step 2: UI does a PUT to this URL with the raw file body.
    We stream the body to a local file and update the DB row with size/mime,
    sha256 and a local file URI.
    """
    original_filename = request.headers.get("X-Original-Filename", "upload.bin")
    content_type = request.headers.get("Content-Type", "application/octet-stream")

    bucket_dir = LOCAL_EVIDENCE_ROOT / project_slug / control_id
    bucket_dir.mkdir(parents=True, exist_ok=True)
    target_path = bucket_dir / f"{evidence_id}-{original_filename}"

    hasher = hashlib.sha256()
    size = 0
    with target_path.open("wb") as f:
        async for chunk in request.stream():
            if not chunk:
                continue
            f.write(chunk)
            hasher.update(chunk)
            size += len(chunk)
    sha_hex = hasher.hexdigest()

    storage_uri = f"file://{target_path.as_posix()}"

    pool = await get_pool()
    async with pool.acquire() as conn:
        res = await conn.execute(
            """
            UPDATE evidence
            SET name         = $4,
                mime         = $5,
                size_bytes   = $6,
                sha256       = $7,
                uri          = $8,
                status       = 'uploaded',
                updated_at   = NOW()
            WHERE id = $3 AND project_slug = $1 AND (control_id::text=$2 OR control_id=$2::uuid)
            """,
            project_slug, control_id, evidence_id,
            original_filename, content_type, size, sha_hex, storage_uri
        )
        if res.split()[-1] == "0":
            try:
                target_path.unlink(missing_ok=True)
            except Exception:
                pass
            raise HTTPException(status_code=404, detail="Evidence row not found")

    return Response(status_code=200)


@router.post("/projects/{project_slug}/controls/{control_id}/evidence:finalize")
async def finalize_control_evidence_upload(
    project_slug: str,
    control_id: str,
    body: EvidenceFinalize
) -> dict:
    """
    Step 3: UI sends sha256_hex (optional) after the PUT finishes.
    We persist the hash (if provided) and set status to 'ready'.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        res = await conn.execute(
            """
            UPDATE evidence
            SET sha256     = COALESCE($4, sha256),
                status     = 'ready',
                updated_at = NOW()
            WHERE id = $3 AND project_slug = $1 AND (control_id::text=$2 OR control_id=$2::uuid)
            """,
            project_slug, control_id, body.evidence_id, body.sha256_hex
        )
        if res.split()[-1] == "0":
            raise HTTPException(status_code=404, detail="Evidence row not found")
    return {"ok": True, "evidence_id": body.evidence_id}


# ---- Finalize shims to match frontend path style (/.../evidence:finalize/{id}) ----
@router.post("/projects/{project_slug}/controls/{control_id}/evidence:finalize/{evidence_id}")
@router.post("/projects/{project_slug}/controls/{control_id}/evidence/finalize/{evidence_id}")
async def finalize_control_evidence_upload_with_path_id(
    project_slug: str,
    control_id: str,
    evidence_id: int,
    body: EvidenceFinalize
) -> dict:
    body.evidence_id = evidence_id
    return await finalize_control_evidence_upload(project_slug, control_id, body)


# ---- Download URL helper expected by frontend (/admin/evidence/{id}:download-url) ----
@router.post("/evidence/{evidence_id}:download-url")
async def evidence_download_url(evidence_id: int) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT uri FROM evidence WHERE id=$1", evidence_id)
        if not row:
            raise HTTPException(status_code=404, detail="Evidence not found")
        return {"url": row["uri"]}


# ---------- Evidence metadata-only update ----------
@router.post("/projects/{project_slug}/controls/{control_id}/evidence")
async def save_control_evidence(project_slug: str, control_id: str, body: EvidenceUpdate) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        res = await conn.execute(
            """
            UPDATE control_values
            SET evidence_source = COALESCE($3, evidence_source),
                owner_role      = COALESCE($4, owner_role),
                notes           = COALESCE($5, notes),
                updated_at      = NOW()
            WHERE project_slug = $1 AND (control_id::text=$2 OR control_id=$2::uuid)
            """,
            project_slug, control_id, body.evidence_source, body.owner_role, body.notes
        )
        if res.split()[-1] == "0":
            raise HTTPException(status_code=404, detail="Control not found")
        return {"ok": True}


# =====================================================================
#  Excel Import/Export (per-project)
# =====================================================================

def _naive_or_same(x: Optional[datetime]):
    if isinstance(x, datetime):
        return x.replace(tzinfo=None) if x.tzinfo is not None else x
    return x


@router.get("/projects/{project_slug}/pillar_overrides.xlsx")
async def export_pillar_overrides(project_slug: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT po.pillar_key AS pillar, po.score_pct, po.maturity
            FROM pillar_overrides po
            JOIN projects p ON p.id = po.project_id
            WHERE p.slug = $1
            ORDER BY po.pillar_key
            """,
            project_slug,
        )

        wb = Workbook()
        ws = wb.active
        ws.title = "pillar_overrides"
        ws.append(["pillar", "score_pct", "maturity"])
        if rows:
            for r in rows:
                ws.append([
                    r["pillar"],
                    float(r["score_pct"]) if r["score_pct"] is not None else None,
                    int(r["maturity"]) if r["maturity"] is not None else None,
                ])

        bio = io.BytesIO()
        wb.save(bio)
        bio.seek(0)

    filename = f"pillar_overrides_{project_slug}.xlsx"
    return StreamingResponse(
        bio,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/projects/{project_slug}/pillar_overrides")
async def import_pillar_overrides(project_slug: str, file: UploadFile = File(...)) -> dict:
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Please upload an .xlsx file")

    pool = await get_pool()
    async with pool.acquire() as conn:
        project_id = await get_project_id_by_slug(conn, project_slug)

        data = await file.read()
        try:
            wb = load_workbook(io.BytesIO(data), data_only=True)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Unable to read workbook: {e}")

        ws = wb.active
        headers = {str(ws.cell(row=1, column=c).value or "").strip().lower(): c
                   for c in range(1, ws.max_column + 1)}
        required = {"pillar"}
        if not required.issubset(headers):
            missing = sorted(required - set(headers))
            raise HTTPException(status_code=400, detail=f"Missing required column(s): {missing}")

        n_upserts = 0
        for r in range(2, ws.max_row + 1):
            pillar = ws.cell(row=r, column=headers["pillar"]).value
            if not pillar:
                continue
            score = None
            maturity = None
            if "score_pct" in headers:
                val = ws.cell(row=r, column=headers["score_pct"]).value
                if val is not None and str(val).strip() != "":
                    score = float(val)
            if "maturity" in headers:
                val = ws.cell(row=r, column=headers["maturity"]).value
                if val is not None and str(val).strip() != "":
                    maturity = int(val)

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
                project_id, str(pillar), score, maturity
            )
            n_upserts += 1

    return {"ok": True, "upserts": n_upserts}


@router.get("/projects/{project_slug}/control_values.xlsx")
async def export_control_values(project_slug: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await ensure_schema(conn)
        rows = await conn.fetch(
            """
            SELECT v.control_id,
                   COALESCE(c.name, v.control_id) AS name,
                   v.raw_value,
                   v.normalized_pct,
                   v.observed_at,
                   v.updated_at
            FROM control_values v
            LEFT JOIN controls c ON c.id = v.control_id
            WHERE v.project_slug = $1
            ORDER BY v.control_id
            """,
            project_slug,
        )

        wb = Workbook()
        ws = wb.active
        ws.title = "control_values"
        ws.append(["control_id", "name", "raw_value", "normalized_pct", "observed_at", "updated_at"])
        for r in rows:
            ws.append([
                r["control_id"],
                r["name"],
                float(r["raw_value"]) if r["raw_value"] is not None else None,
                float(r["normalized_pct"]) if r["normalized_pct"] is not None else None,
                _naive_or_same(r["observed_at"]),
                _naive_or_same(r["updated_at"]),
            ])

        bio = io.BytesIO()
        wb.save(bio)
        bio.seek(0)

    filename = f"control_values_{project_slug}.xlsx"
    return StreamingResponse(
        bio,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/projects/{project_slug}/control_values")
async def import_control_values(project_slug: str, file: UploadFile = File(...)) -> dict:
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Please upload an .xlsx file")

    pool = await get_pool()
    async with pool.acquire() as conn:
        await ensure_schema(conn)
        data = await file.read()
        try:
            wb = load_workbook(io.BytesIO(data), data_only=True)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Unable to read workbook: {e}")

        ws = wb.active
        headers = {str(ws.cell(row=1, column=c).value or "").strip().lower(): c
                   for c in range(1, ws.max_column + 1)}
        required = {"control_id", "raw_value"}
        if not required.issubset(headers):
            missing = sorted(required - set(headers))
            raise HTTPException(status_code=400, detail=f"Missing required column(s): {missing}")

        n_upserts = 0
        for r in range(2, ws.max_row + 1):
            control_id = ws.cell(row=r, column=headers["control_id"]).value
            if not control_id:
                continue
            raw = ws.cell(row=r, column=headers["raw_value"]).value
            if raw is None or str(raw).strip() == "":
                continue
            try:
                raw_f = float(raw)
            except Exception:
                raise HTTPException(status_code=400, detail=f"Row {r}: raw_value must be numeric")

            # Minimal upsert: write raw/normalized via control bounds
            await conn.execute(
                """
                INSERT INTO control_values (
                  project_slug, control_id, kpi_key, raw_value, normalized_pct, updated_at
                )
                SELECT $1, $2, c.kpi_key,
                       $3,
                       CASE
                         WHEN c.norm_min IS NULL OR c.norm_max IS NULL OR c.norm_min = c.norm_max
                           THEN LEAST(GREATEST($3, 0), 100)
                         WHEN c.higher_is_better
                           THEN LEAST(GREATEST( (($3 - c.norm_min) / NULLIF(c.norm_max - c.norm_min, 0)) * 100, 0), 100)
                         ELSE LEAST(GREATEST( ((c.norm_max - $3) / NULLIF(c.norm_max - c.norm_min, 0)) * 100, 0), 100)
                       END,
                       NOW()
                FROM controls c
                WHERE c.id = $2
                ON CONFLICT (project_slug, control_id)
                DO UPDATE SET
                  raw_value      = EXCLUDED.raw_value,
                  normalized_pct = EXCLUDED.normalized_pct,
                  updated_at     = NOW()
                """,
                project_slug, str(control_id), float(raw_f)
            )
            n_upserts += 1

    return {"ok": True, "upserts": n_upserts}
