from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID
import json

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel

from app.db_async import get_pool
from app.services.provenance_manifest_batch import batch_build_manifests
from app.dependencies import (
    get_entity_id_with_auth_viewer,
    get_entity_id_with_auth_editor,
)


router = APIRouter(prefix="/admin", tags=["provenance-admin"])


class ProvenanceManifestOut(BaseModel):
    project_slug: str
    project_name: Optional[str] = None
    manifest_json: Optional[Dict[str, Any]] = None
    manifest_hash: Optional[str] = None
    updated_at: Optional[str] = None
    overall_score_pct: Optional[float] = None
    overall_level: Optional[str] = None
    evaluated_at: Optional[str] = None


@router.post("/provenance-manifests/build")
async def build_provenance_manifests(
    project_slug: Optional[str] = Query(None),
    force_recompute: bool = Query(True),
    entity_id: UUID = Depends(get_entity_id_with_auth_editor),
) -> Dict[str, Any]:
    slugs = [project_slug] if project_slug else None
    try:
        return await batch_build_manifests(slugs, force_recompute=force_recompute, entity_id=entity_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/provenance-manifests", response_model=List[ProvenanceManifestOut])
async def list_provenance_manifests(
    entity_id: UUID = Depends(get_entity_id_with_auth_viewer),
) -> List[ProvenanceManifestOut]:
    """
    List provenance manifests for the authenticated entity.
    Requires viewer role or higher.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            WITH latest_eval AS (
              SELECT DISTINCT ON (entity_id, project_slug)
                entity_id, project_slug, overall_score_pct, overall_level, evaluated_at
              FROM provenance_evaluations
              WHERE entity_id = $1
              ORDER BY entity_id, project_slug, evaluated_at DESC
            )
            SELECT
              p.slug AS project_slug,
              p.name AS project_name,
              pm.manifest_json,
              pm.manifest_hash,
              pm.updated_at,
              le.overall_score_pct,
              le.overall_level,
              le.evaluated_at
            FROM entity_projects p
            LEFT JOIN provenance_manifest_facts pm
              ON pm.project_slug = p.slug AND pm.entity_id = p.entity_id
            LEFT JOIN latest_eval le
              ON le.project_slug = p.slug AND le.entity_id = p.entity_id
            WHERE p.entity_id = $1
            ORDER BY p.slug
            """,
            entity_id,
        )
    results: List[ProvenanceManifestOut] = []
    for r in rows:
        manifest_value = r["manifest_json"]
        if isinstance(manifest_value, str):
            try:
                manifest_value = json.loads(manifest_value)
            except json.JSONDecodeError:
                manifest_value = None
        results.append(
            ProvenanceManifestOut(
                project_slug=r["project_slug"],
                project_name=r["project_name"],
                manifest_json=manifest_value,
                manifest_hash=r["manifest_hash"],
                updated_at=r["updated_at"].isoformat() if r["updated_at"] else None,
                overall_score_pct=float(r["overall_score_pct"]) if r["overall_score_pct"] is not None else None,
                overall_level=r["overall_level"],
                evaluated_at=r["evaluated_at"].isoformat() if r["evaluated_at"] else None,
            )
        )
    return results
