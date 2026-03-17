from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

from sqlalchemy import text

from app.db_async import get_pool
from app.db import engine


def _hash_payload(prev_hash: Optional[str], payload: Dict[str, Any]) -> str:
    material = json.dumps(
        {"prev_hash": prev_hash, "payload": payload},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


async def append_audit_event(
    event_type: str,
    actor: Optional[str] = None,
    actor_type: Optional[str] = None,
    source_service: Optional[str] = None,
    object_type: Optional[str] = None,
    object_id: Optional[str] = None,
    project_slug: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    event_id = str(uuid4())
    created_at = datetime.now(timezone.utc)

    payload = {
        "event_type": event_type,
        "actor": actor,
        "actor_type": actor_type,
        "source_service": source_service,
        "object_type": object_type,
        "object_id": object_id,
        "project_slug": project_slug,
        "details": details,
        "created_at": created_at.isoformat(),
    }

    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("SELECT pg_advisory_xact_lock(70801)")
            row = await conn.fetchrow(
                "SELECT hash FROM audit_events ORDER BY created_at DESC, id DESC LIMIT 1"
            )
            prev_hash = row["hash"] if row else None
            event_hash = _hash_payload(prev_hash, payload)
            await conn.execute(
                """
                INSERT INTO audit_events (
                  id, event_type, actor, actor_type, source_service,
                  object_type, object_id, project_slug, details_json,
                  hash_prev, hash, created_at
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)
                """,
                event_id,
                event_type,
                actor,
                actor_type,
                source_service,
                object_type,
                object_id,
                project_slug,
                json.dumps(details) if details is not None else None,
                prev_hash,
                event_hash,
                created_at,
            )

    return {
        "id": event_id,
        "event_type": event_type,
        "actor": actor,
        "actor_type": actor_type,
        "source_service": source_service,
        "object_type": object_type,
        "object_id": object_id,
        "project_slug": project_slug,
        "details": details,
        "hash_prev": prev_hash,
        "hash": event_hash,
        "created_at": created_at.isoformat(),
    }


def append_audit_event_sync(
    event_type: str,
    actor: Optional[str] = None,
    actor_type: Optional[str] = None,
    source_service: Optional[str] = None,
    object_type: Optional[str] = None,
    object_id: Optional[str] = None,
    project_slug: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    event_id = str(uuid4())
    created_at = datetime.now(timezone.utc)

    payload = {
        "event_type": event_type,
        "actor": actor,
        "actor_type": actor_type,
        "source_service": source_service,
        "object_type": object_type,
        "object_id": object_id,
        "project_slug": project_slug,
        "details": details,
        "created_at": created_at.isoformat(),
    }

    with engine.begin() as conn:
        conn.execute(text("SELECT pg_advisory_xact_lock(70801)"))
        row = conn.execute(
            text("SELECT hash FROM audit_events ORDER BY created_at DESC, id DESC LIMIT 1")
        ).mappings().first()
        prev_hash = row["hash"] if row else None
        event_hash = _hash_payload(prev_hash, payload)
        conn.execute(
            text(
                """
                INSERT INTO audit_events (
                  id, event_type, actor, actor_type, source_service,
                  object_type, object_id, project_slug, details_json,
                  hash_prev, hash, created_at
                )
                VALUES (:id,:event_type,:actor,:actor_type,:source_service,
                        :object_type,:object_id,:project_slug,CAST(:details AS jsonb),
                        :hash_prev,:hash,:created_at)
                """
            ),
            {
                "id": event_id,
                "event_type": event_type,
                "actor": actor,
                "actor_type": actor_type,
                "source_service": source_service,
                "object_type": object_type,
                "object_id": object_id,
                "project_slug": project_slug,
                "details": json.dumps(details) if details is not None else None,
                "hash_prev": prev_hash,
                "hash": event_hash,
                "created_at": created_at,
            },
        )

    return {
        "id": event_id,
        "event_type": event_type,
        "actor": actor,
        "actor_type": actor_type,
        "source_service": source_service,
        "object_type": object_type,
        "object_id": object_id,
        "project_slug": project_slug,
        "details": details,
        "hash_prev": prev_hash,
        "hash": event_hash,
        "created_at": created_at.isoformat(),
    }
