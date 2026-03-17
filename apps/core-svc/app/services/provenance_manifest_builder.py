from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import asyncpg


def _canonicalize_json(payload: Dict[str, Any]) -> str:
    return json.dumps(payload or {}, sort_keys=True, separators=(",", ":"))


def _sha256_hex(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def _split_regions(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    parts = [p.strip() for p in raw.replace(";", ",").split(",")]
    return [p for p in parts if p]


def _map_dpia_status(raw_status: Optional[str]) -> str:
    if not raw_status:
        return "missing"
    value = raw_status.strip().lower()
    if value in {"valid", "verified", "approved"}:
        return "valid"
    if value in {"expired", "outdated"}:
        return "expired"
    if value in {"invalid", "rejected", "failed"}:
        return "invalid"
    return "missing"


def _contains_sensitive(text: Optional[str]) -> bool:
    if not text:
        return False
    lowered = text.lower()
    return any(token in lowered for token in ("pii", "personal", "sensitive"))


async def build_manifest_facts_for_project(
    conn: asyncpg.Connection, project_slug: str, entity_id: Optional[UUID] = None
) -> Dict[str, Any]:
    """
    Derive provenance manifest facts from existing project data.
    This keeps values conservative (no fabricated claims) while filling
    as much as possible from registry, evidence, and provenance tables.
    """
    if entity_id:
        project_row = await conn.fetchrow(
            "SELECT slug, name FROM entity_projects WHERE slug = $1 AND entity_id = $2",
            project_slug, entity_id,
        )
    else:
        project_row = await conn.fetchrow(
            "SELECT slug, name FROM entity_projects WHERE slug = $1",
            project_slug,
        )
    if not project_row:
        raise ValueError(f"Project '{project_slug}' not found")
    
    # Get entity_id from project if not provided
    if not entity_id:
        entity_row = await conn.fetchrow("SELECT entity_id FROM entity_projects WHERE slug = $1", project_slug)
        if entity_row:
            entity_id = entity_row["entity_id"]

    if entity_id:
        ai_system = await conn.fetchrow(
            """
            SELECT name, description, vendor, provider_type, data_sensitivity,
                   region_scope, updated_at
            FROM ai_system_registry
            WHERE project_slug = $1 AND entity_id = $2
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 1
            """,
            project_slug, entity_id,
        )

        evidence_rows = await conn.fetch(
            """
            SELECT name, status, sha256, uri, updated_at
            FROM evidence
            WHERE project_slug = $1 AND entity_id = $2
            """,
            project_slug, entity_id,
        )

        artifact_rows = await conn.fetch(
            """
            SELECT uri, sha256, created_at
            FROM provenance_artifacts
            WHERE project_slug = $1 AND entity_id = $2
            """,
            project_slug, entity_id,
        )

        dataset_rows = await conn.fetch(
            """
            SELECT name, description
            FROM provenance_datasets
            WHERE project_slug = $1 AND entity_id = $2
            """,
            project_slug, entity_id,
        )

        model_rows = await conn.fetch(
            """
            SELECT name, version, framework
            FROM provenance_models
            WHERE project_slug = $1 AND entity_id = $2
            """,
            project_slug, entity_id,
        )
    else:
        ai_system = await conn.fetchrow(
            """
            SELECT name, description, vendor, provider_type, data_sensitivity,
                   region_scope, updated_at
            FROM ai_system_registry
            WHERE project_slug = $1
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 1
            """,
            project_slug,
        )

        evidence_rows = await conn.fetch(
            """
            SELECT name, status, sha256, uri, updated_at
            FROM evidence
            WHERE project_slug = $1
            """,
            project_slug,
        )

        artifact_rows = await conn.fetch(
            """
            SELECT uri, sha256, created_at
            FROM provenance_artifacts
            WHERE project_slug = $1
            """,
            project_slug,
        )

        dataset_rows = await conn.fetch(
            """
            SELECT name, description
            FROM provenance_datasets
            WHERE project_slug = $1
            """,
            project_slug,
        )

        model_rows = await conn.fetch(
            """
            SELECT name, version, framework
            FROM provenance_models
            WHERE project_slug = $1
            """,
            project_slug,
        )

    evidence_names = [r["name"] for r in evidence_rows if r.get("name")]
    dataset_names = [r["name"] for r in dataset_rows if r.get("name")]
    model_names = [r["name"] for r in model_rows if r.get("name")]

    source_name = None
    if ai_system and ai_system.get("name"):
        source_name = ai_system["name"]
    elif model_names:
        source_name = model_names[0]
    else:
        source_name = project_row["name"] or project_slug

    purpose = ""
    if ai_system and ai_system.get("description"):
        purpose = ai_system["description"]
    else:
        purpose = project_row["name"] or project_slug

    data_sensitivity = ai_system.get("data_sensitivity") if ai_system else None
    personal_data_present = _contains_sensitive(data_sensitivity)

    regions = _split_regions(ai_system.get("region_scope") if ai_system else None)

    dpia_row = next(
        (r for r in evidence_rows if r.get("name") and "dpia" in r["name"].lower()),
        None,
    )
    dpia_status = _map_dpia_status(dpia_row.get("status") if dpia_row else None)

    artifact_by_uri = {r["uri"]: r["sha256"] for r in artifact_rows if r.get("uri")}
    any_hash_mismatch = False
    all_linked_valid = True if evidence_rows else False
    for ev in evidence_rows:
        ev_sha = (ev.get("sha256") or "").lower()
        if not ev_sha:
            all_linked_valid = False
        artifact_sha = (artifact_by_uri.get(ev.get("uri")) or "").lower()
        if ev_sha and artifact_sha and ev_sha != artifact_sha:
            any_hash_mismatch = True
    if not evidence_rows:
        all_linked_valid = False

    last_evidence_at = None
    for ev in evidence_rows:
        updated_at = ev.get("updated_at")
        if updated_at and (last_evidence_at is None or updated_at > last_evidence_at):
            last_evidence_at = updated_at
    evidence_age_days = None
    if last_evidence_at:
        delta = datetime.now(timezone.utc) - last_evidence_at
        evidence_age_days = max(0, int(delta.total_seconds() // 86400))

    facts: Dict[str, Any] = {
        "source": {"system_name": source_name},
        "purpose": {"intended_use": purpose},
        "data_categories": {
            "included": dataset_names,
            "excluded": [],
            "findings": {"sensitive_included": personal_data_present},
        },
        "personal_data": {
            "present": personal_data_present,
            "treatment": "",
        },
        "legal_basis": {"basis": []},
        "geography": {"regions": regions},
        "retention": {"period_months": None},
        "evidence": {
            "present": evidence_names,
            "status": {"DPIA": dpia_status},
            "integrity": {
                "any_hash_mismatch": any_hash_mismatch,
                "all_linked_valid": all_linked_valid,
            },
        },
        "versioning": {"manifest_hash": ""},
        "signals": {
            "evidence_integrity_checks_within_days": evidence_age_days,
            "continuous_ok": False,
        },
    }

    manifest_hash = _sha256_hex(_canonicalize_json(facts))
    facts["versioning"]["manifest_hash"] = manifest_hash

    return facts
