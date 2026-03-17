from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import List, Dict
from uuid import uuid4

from app.db_async import get_pool


def _usage_allows_training(allowed_usage: str | None) -> bool:
    if not allowed_usage:
        return True
    text = allowed_usage.lower()
    return any(term in text for term in ("train", "training", "model", "ml", "ai"))


async def compute_data_governance_warnings() -> List[Dict]:
    now = datetime.now(timezone.utc)
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            DELETE FROM data_governance_warnings
            WHERE resolved_at IS NULL
              AND warning_type IN ('pii_training','retention_overdue')
            """
        )

        assignments = await conn.fetch(
            """
            SELECT a.id, a.name, a.id_number,
                   t.pii_flag, t.allowed_usage
            FROM data_classification_assignments a
            JOIN data_classification_tags t ON t.id = a.tag_id
            """
        )
        assignment_map = {row["id"]: row for row in assignments}

        usage_rows = await conn.fetch(
            """
            SELECT assignment_id, usage_type, purpose, recorded_at
            FROM data_usage_records
            """
        )

        for row in usage_rows:
            assignment = assignment_map.get(row["assignment_id"])
            if not assignment:
                continue
            if row["usage_type"] == "training" and assignment["pii_flag"]:
                if not _usage_allows_training(assignment["allowed_usage"]):
                    message = (
                        "PII data used for training without explicit allowance."
                    )
                    await conn.execute(
                        """
                        INSERT INTO data_governance_warnings (
                          id, assignment_id, warning_type, severity, message,
                          created_at
                        )
                        VALUES ($1,$2,$3,$4,$5,NOW())
                        """
                        ,
                        str(uuid4()),
                        row["assignment_id"],
                        "pii_training",
                        "high",
                        message,
                    )

        policies = await conn.fetch(
            """
            SELECT retention_class, delete_after_days
            FROM data_retention_policies
            """
        )
        policy_map = {row["retention_class"]: row for row in policies}

        records = await conn.fetch(
            """
            SELECT id, assignment_id, retention_class, start_date, status
            FROM data_retention_records
            WHERE status <> 'deleted'
            """
        )

        for record in records:
            policy = policy_map.get(record["retention_class"])
            if not policy:
                continue
            delete_after_days = policy["delete_after_days"]
            due_at = datetime(
                record["start_date"].year,
                record["start_date"].month,
                record["start_date"].day,
                tzinfo=timezone.utc,
            ) + timedelta(days=delete_after_days)
            if now > due_at:
                message = "Retention period exceeded. Deletion required."
                await conn.execute(
                    """
                    INSERT INTO data_governance_warnings (
                      id, assignment_id, warning_type, severity, message,
                      created_at
                    )
                    VALUES ($1,$2,$3,$4,$5,NOW())
                    """
                    ,
                    str(uuid4()),
                    record["assignment_id"],
                    "retention_overdue",
                    "high",
                    message,
                )

        rows = await conn.fetch(
            """
            SELECT id, assignment_id, warning_type, severity, message,
                   created_at, resolved_at
            FROM data_governance_warnings
            WHERE resolved_at IS NULL
            ORDER BY created_at DESC
            """
        )

    return [dict(r) for r in rows]
