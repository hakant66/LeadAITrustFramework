from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Optional, Tuple
from urllib.parse import urlparse

from sqlalchemy import text, bindparam
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import Connection

from app.db import engine
from app.services import s3_client


@dataclass(frozen=True)
class ProvenanceArtifactRow:
    id: str
    project_slug: str
    name: str
    uri: str
    sha256: str
    size_bytes: Optional[int]
    mime: Optional[str]
    license_name: Optional[str]
    license_url: Optional[str]
    usage_rights: Optional[str]


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def verify_sha256(expected_hex: str, data: bytes) -> bool:
    return sha256_hex(data) == (expected_hex or "").lower()


def _parse_s3_uri(uri: str) -> Tuple[str, str]:
    parsed = urlparse(uri)
    if parsed.scheme != "s3" or not parsed.netloc or not parsed.path:
        raise ValueError("Invalid s3 URI")
    bucket = parsed.netloc
    key = parsed.path.lstrip("/")
    return bucket, key


def _hash_stream(stream) -> str:
    hasher = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        hasher.update(chunk)
    return hasher.hexdigest()


def compute_s3_sha256(uri: str) -> str:
    bucket, key = _parse_s3_uri(uri)
    body = s3_client.get_object_stream(bucket, key)
    try:
        return _hash_stream(body)
    finally:
        body.close()


def insert_provenance_audit(
    conn: Connection,
    entity_type: str,
    entity_id: str,
    action: str,
    actor: Optional[str],
    details: Optional[dict],
) -> None:
    stmt = (
        text(
            """
            INSERT INTO provenance_audit (entity_type, entity_id, action, actor, details_json)
            VALUES (:entity_type, :entity_id, :action, :actor, :details)
            """
        )
        .bindparams(bindparam("details", type_=JSONB))
    )
    conn.execute(
        stmt,
        {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "actor": actor,
            "details": details or {},
        },
    )


def register_artifact(
    conn: Connection,
    artifact: ProvenanceArtifactRow,
    actor: Optional[str] = None,
) -> None:
    conn.execute(
        text(
            """
            INSERT INTO provenance_artifacts (
              id, project_slug, name, uri, sha256, size_bytes, mime,
              license_name, license_url, usage_rights, created_by
            )
            VALUES (
              :id, :project_slug, :name, :uri, :sha256, :size_bytes, :mime,
              :license_name, :license_url, :usage_rights, :created_by
            )
            """
        ),
        {
            "id": artifact.id,
            "project_slug": artifact.project_slug,
            "name": artifact.name,
            "uri": artifact.uri,
            "sha256": artifact.sha256.lower(),
            "size_bytes": artifact.size_bytes,
            "mime": artifact.mime,
            "license_name": artifact.license_name,
            "license_url": artifact.license_url,
            "usage_rights": artifact.usage_rights,
            "created_by": actor,
        },
    )
    insert_provenance_audit(
        conn,
        "artifact",
        artifact.id,
        "created",
        actor,
        {"sha256": artifact.sha256.lower(), "uri": artifact.uri},
    )


def validate_artifact_integrity(
    conn: Connection,
    artifact_id: str,
    actor: Optional[str] = None,
) -> bool:
    row = conn.execute(
        text(
            """
            SELECT id, uri, sha256
            FROM provenance_artifacts
            WHERE id = :id
            """
        ),
        {"id": artifact_id},
    ).mappings().first()
    if not row:
        raise ValueError("Artifact not found")

    computed = compute_s3_sha256(row["uri"])
    matches = computed == (row["sha256"] or "").lower()
    insert_provenance_audit(
        conn,
        "artifact",
        artifact_id,
        "integrity_check",
        actor,
        {"computed_sha256": computed, "match": matches},
    )
    return matches


def provenance_coverage_pct(project_slug: str) -> Optional[float]:
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text(
                    """
                    WITH linked AS (
                      SELECT DISTINCT artifact_id
                      FROM provenance_datasets
                      WHERE project_slug = :slug AND artifact_id IS NOT NULL
                      UNION
                      SELECT DISTINCT artifact_id
                      FROM provenance_models
                      WHERE project_slug = :slug AND artifact_id IS NOT NULL
                      UNION
                      SELECT DISTINCT artifact_id
                      FROM provenance_evidence
                      WHERE project_slug = :slug AND artifact_id IS NOT NULL
                    )
                    SELECT
                      COUNT(*) AS total,
                      COUNT(*) FILTER (
                        WHERE (license_name IS NOT NULL OR usage_rights IS NOT NULL)
                          AND id IN (SELECT artifact_id FROM linked)
                      ) AS good
                    FROM provenance_artifacts
                    WHERE project_slug = :slug
                    """
                ),
                {"slug": project_slug},
            ).mappings().first()
    except Exception:
        return None

    if not row or not row["total"]:
        return None

    total = float(row["total"])
    good = float(row["good"] or 0)
    return round((good / total) * 100.0, 2)
