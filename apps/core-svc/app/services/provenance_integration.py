from __future__ import annotations

"""
Provenance integration helpers.

Data model strategy: Option 2 (manifest facts stored as JSON per project).
This avoids forcing string/list data into numeric control values and keeps
the scorecard endpoints backward compatible while still allowing automatic
evaluation on GET/POST scorecard flows.
"""

from dataclasses import dataclass
from datetime import datetime
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from uuid import uuid4, UUID

import asyncpg

from app.services.provenance_rules import load_rules_config
from app.services.trust_eval import evaluate_provenance_hybrid


RULES_PATH = Path(__file__).resolve().parents[2] / "config" / "provenance_rules.yaml"
PROVENANCE_PILLAR_KEY = "PROV"
PROVENANCE_PILLAR_NAME = "Provenance"


@dataclass(frozen=True)
class ProvenanceEvaluation:
    overall_level: str
    overall_score: int
    overall_score_pct: float
    fields: list
    gates: list
    evaluated_at: str
    rules_version: Optional[str]
    rules_hash: Optional[str]
    manifest_hash: str
    snapshot_id: str


def _canonicalize_json(payload: Dict[str, Any]) -> str:
    return json.dumps(payload or {}, sort_keys=True, separators=(",", ":"))


def _sha256_hex(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def _manifest_hash(manifest_facts: Dict[str, Any]) -> str:
    return _sha256_hex(_canonicalize_json(manifest_facts))


def _rules_hash() -> str:
    raw = RULES_PATH.read_bytes()
    return hashlib.sha256(raw).hexdigest()


def provenance_level_to_score_pct(level: str) -> float:
    mapping = {"P0": 0.0, "P1": 33.0, "P2": 66.0, "P3": 100.0}
    return mapping.get(level, 0.0)


async def build_manifest_facts_for_project(
    conn: asyncpg.Connection, project_slug: str, entity_id: Optional[UUID] = None
) -> Dict[str, Any]:
    if entity_id:
        row = await conn.fetchrow(
            """
            SELECT manifest_json
            FROM provenance_manifest_facts
            WHERE project_slug = $1 AND entity_id = $2
            """,
            project_slug, entity_id,
        )
    else:
        row = await conn.fetchrow(
            """
            SELECT manifest_json
            FROM provenance_manifest_facts
            WHERE project_slug = $1
            """,
            project_slug,
        )
    if not row:
        return {}
    manifest = row["manifest_json"]
    return manifest if isinstance(manifest, dict) else json.loads(manifest or "{}")


async def upsert_manifest_facts(
    conn: asyncpg.Connection, project_slug: str, manifest_facts: Dict[str, Any], entity_id: Optional[UUID] = None
) -> str:
    # Get entity_id from project if not provided
    if not entity_id:
        proj_row = await conn.fetchrow("SELECT entity_id FROM entity_projects WHERE slug = $1", project_slug)
        if proj_row:
            entity_id = proj_row["entity_id"]
        if not entity_id:
            raise ValueError(f"Cannot determine entity_id for project '{project_slug}'")
    
    manifest_hash = _manifest_hash(manifest_facts)
    await conn.execute(
        """
        INSERT INTO provenance_manifest_facts (
          entity_id, project_slug, manifest_json, manifest_hash, updated_at
        )
        VALUES ($1, $2, $3::jsonb, $4, NOW())
        ON CONFLICT (entity_id, project_slug)
        DO UPDATE SET
          manifest_json = EXCLUDED.manifest_json,
          manifest_hash = EXCLUDED.manifest_hash,
          updated_at = NOW()
        """,
        entity_id,
        project_slug,
        json.dumps(manifest_facts),
        manifest_hash,
    )
    return manifest_hash


async def _latest_evaluation(
    conn: asyncpg.Connection,
    project_slug: str,
    manifest_hash: str,
    rules_hash: str,
    entity_id: Optional[UUID] = None,
) -> Optional[ProvenanceEvaluation]:
    if entity_id:
        row = await conn.fetchrow(
            """
            SELECT id, overall_level, overall_score, overall_score_pct,
                   fields_json, gates_json, manifest_hash, rules_version, rules_hash,
                   evaluated_at
            FROM provenance_evaluations
            WHERE project_slug = $1
              AND entity_id = $2
              AND manifest_hash = $3
              AND rules_hash = $4
            ORDER BY evaluated_at DESC
            LIMIT 1
            """,
            project_slug,
            entity_id,
            manifest_hash,
            rules_hash,
        )
    else:
        row = await conn.fetchrow(
            """
            SELECT id, overall_level, overall_score, overall_score_pct,
                   fields_json, gates_json, manifest_hash, rules_version, rules_hash,
                   evaluated_at
            FROM provenance_evaluations
            WHERE project_slug = $1
              AND manifest_hash = $2
              AND rules_hash = $3
            ORDER BY evaluated_at DESC
            LIMIT 1
            """,
            project_slug,
            manifest_hash,
            rules_hash,
        )
    if not row:
        return None
    fields = row["fields_json"]
    gates = row["gates_json"]
    return ProvenanceEvaluation(
        overall_level=row["overall_level"],
        overall_score=int(row["overall_score"]),
        overall_score_pct=float(row["overall_score_pct"]),
        fields=fields if isinstance(fields, list) else json.loads(fields or "[]"),
        gates=gates if isinstance(gates, list) else json.loads(gates or "[]"),
        evaluated_at=row["evaluated_at"].isoformat()
        if row["evaluated_at"]
        else "",
        rules_version=row["rules_version"],
        rules_hash=row["rules_hash"],
        manifest_hash=row["manifest_hash"],
        snapshot_id=row["id"],
    )


async def _insert_audit(
    conn: asyncpg.Connection,
    entity_type: str,
    entity_id: str,
    action: str,
    details: Dict[str, Any],
    actor: Optional[str] = "system",
) -> None:
    await conn.execute(
        """
        INSERT INTO provenance_audit (entity_type, entity_id, action, actor, details_json)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        """,
        entity_type,
        entity_id,
        action,
        actor,
        json.dumps(details or {}),
    )


async def evaluate_project_provenance(
    conn: asyncpg.Connection,
    project_slug: str,
    manifest_facts: Optional[Dict[str, Any]] = None,
    force_recompute: bool = False,
    entity_id: Optional[UUID] = None,
) -> ProvenanceEvaluation:
    # Get entity_id from project if not provided
    if not entity_id:
        proj_row = await conn.fetchrow("SELECT entity_id FROM entity_projects WHERE slug = $1", project_slug)
        if proj_row:
            entity_id = proj_row["entity_id"]
    
    if manifest_facts is None:
        manifest_facts = await build_manifest_facts_for_project(conn, project_slug, entity_id)

    # Local rules hash is used for caching even when MCP evaluation is enabled.
    config = load_rules_config()
    rules_version = str(config.get("version", ""))
    rules_hash = _rules_hash()
    manifest_hash = _manifest_hash(manifest_facts)

    if not force_recompute:
        cached = await _latest_evaluation(conn, project_slug, manifest_hash, rules_hash, entity_id)
        if cached:
            return cached

    evaluation = await evaluate_provenance_hybrid(
        manifest_facts,
        include_debug=False,
        rules=config,
    )
    overall_level = evaluation["overall"]["level"]
    overall_score = int(config["levels"].get(overall_level, 0))
    overall_score_pct = provenance_level_to_score_pct(overall_level)

    snapshot_id = str(uuid4())
    if entity_id:
        await conn.execute(
            """
            INSERT INTO provenance_evaluations (
              id, entity_id, project_slug, overall_level, overall_score, overall_score_pct,
              fields_json, gates_json, manifest_hash, rules_version, rules_hash,
              evaluated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, NOW())
            """,
            snapshot_id,
            entity_id,
            project_slug,
            overall_level,
            overall_score,
            overall_score_pct,
            json.dumps(evaluation.get("fields", [])),
            json.dumps(evaluation.get("gates", [])),
            manifest_hash,
            rules_version,
            rules_hash,
        )
    else:
        await conn.execute(
            """
            INSERT INTO provenance_evaluations (
              id, project_slug, overall_level, overall_score, overall_score_pct,
              fields_json, gates_json, manifest_hash, rules_version, rules_hash,
              evaluated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, NOW())
            """,
            snapshot_id,
            project_slug,
            overall_level,
            overall_score,
            overall_score_pct,
            json.dumps(evaluation.get("fields", [])),
            json.dumps(evaluation.get("gates", [])),
            manifest_hash,
            rules_version,
            rules_hash,
        )

    await _insert_audit(
        conn,
        "provenance_evaluation",
        snapshot_id,
        "PROVENANCE_EVALUATED",
        {
            "project_slug": project_slug,
            "overall_level": overall_level,
            "rules_version": rules_version,
            "rules_hash": rules_hash,
            "manifest_hash": manifest_hash,
        },
    )

    gates = evaluation.get("gates", [])
    if gates:
        for gate in gates:
            await _insert_audit(
                conn,
                "provenance_evaluation",
                snapshot_id,
                "PROVENANCE_HARD_GATE_TRIGGERED",
                {
                    "project_slug": project_slug,
                    "gate_id": gate.get("gate_id"),
                    "forced_level": gate.get("forced_level"),
                },
            )

    return ProvenanceEvaluation(
        overall_level=overall_level,
        overall_score=overall_score,
        overall_score_pct=overall_score_pct,
        fields=evaluation.get("fields", []),
        gates=gates,
        evaluated_at=datetime.utcnow().isoformat(),
        rules_version=rules_version,
        rules_hash=rules_hash,
        manifest_hash=manifest_hash,
        snapshot_id=snapshot_id,
    )
