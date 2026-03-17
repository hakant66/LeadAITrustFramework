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
    entity_id: UUID,
) -> int:
    sql = text("""
        INSERT INTO evidence (entity_id, project_slug, control_id, name, mime, size_bytes, uri, status, created_by)
        VALUES (:entity_id, :project_slug, :control_id, :name, :mime, :size_bytes, :uri, 'pending', :created_by)
        RETURNING id
    """)
    row = conn.execute(
        sql,
        {
            "entity_id": str(entity_id),
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


def get_evidence(conn: Connection, evidence_id: int, entity_id: Optional[UUID] = None) -> Optional[Dict[str, Any]]:
    if entity_id:
        row = conn.execute(
            text("SELECT * FROM evidence WHERE id = :id AND entity_id = :entity_id"),
            {"id": evidence_id, "entity_id": str(entity_id)}
        ).mappings().first()
    else:
        row = conn.execute(text("SELECT * FROM evidence WHERE id = :id"), {"id": evidence_id}).mappings().first()
    return dict(row) if row else None


def list_evidence(conn: Connection, project_slug: str, control_id: UUID, entity_id: UUID) -> List[Dict[str, Any]]:
    rows = conn.execute(
        text("""
            SELECT * FROM evidence
            WHERE project_slug = :project_slug AND control_id = :control_id AND entity_id = :entity_id
            ORDER BY created_at DESC
        """),
        {"project_slug": project_slug, "control_id": str(control_id), "entity_id": str(entity_id)},
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


def list_audit(conn: Connection, evidence_id: int, entity_id: Optional[UUID] = None) -> List[Dict[str, Any]]:
    if entity_id:
        rows = conn.execute(
            text("""
                SELECT ea.id, ea.action, ea.actor, ea.at, ea.details_json
                  FROM evidence_audit ea
                  JOIN evidence e ON e.id = ea.evidence_id
                 WHERE ea.evidence_id = :evidence_id AND e.entity_id = :entity_id
                 ORDER BY ea.at DESC
            """),
            {"evidence_id": evidence_id, "entity_id": str(entity_id)},
        ).mappings().all()
    else:
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
