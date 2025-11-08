# app/db/evidence_dao.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID
from sqlalchemy import text, bindparam
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import Connection


def insert_evidence(
    conn: Connection,
    project_slug: str,
    control_id: UUID,
    name: str,
    mime: Optional[str],
    size_bytes: Optional[int],
    uri: str,
    created_by: Optional[str],
) -> int:
    sql = text("""
        INSERT INTO evidence (project_slug, control_id, name, mime, size_bytes, uri, status, created_by)
        VALUES (:project_slug, :control_id, :name, :mime, :size_bytes, :uri, 'pending', :created_by)
        RETURNING id
    """)
    row = conn.execute(
        sql,
        {
            "project_slug": project_slug,
            "control_id": str(control_id),
            "name": name,
            "mime": mime,
            "size_bytes": size_bytes,
            "uri": uri,
            "created_by": created_by,
        },
    ).first()
    return int(row[0])


def update_evidence_uploaded(
    conn: Connection,
    evidence_id: int,
    sha256: str,
    size_bytes: int,
    mime: Optional[str],
) -> None:
    sql = text("""
        UPDATE evidence
           SET sha256   = :sha256,
               size_bytes = :size_bytes,
               mime      = COALESCE(:mime, mime),
               status    = 'uploaded',
               updated_at = now()
         WHERE id = :id
    """)
    conn.execute(sql, {"sha256": sha256, "size_bytes": size_bytes, "mime": mime, "id": evidence_id})


def get_evidence(conn: Connection, evidence_id: int) -> Optional[Dict[str, Any]]:
    row = conn.execute(text("SELECT * FROM evidence WHERE id = :id"), {"id": evidence_id}).mappings().first()
    return dict(row) if row else None


def list_evidence(conn: Connection, project_slug: str, control_id: UUID) -> List[Dict[str, Any]]:
    rows = conn.execute(
        text("""
            SELECT * FROM evidence
            WHERE project_slug = :project_slug AND control_id = :control_id
            ORDER BY created_at DESC
        """),
        {"project_slug": project_slug, "control_id": str(control_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def insert_audit(
    conn: Connection,
    evidence_id: int,
    action: str,
    actor: Optional[str],
    details: Optional[dict],
) -> None:
    """
    Store an audit row. `details` is a Python dict; bind it as JSONB so psycopg can adapt it.
    """
    stmt = (
        text("""
            INSERT INTO evidence_audit (evidence_id, action, actor, details_json)
            VALUES (:evidence_id, :action, :actor, :details)
        """)
        .bindparams(
            bindparam("evidence_id"),
            bindparam("action"),
            bindparam("actor"),
            bindparam("details", type_=JSONB),  # critical: type hint for JSONB
        )
    )
    conn.execute(
        stmt,
        {
            "evidence_id": evidence_id,
            "action": action,
            "actor": actor,
            "details": details or {},
        },
    )


def list_audit(conn: Connection, evidence_id: int) -> List[Dict[str, Any]]:
    rows = conn.execute(
        text("""
            SELECT id, action, actor, at, details_json
              FROM evidence_audit
             WHERE evidence_id = :evidence_id
             ORDER BY at DESC
        """),
        {"evidence_id": evidence_id},
    ).mappings().all()
    return [dict(r) for r in rows]
