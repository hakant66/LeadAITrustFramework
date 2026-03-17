from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
from uuid import uuid4

from sqlalchemy import text, bindparam
from sqlalchemy.dialects.postgresql import JSONB
import httpx

from app.db import engine
from app.settings import settings
from app.services.crypto import sign_payload, verify_signature


def _emit_audit_event(event_type: str, project_slug: str | None, object_id: str, details: Optional[dict] = None) -> None:
    base = settings.core_svc_url.rstrip("/")
    url = f"{base}/audit/events"
    payload = {
        "event_type": event_type,
        "actor": "cert-svc",
        "source_service": "cert-svc",
        "object_type": "trustmark",
        "object_id": object_id,
        "project_slug": project_slug,
        "details": details,
    }
    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(url, json=payload)
    except Exception:
        pass


def _axis_level(score: float | None) -> int:
    if score is None:
        return 0
    if score >= 80:
        return 3
    if score >= 60:
        return 2
    if score >= 40:
        return 1
    return 0


def _axis_label(axis: str, level: int) -> str:
    prefix = axis[:1].upper()
    return f"{prefix}{level}"


def _load_project(project_slug: str) -> Optional[dict]:
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT id, slug, name FROM projects WHERE slug = :slug"),
            {"slug": project_slug},
        ).mappings().first()
    return dict(row) if row else None


def _fetch_eval(project_slug: str) -> dict:
    base = settings.core_svc_url.rstrip("/")
    url = f"{base}/trust/evaluate/{project_slug}"
    with httpx.Client(timeout=15.0) as client:
        resp = client.get(url)
    if resp.status_code != 200:
        raise RuntimeError(f"core-svc trust evaluate failed ({resp.status_code})")
    return resp.json()


def issue_trustmark(project_slug: str, expires_days: int = 30) -> dict:
    project = _load_project(project_slug)
    if not project:
        raise RuntimeError("Project not found")

    evaluation = _fetch_eval(project_slug)
    axis_scores = evaluation.get("axis_scores") or {}
    tol_level = evaluation.get("tol")
    evaluated_at = evaluation.get("evaluated_at")
    eval_id = evaluation.get("snapshot_id")

    axis_levels = {
        axis: _axis_label(axis, _axis_level(axis_scores.get(axis)))
        for axis in ("safety", "compliance", "provenance")
    }

    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(days=expires_days)

    trustmark_id = str(uuid4())
    payload = {
        "id": trustmark_id,
        "project_id": project["id"],
        "project_slug": project["slug"],
        "tol": tol_level,
        "axis_scores": axis_scores,
        "axis_levels": axis_levels,
        "snapshot_id": eval_id,
        "evaluated_at": evaluated_at,
        "issued_at": issued_at.isoformat(),
        "expires_at": expires_at.isoformat(),
        "version": "v1",
    }

    signature = sign_payload(payload)

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO trustmarks (
                    id, project_id, project_slug, tol_level, axis_scores, axis_levels,
                    payload_json, signature, public_key, key_id, evaluation_id,
                    issued_at, expires_at, status
                )
                VALUES (
                    :id, :project_id, :project_slug, :tol_level, :axis_scores, :axis_levels,
                    :payload_json, :signature, :public_key, :key_id, :evaluation_id,
                    :issued_at, :expires_at, 'active'
                )
                """
            ).bindparams(
                bindparam("axis_scores", type_=JSONB),
                bindparam("axis_levels", type_=JSONB),
                bindparam("payload_json", type_=JSONB),
            ),
            {
                "id": trustmark_id,
                "project_id": project["id"],
                "project_slug": project["slug"],
                "tol_level": tol_level,
                "axis_scores": axis_scores,
                "axis_levels": axis_levels,
                "payload_json": payload,
                "signature": signature,
                "public_key": settings.trustmark_public_key,
                "key_id": settings.trustmark_key_id,
                "evaluation_id": eval_id,
                "issued_at": issued_at,
                "expires_at": expires_at,
            },
        )

    _emit_audit_event(
        event_type="trustmark_issued",
        project_slug=project_slug,
        object_id=trustmark_id,
        details={"tol": tol_level, "axis_levels": axis_levels},
    )

    return {
        "trustmark": payload,
        "signature": signature,
        "public_key": settings.trustmark_public_key,
    }


def revoke_trustmark(trustmark_id: str, reason: str | None = None) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE trustmarks
                   SET status = 'revoked', revoked_at = now(), revoked_reason = :reason
                 WHERE id = :id
                """
            ),
            {"id": trustmark_id, "reason": reason},
        )
    _emit_audit_event(
        event_type="trustmark_revoked",
        project_slug=None,
        object_id=trustmark_id,
        details={"reason": reason},
    )


def get_trustmark(trustmark_id: str) -> Optional[dict]:
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM trustmarks WHERE id = :id"),
            {"id": trustmark_id},
        ).mappings().first()
    return dict(row) if row else None


def verify_trustmark(trustmark_id: str) -> dict:
    record = get_trustmark(trustmark_id)
    if not record:
        return {"valid": False, "reason": "not_found"}

    payload = record.get("payload_json") or {}
    signature = record.get("signature")
    public_key = record.get("public_key")

    if record.get("status") == "revoked":
        return {"valid": False, "reason": "revoked", "trustmark": payload}

    expires_at = record.get("expires_at")
    if expires_at and isinstance(expires_at, datetime):
        if expires_at < datetime.now(timezone.utc):
            return {"valid": False, "reason": "expired", "trustmark": payload}

    if not signature or not public_key:
        return {"valid": False, "reason": "missing_signature", "trustmark": payload}

    ok = verify_signature(payload, signature, public_key)
    if not ok:
        return {"valid": False, "reason": "invalid_signature", "trustmark": payload}

    return {
        "valid": True,
        "trustmark": payload,
        "signature": signature,
        "key_id": record.get("key_id"),
        "issued_at": record.get("issued_at").isoformat() if record.get("issued_at") else None,
        "expires_at": expires_at.isoformat() if expires_at else None,
    }


def list_trustmarks(
    project_slug: str | None = None,
    status: str | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))
    clauses = []
    params: dict = {"limit": limit, "offset": offset}

    if project_slug:
        clauses.append("project_slug = :project_slug")
        params["project_slug"] = project_slug
    if status:
        clauses.append("status = :status")
        params["status"] = status
    if q:
        clauses.append("(id ILIKE :q OR project_slug ILIKE :q OR project_id ILIKE :q)")
        params["q"] = f"%{q}%"

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    count_sql = f"SELECT COUNT(*) FROM trustmarks {where}"
    list_sql = f"""
        SELECT id, project_id, project_slug, tol_level, axis_levels, axis_scores,
               issued_at, expires_at, status, revoked_at, revoked_reason
          FROM trustmarks
          {where}
         ORDER BY issued_at DESC
         LIMIT :limit OFFSET :offset
    """
    with engine.connect() as conn:
        total = conn.execute(text(count_sql), params).scalar() or 0
        rows = conn.execute(text(list_sql), params).mappings().all()

    items = []
    for row in rows:
        items.append(
            {
                "id": row["id"],
                "project_id": row["project_id"],
                "project_slug": row["project_slug"],
                "tol_level": row["tol_level"],
                "axis_levels": row["axis_levels"],
                "axis_scores": row["axis_scores"],
                "issued_at": row["issued_at"].isoformat() if row.get("issued_at") else None,
                "expires_at": row["expires_at"].isoformat() if row.get("expires_at") else None,
                "status": row["status"],
                "revoked_at": row["revoked_at"].isoformat() if row.get("revoked_at") else None,
                "revoked_reason": row.get("revoked_reason"),
            }
        )

    return {
        "items": items,
        "total": int(total),
        "limit": limit,
        "offset": offset,
    }


def latest_trustmark(project_slug: str) -> dict:
    with engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT id, project_id, project_slug, tol_level, axis_levels, axis_scores,
                       issued_at, expires_at, status
                  FROM trustmarks
                 WHERE project_slug = :slug
                 ORDER BY issued_at DESC
                 LIMIT 1
                """
            ),
            {"slug": project_slug},
        ).mappings().first()
    if not row:
        return {"ok": False, "reason": "not_found"}
    return {
        "ok": True,
        "item": {
            "id": row["id"],
            "project_id": row["project_id"],
            "project_slug": row["project_slug"],
            "tol_level": row["tol_level"],
            "axis_levels": row["axis_levels"],
            "axis_scores": row["axis_scores"],
            "issued_at": row["issued_at"].isoformat() if row.get("issued_at") else None,
            "expires_at": row["expires_at"].isoformat() if row.get("expires_at") else None,
            "status": row["status"],
        },
    }


def audit_view(trustmark_id: str) -> dict:
    record = get_trustmark(trustmark_id)
    if not record:
        return {"ok": False, "reason": "not_found"}
    return {
        "ok": True,
        "trustmark": record.get("payload_json") or {},
        "evaluation_id": record.get("evaluation_id"),
        "project_slug": record.get("project_slug"),
        "status": record.get("status"),
        "revoked_reason": record.get("revoked_reason"),
    }
