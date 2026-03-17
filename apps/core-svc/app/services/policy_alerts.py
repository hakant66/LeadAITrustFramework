from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Dict, List
from uuid import uuid4

from app.db_async import get_pool


def _format_source_label(row: Dict) -> str | None:
    schema = row.get("schema_name")
    table = row.get("table_name")
    name = row.get("name")
    if schema and table:
        return f"{schema}.{table}"
    if table:
        return table
    if name:
        return name
    return None


async def compute_policy_alerts() -> List[Dict]:
    """
    Builds policy alerts from current governance warnings for active policies.
    Alerts are tied to policies, so they only appear when policies are active.
    """
    now = datetime.now(timezone.utc)
    pool = await get_pool()
    async with pool.acquire() as conn:
        policies = await conn.fetch(
            """
            SELECT id, title
            FROM policies
            WHERE status = 'active'
            """
        )
        active_ids = [p["id"] for p in policies]
        if not active_ids:
            await conn.execute(
                """
                UPDATE policy_alerts
                SET status = 'resolved',
                    resolved_at = NOW(),
                    updated_at = NOW()
                WHERE status = 'open'
                """
            )
            return []

        warning_rows = await conn.fetch(
            """
            SELECT w.assignment_id, w.warning_type, w.severity, w.message,
                   a.schema_name, a.table_name, a.name, a.connector_id
            FROM data_governance_warnings w
            LEFT JOIN data_classification_assignments a
              ON a.id = w.assignment_id
            WHERE w.resolved_at IS NULL
            """
        )

        warnings = []
        for row in warning_rows:
            source_label = _format_source_label(dict(row))
            message = row["message"]
            if source_label:
                message = f"{message} (Source: {source_label})"
            warnings.append(
                {
                    "alert_type": row["warning_type"],
                    "severity": row["severity"],
                    "message": message,
                    "source_type": "data_governance",
                    "source_key": f"{row['assignment_id']}:{row['warning_type']}",
                    "details": {
                        "assignment_id": row["assignment_id"],
                        "connector_id": row["connector_id"],
                        "schema_name": row["schema_name"],
                        "table_name": row["table_name"],
                        "name": row["name"],
                        "warning_type": row["warning_type"],
                        "severity": row["severity"],
                    },
                }
            )

        source_keys = [w["source_key"] for w in warnings]
        for policy in policies:
            for warning in warnings:
                await conn.execute(
                    """
                    INSERT INTO policy_alerts (
                      id, policy_id, policy_title, project_slug,
                      alert_type, severity, message, source_type, source_key,
                      status, created_at, updated_at, details_json
                    )
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12::jsonb)
                    ON CONFLICT (policy_id, alert_type, source_type, source_key, project_slug)
                    DO UPDATE SET
                      policy_title = EXCLUDED.policy_title,
                      severity = EXCLUDED.severity,
                      message = EXCLUDED.message,
                      status = 'open',
                      updated_at = NOW(),
                      resolved_at = NULL,
                      details_json = EXCLUDED.details_json
                    """,
                    str(uuid4()),
                    policy["id"],
                    policy["title"],
                    "global",
                    warning["alert_type"],
                    warning["severity"],
                    warning["message"],
                    warning["source_type"],
                    warning["source_key"],
                    "open",
                    now,
                    json.dumps(warning["details"]),
                )

            if source_keys:
                await conn.execute(
                    """
                    UPDATE policy_alerts
                    SET status = 'resolved',
                        resolved_at = NOW(),
                        updated_at = NOW()
                    WHERE policy_id = $1
                      AND status = 'open'
                      AND source_type = 'data_governance'
                      AND source_key <> ALL($2::text[])
                    """,
                    policy["id"],
                    source_keys,
                )
            else:
                await conn.execute(
                    """
                    UPDATE policy_alerts
                    SET status = 'resolved',
                        resolved_at = NOW(),
                        updated_at = NOW()
                    WHERE policy_id = $1
                      AND status = 'open'
                      AND source_type = 'data_governance'
                    """,
                    policy["id"],
                )

        await conn.execute(
            """
            UPDATE policy_alerts
            SET status = 'resolved',
                resolved_at = NOW(),
                updated_at = NOW()
            WHERE status = 'open'
              AND policy_id <> ALL($1::text[])
            """,
            active_ids,
        )

        rows = await conn.fetch(
            """
            SELECT id, policy_id, policy_title, project_slug, alert_type,
                   severity, message, source_type, source_key, status,
                   created_at, updated_at, resolved_at, details_json
            FROM policy_alerts
            WHERE status = 'open'
            ORDER BY created_at DESC
            """
        )

    return [dict(r) for r in rows]
