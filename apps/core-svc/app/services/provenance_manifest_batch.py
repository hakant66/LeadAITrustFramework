from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID

import asyncpg

from app.db_async import get_pool
from app.services.provenance_integration import (
    evaluate_project_provenance,
    upsert_manifest_facts,
)
from app.services.provenance_manifest_builder import build_manifest_facts_for_project


async def _fetch_project_slugs(conn: asyncpg.Connection, entity_id: Optional[UUID] = None) -> List[str]:
    if entity_id:
        rows = await conn.fetch("SELECT slug FROM entity_projects WHERE entity_id = $1 ORDER BY slug", entity_id)
    else:
        rows = await conn.fetch("SELECT slug FROM entity_projects ORDER BY slug")
    return [r["slug"] for r in rows]


async def build_manifest_for_project(
    conn: asyncpg.Connection, project_slug: str, force_recompute: bool = True, entity_id: Optional[UUID] = None
) -> Dict[str, Any]:
    facts = await build_manifest_facts_for_project(conn, project_slug, entity_id)
    await upsert_manifest_facts(conn, project_slug, facts, entity_id)
    eval_result = await evaluate_project_provenance(
        conn, project_slug, manifest_facts=facts, force_recompute=force_recompute, entity_id=entity_id
    )
    return {
        "project_slug": project_slug,
        "overall_score_pct": eval_result.overall_score_pct,
        "overall_level": eval_result.overall_level,
    }


async def batch_build_manifests(
    project_slugs: Optional[List[str]] = None,
    force_recompute: bool = True,
    entity_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        slugs = project_slugs or await _fetch_project_slugs(conn, entity_id)
        results: List[Dict[str, Any]] = []
        errors: List[Dict[str, Any]] = []
        for slug in slugs:
            try:
                # Get entity_id from project if not provided
                effective_entity_id = entity_id
                if not effective_entity_id:
                    proj_row = await conn.fetchrow("SELECT entity_id FROM entity_projects WHERE slug = $1", slug)
                    if proj_row:
                        effective_entity_id = proj_row["entity_id"]
                
                res = await build_manifest_for_project(
                    conn, slug, force_recompute=force_recompute, entity_id=effective_entity_id
                )
                results.append(res)
            except Exception as exc:
                errors.append({"project_slug": slug, "error": str(exc)})
        return {
            "scope": "ALL" if project_slugs is None else "PARTIAL",
            "total_processed": len(slugs),
            "success_count": len(results),
            "error_count": len(errors),
            "results": results,
            "errors": errors,
        }
